import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Shield, Power, CreditCard, FileText, IdCard, Edit, Snowflake, Lock, DollarSign, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SystemSetting {
  key: string;
  value: string;
  description: string | null;
}

const SystemControls = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Confirmation dialog for dangerous actions
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    setting: string;
    newValue: boolean;
    title: string;
    description: string;
  } | null>(null);
  
  // Password confirmation for emergency controls
  const [passwordDialog, setPasswordDialog] = useState<{
    open: boolean;
    setting: string;
    newValue: boolean;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Registration fee state
  const [registrationFee, setRegistrationFee] = useState('');
  const [savingFee, setSavingFee] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .order('key');

      if (error) throw error;
      setSettings(data || []);
      
      const fee = data?.find(s => s.key === 'registration_fee');
      if (fee) setRegistrationFee(fee.value);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getSetting = (key: string): boolean => {
    const setting = settings.find(s => s.key === key);
    return setting?.value === 'true';
  };

  const logAction = async (actionType: string, metadata: object) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase.from('action_logs').insert([{
        actor_id: user.id,
        action_type: actionType,
        target_table: 'app_settings',
        target_id: 'system',
        metadata,
      }]);
    } catch (error) {
      console.error('Error logging action:', error);
    }
  };

  const updateSetting = async (key: string, value: boolean, requiresConfirmation = false) => {
    // Check for dangerous actions that need confirmation
    if (requiresConfirmation) {
      const isEmergencyControl = key === 'system_frozen' || key === 'maintenance_mode';
      
      if (isEmergencyControl && value) {
        setPasswordDialog({ open: true, setting: key, newValue: value });
        return;
      }
      
      setConfirmDialog({
        open: true,
        setting: key,
        newValue: value,
        title: value ? 'Enable Setting' : 'Disable Setting',
        description: getConfirmationMessage(key, value),
      });
      return;
    }

    await performUpdate(key, value);
  };

  const getConfirmationMessage = (key: string, value: boolean): string => {
    const messages: Record<string, string> = {
      system_frozen: value 
        ? 'Freezing the system will disable ALL operations. No registrations, payments, or form submissions will be possible.'
        : 'Unfreezing the system will restore normal operations.',
      maintenance_mode: value
        ? 'Maintenance mode will make the system read-only. Users can view but not modify data.'
        : 'Disabling maintenance mode will restore full functionality.',
      registration_open: value
        ? 'Opening registration allows new students to sign up.'
        : 'Closing registration will prevent new student sign-ups.',
      payment_enabled: value
        ? 'Enabling payments allows students to make payments.'
        : 'Disabling payments will prevent all payment transactions.',
      form_submissions_open: value
        ? 'Opening form submissions allows students to submit skill forms.'
        : 'Closing form submissions will prevent new form submissions.',
      id_generation_enabled: value
        ? 'Enabling ID generation allows verified students to generate ID cards.'
        : 'Disabling ID generation will prevent students from generating ID cards.',
      edit_requests_enabled: value
        ? 'Enabling edit requests allows students to request form corrections.'
        : 'Disabling edit requests will prevent students from requesting edits.',
    };
    return messages[key] || `Are you sure you want to ${value ? 'enable' : 'disable'} this setting?`;
  };

  const performUpdate = async (key: string, value: boolean) => {
    setUpdating(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('app_settings')
        .update({
          value: value ? 'true' : 'false',
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('key', key);

      if (error) throw error;

      await logAction('update_system_setting', { key, value });

      toast({
        title: 'Setting Updated',
        description: `${key.replace(/_/g, ' ')} is now ${value ? 'enabled' : 'disabled'}`,
      });

      fetchSettings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update setting',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
      setConfirmDialog(null);
    }
  };

  const handlePasswordConfirm = async () => {
    if (!passwordDialog) return;

    setVerifying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No user found');

      // Re-authenticate with password
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (error) throw new Error('Invalid password');

      // Password verified, perform the update
      await performUpdate(passwordDialog.setting, passwordDialog.newValue);
      setPasswordDialog(null);
      setPassword('');
    } catch (error: any) {
      toast({
        title: 'Authentication Failed',
        description: error.message || 'Please check your password',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleUpdateFee = async () => {
    if (!registrationFee || isNaN(Number(registrationFee)) || Number(registrationFee) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid positive number',
        variant: 'destructive',
      });
      return;
    }

    setSavingFee(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('app_settings')
        .update({
          value: registrationFee,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('key', 'registration_fee');

      if (error) throw error;

      await logAction('update_registration_fee', { amount: registrationFee });

      toast({
        title: 'Fee Updated',
        description: `Registration fee set to ₦${Number(registrationFee).toLocaleString()}`,
      });
      
      fetchSettings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update fee',
        variant: 'destructive',
      });
    } finally {
      setSavingFee(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isFrozen = getSetting('system_frozen');
  const isMaintenance = getSetting('maintenance_mode');

  return (
    <div className="space-y-6">
      {/* Emergency Alerts */}
      {isFrozen && (
        <Alert variant="destructive">
          <Snowflake className="h-4 w-4" />
          <AlertTitle>System Frozen</AlertTitle>
          <AlertDescription>
            All system operations are currently disabled. Only Super Admin can unfreeze.
          </AlertDescription>
        </Alert>
      )}
      
      {isMaintenance && !isFrozen && (
        <Alert className="border-warning bg-warning/10">
          <Wrench className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Maintenance Mode</AlertTitle>
          <AlertDescription>
            System is in read-only mode. Users cannot make changes.
          </AlertDescription>
        </Alert>
      )}

      {/* Emergency Controls */}
      <Card className="border-destructive/50 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Emergency Controls
          </CardTitle>
          <CardDescription>Critical system controls that require password confirmation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20">
            <div className="flex items-center gap-3">
              <Snowflake className="h-5 w-5 text-destructive" />
              <div>
                <Label className="text-base font-medium">Freeze System</Label>
                <p className="text-sm text-muted-foreground">Disable ALL operations immediately</p>
              </div>
            </div>
            <Switch
              checked={isFrozen}
              onCheckedChange={(checked) => updateSetting('system_frozen', checked, true)}
              disabled={updating === 'system_frozen'}
            />
          </div>
          
          <div className="flex items-center justify-between p-4 bg-warning/5 rounded-lg border border-warning/20">
            <div className="flex items-center gap-3">
              <Wrench className="h-5 w-5 text-warning" />
              <div>
                <Label className="text-base font-medium">Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">Put system in read-only mode</p>
              </div>
            </div>
            <Switch
              checked={isMaintenance}
              onCheckedChange={(checked) => updateSetting('maintenance_mode', checked, true)}
              disabled={updating === 'maintenance_mode'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Registration Fee */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Registration Fee
          </CardTitle>
          <CardDescription>Set the registration fee for students</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex-1 space-y-2">
              <Label>Amount (₦)</Label>
              <Input
                type="number"
                value={registrationFee}
                onChange={(e) => setRegistrationFee(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <Button onClick={handleUpdateFee} disabled={savingFee}>
              {savingFee && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Current fee: ₦{registrationFee ? Number(registrationFee).toLocaleString() : '...'}
          </p>
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" />
            Feature Toggles
          </CardTitle>
          <CardDescription>Control which features are available to users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5" />
              <div>
                <Label className="text-base font-medium">Registration Open</Label>
                <p className="text-sm text-muted-foreground">Allow new student registrations</p>
              </div>
            </div>
            <Switch
              checked={getSetting('registration_open')}
              onCheckedChange={(checked) => updateSetting('registration_open', checked, true)}
              disabled={updating === 'registration_open' || isFrozen}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5" />
              <div>
                <Label className="text-base font-medium">Payments Enabled</Label>
                <p className="text-sm text-muted-foreground">Allow payment processing</p>
              </div>
            </div>
            <Switch
              checked={getSetting('payment_enabled')}
              onCheckedChange={(checked) => updateSetting('payment_enabled', checked, true)}
              disabled={updating === 'payment_enabled' || isFrozen}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5" />
              <div>
                <Label className="text-base font-medium">Form Submissions Open</Label>
                <p className="text-sm text-muted-foreground">Allow skill form submissions</p>
              </div>
            </div>
            <Switch
              checked={getSetting('form_submissions_open')}
              onCheckedChange={(checked) => updateSetting('form_submissions_open', checked, true)}
              disabled={updating === 'form_submissions_open' || isFrozen}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <IdCard className="h-5 w-5" />
              <div>
                <Label className="text-base font-medium">ID Generation Enabled</Label>
                <p className="text-sm text-muted-foreground">Allow students to generate ID cards</p>
              </div>
            </div>
            <Switch
              checked={getSetting('id_generation_enabled')}
              onCheckedChange={(checked) => updateSetting('id_generation_enabled', checked, true)}
              disabled={updating === 'id_generation_enabled' || isFrozen}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Edit className="h-5 w-5" />
              <div>
                <Label className="text-base font-medium">Edit Requests Enabled</Label>
                <p className="text-sm text-muted-foreground">Allow form edit requests</p>
              </div>
            </div>
            <Switch
              checked={getSetting('edit_requests_enabled')}
              onCheckedChange={(checked) => updateSetting('edit_requests_enabled', checked, true)}
              disabled={updating === 'edit_requests_enabled' || isFrozen}
            />
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog?.open} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
            <DialogDescription>{confirmDialog?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button 
              variant={confirmDialog?.newValue ? 'default' : 'destructive'}
              onClick={() => confirmDialog && performUpdate(confirmDialog.setting, confirmDialog.newValue)}
              disabled={!!updating}
            >
              {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Confirmation Dialog */}
      <Dialog open={passwordDialog?.open} onOpenChange={() => {
        setPasswordDialog(null);
        setPassword('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Confirm Your Password
            </DialogTitle>
            <DialogDescription>
              This action requires password confirmation for security.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordConfirm()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPasswordDialog(null);
              setPassword('');
            }}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={handlePasswordConfirm}
              disabled={verifying || !password}
            >
              {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm & Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SystemControls;
