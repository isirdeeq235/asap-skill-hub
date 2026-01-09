import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Shield, Lock, Clock, Users, RotateCcw, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ActionConfig, getActionConfig, getTierColor, getTierLabel } from '@/lib/actionTiers';

interface SafeActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: string;
  onConfirm: (justification: string) => Promise<void>;
  affectedCount?: number;
  customWarning?: string;
}

const SafeActionDialog = ({
  open,
  onOpenChange,
  actionType,
  onConfirm,
  affectedCount = 0,
  customWarning,
}: SafeActionDialogProps) => {
  const { toast } = useToast();
  const config = getActionConfig(actionType);
  const [justification, setJustification] = useState('');
  const [password, setPassword] = useState('');
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'justify' | 'reauth' | 'confirm' | 'scheduled'>('justify');
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);

  const handleClose = () => {
    setJustification('');
    setPassword('');
    setStep('justify');
    setScheduledTime(null);
    onOpenChange(false);
  };

  const handleReauth = async () => {
    if (!password.trim()) {
      toast({ title: 'Password Required', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No user found');

      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (error) throw new Error('Invalid password');

      if (config.delayMinutes > 0) {
        // Schedule delayed execution
        const scheduled = new Date(Date.now() + config.delayMinutes * 60 * 1000);
        setScheduledTime(scheduled);
        setStep('scheduled');
      } else {
        setStep('confirm');
      }
    } catch (error: any) {
      toast({
        title: 'Authentication Failed',
        description: error.message || 'Please check your password',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleScheduleAction = async () => {
    if (!justification.trim()) {
      toast({ title: 'Justification Required', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const scheduled = new Date(Date.now() + config.delayMinutes * 60 * 1000);

      await supabase.from('pending_actions').insert([{
        actor_id: user.id,
        action_type: actionType,
        action_tier: config.tier,
        justification,
        scheduled_for: scheduled.toISOString(),
        affected_users_count: affectedCount,
        payload: {},
      }]);

      toast({
        title: 'Action Scheduled',
        description: `Will execute in ${config.delayMinutes} minutes. You can cancel from Pending Actions.`,
      });

      handleClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to schedule action',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleImmediateConfirm = async () => {
    if (config.requiresJustification && !justification.trim()) {
      toast({ title: 'Justification Required', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      await onConfirm(justification);
      handleClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Action failed',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleNext = () => {
    if (config.requiresJustification && !justification.trim()) {
      toast({ title: 'Justification Required', description: 'Please explain why you are taking this action.', variant: 'destructive' });
      return;
    }

    if (config.requiresReauth) {
      setStep('reauth');
    } else if (config.delayMinutes > 0) {
      const scheduled = new Date(Date.now() + config.delayMinutes * 60 * 1000);
      setScheduledTime(scheduled);
      setStep('scheduled');
    } else {
      setStep('confirm');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Badge className={`${getTierColor(config.tier)} border`}>
              {getTierLabel(config.tier)}
            </Badge>
            <DialogTitle>{config.label}</DialogTitle>
          </div>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        {/* Warning Alerts */}
        {(config.warningMessage || customWarning) && (
          <Alert variant="destructive" className="border-destructive/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>{customWarning || config.warningMessage}</AlertDescription>
          </Alert>
        )}

        {affectedCount > 0 && (
          <Alert className="border-warning/50 bg-warning/5">
            <Users className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning">Impact Notice</AlertTitle>
            <AlertDescription>
              This action will affect <strong>{affectedCount}</strong> user{affectedCount !== 1 ? 's' : ''}.
            </AlertDescription>
          </Alert>
        )}

        {!config.isReversible && (
          <Alert variant="destructive">
            <RotateCcw className="h-4 w-4" />
            <AlertTitle>Irreversible Action</AlertTitle>
            <AlertDescription>
              This action <strong>cannot be undone</strong>. Proceed with extreme caution.
            </AlertDescription>
          </Alert>
        )}

        {/* Step: Justification */}
        {step === 'justify' && (
          <div className="space-y-4 py-4">
            {config.requiresJustification && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Justification <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Explain why you are taking this action..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  This will be permanently recorded in the audit log.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step: Re-authentication */}
        {step === 'reauth' && (
          <div className="space-y-4 py-4">
            <Alert className="border-primary/50 bg-primary/5">
              <Lock className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary">Re-authentication Required</AlertTitle>
              <AlertDescription>
                This action requires you to verify your identity.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Enter Your Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                onKeyDown={(e) => e.key === 'Enter' && handleReauth()}
              />
            </div>
          </div>
        )}

        {/* Step: Scheduled */}
        {step === 'scheduled' && scheduledTime && (
          <div className="space-y-4 py-4">
            <Alert className="border-warning/50 bg-warning/5">
              <Clock className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning">Delayed Execution</AlertTitle>
              <AlertDescription>
                This action is scheduled to execute at{' '}
                <strong>{scheduledTime.toLocaleTimeString()}</strong> ({config.delayMinutes} minutes from now).
                You can cancel this action from the Pending Actions panel before it executes.
              </AlertDescription>
            </Alert>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm font-medium">Your Justification:</p>
              <p className="text-sm text-muted-foreground mt-1">{justification}</p>
            </div>
          </div>
        )}

        {/* Step: Final Confirm (for non-delayed actions) */}
        {step === 'confirm' && (
          <div className="space-y-4 py-4">
            <Alert className="border-green-500/50 bg-green-500/5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-500">Ready to Execute</AlertTitle>
              <AlertDescription>
                Click confirm to proceed with this action.
              </AlertDescription>
            </Alert>
            {justification && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm font-medium">Your Justification:</p>
                <p className="text-sm text-muted-foreground mt-1">{justification}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={processing}>
            Cancel
          </Button>

          {step === 'justify' && (
            <Button onClick={handleNext} disabled={processing}>
              {config.requiresReauth ? 'Continue to Verify' : config.delayMinutes > 0 ? 'Schedule Action' : 'Confirm'}
            </Button>
          )}

          {step === 'reauth' && (
            <Button onClick={handleReauth} disabled={processing || !password.trim()}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Verify Identity
            </Button>
          )}

          {step === 'scheduled' && (
            <Button onClick={handleScheduleAction} variant="destructive" disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Schedule Action
            </Button>
          )}

          {step === 'confirm' && (
            <Button onClick={handleImmediateConfirm} variant="destructive" disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Execute Now
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SafeActionDialog;
