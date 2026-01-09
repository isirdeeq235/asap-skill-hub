import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertTriangle, Shield, Power, CreditCard, FileText, IdCard, Edit, Snowflake, Lock, DollarSign, Wrench, Clock, History, Users, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getActionConfig, getTierColor, getTierLabel, ActionTier } from '@/lib/actionTiers';
import SafeActionDialog from './SafeActionDialog';
import SettingsHistory from './SettingsHistory';

interface SystemSetting {
  key: string;
  value: string;
  description: string | null;
}

const SafeSystemControls = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Safe Action Dialog state
  const [safeActionDialog, setSafeActionDialog] = useState<{
    open: boolean;
    actionType: string;
    settingKey: string;
    newValue: boolean;
    affectedCount: number;
  } | null>(null);

  // Registration fee state
  const [registrationFee, setRegistrationFee] = useState('');
  const [feeJustification, setFeeJustification] = useState('');
  const [showFeeDialog, setShowFeeDialog] = useState(false);
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

  const recordSettingHistory = async (key: string, oldValue: string, newValue: string, reason: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('app_settings_history').insert([{
        setting_key: key,
        old_value: oldValue,
        new_value: newValue,
        changed_by: user?.id,
        change_reason: reason,
      }]);
    } catch (error) {
      console.error('Error recording history:', error);
    }
  };

  const logAction = async (actionType: string, metadata: Record<string, unknown>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase.from('action_logs').insert([{
        actor_id: user.id,
        action_type: actionType,
        target_table: 'app_settings',
        target_id: 'system',
        metadata: metadata as any,
      }]);
    } catch (error) {
      console.error('Error logging action:', error);
    }
  };

  const handleToggleSetting = (key: string, currentValue: boolean) => {
    const actionType = getActionTypeForSetting(key, !currentValue);
    const config = getActionConfig(actionType);
    
    // Get affected user count for dangerous operations
    let affectedCount = 0;
    if (key === 'system_frozen' || key === 'maintenance_mode' || key === 'payment_enabled') {
      // These affect all users
      affectedCount = 100; // Placeholder - would fetch actual count
    }

    setSafeActionDialog({
      open: true,
      actionType,
      settingKey: key,
      newValue: !currentValue,
      affectedCount,
    });
  };

  const getActionTypeForSetting = (key: string, enabling: boolean): string => {
    switch (key) {
      case 'system_frozen':
        return 'system_freeze';
      case 'maintenance_mode':
        return 'maintenance_mode';
      case 'payment_enabled':
        return enabling ? 'toggle_feature' : 'disable_payments';
      default:
        return 'toggle_feature';
    }
  };

  const handleSettingConfirm = async (justification: string) => {
    if (!safeActionDialog) return;
    
    const { settingKey, newValue } = safeActionDialog;
    const config = getActionConfig(safeActionDialog.actionType);
    
    // For Tier 3 actions, schedule instead of immediate execution
    if (config.tier === 'tier3' && config.delayMinutes > 0) {
      // The SafeActionDialog handles scheduling
      throw new Error('This action requires delayed execution');
    }

    setUpdating(settingKey);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const oldValue = getSetting(settingKey) ? 'true' : 'false';
      
      const { error } = await supabase
        .from('app_settings')
        .update({
          value: newValue ? 'true' : 'false',
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('key', settingKey);

      if (error) throw error;

      // Record in history
      await recordSettingHistory(settingKey, oldValue, newValue ? 'true' : 'false', justification);

      await logAction('update_system_setting', { 
        key: settingKey, 
        value: newValue,
        justification,
      });

      toast({
        title: 'Setting Updated',
        description: `${settingKey.replace(/_/g, ' ')} is now ${newValue ? 'enabled' : 'disabled'}`,
      });

      fetchSettings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update setting',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setUpdating(null);
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

    if (!feeJustification.trim()) {
      toast({
        title: 'Justification Required',
        description: 'Please explain why you are changing the fee',
        variant: 'destructive',
      });
      return;
    }

    setSavingFee(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get old value
      const oldFee = settings.find(s => s.key === 'registration_fee')?.value || '0';
      
      const { error } = await supabase
        .from('app_settings')
        .update({
          value: registrationFee,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('key', 'registration_fee');

      if (error) throw error;

      // Record history
      await recordSettingHistory('registration_fee', oldFee, registrationFee, feeJustification);

      await logAction('update_registration_fee', { 
        old_amount: oldFee,
        new_amount: registrationFee,
        justification: feeJustification,
      });

      toast({
        title: 'Fee Updated',
        description: `Registration fee set to ₦${Number(registrationFee).toLocaleString()}`,
      });
      
      setShowFeeDialog(false);
      setFeeJustification('');
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

  const getTierBadgeForSetting = (key: string) => {
    const dangerousSettings = ['system_frozen', 'maintenance_mode'];
    const riskySettings = ['payment_enabled', 'registration_open', 'form_submissions_open', 'id_generation_enabled', 'edit_requests_enabled'];
    
    let tier: ActionTier = 'tier1';
    if (dangerousSettings.includes(key)) tier = 'tier3';
    else if (riskySettings.includes(key)) tier = 'tier2';
    
    return (
      <Badge className={`${getTierColor(tier)} border text-xs`}>
        {getTierLabel(tier)}
      </Badge>
    );
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

      <Tabs defaultValue="controls" className="space-y-6">
        <TabsList>
          <TabsTrigger value="controls" className="flex items-center gap-2">
            <Power className="w-4 h-4" />
            Controls
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Version History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="controls" className="space-y-6">
          {/* Tier Legend */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Action Safety Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge className={`${getTierColor('tier1')} border`}>SAFE</Badge>
                  <span className="text-muted-foreground">Instant, no confirmation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${getTierColor('tier2')} border`}>RISKY</Badge>
                  <span className="text-muted-foreground">Requires justification</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${getTierColor('tier3')} border`}>DANGEROUS</Badge>
                  <span className="text-muted-foreground">Delayed execution, re-auth</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Controls - Tier 3 */}
          <Card className="border-destructive/50 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Emergency Controls
                <Badge className={`${getTierColor('tier3')} border ml-2`}>DANGEROUS</Badge>
              </CardTitle>
              <CardDescription>
                Critical system controls with delayed execution and password confirmation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                <div className="flex items-center gap-3">
                  <Snowflake className="h-5 w-5 text-destructive" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-medium">Freeze System</Label>
                      {getTierBadgeForSetting('system_frozen')}
                    </div>
                    <p className="text-sm text-muted-foreground">Disable ALL operations immediately</p>
                    <p className="text-xs text-destructive mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      5 minute delay • Requires password
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isFrozen}
                  onCheckedChange={() => handleToggleSetting('system_frozen', isFrozen)}
                  disabled={updating === 'system_frozen'}
                />
              </div>
              
              <div className="flex items-center justify-between p-4 bg-warning/5 rounded-lg border border-warning/20">
                <div className="flex items-center gap-3">
                  <Wrench className="h-5 w-5 text-warning" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-medium">Maintenance Mode</Label>
                      {getTierBadgeForSetting('maintenance_mode')}
                    </div>
                    <p className="text-sm text-muted-foreground">Put system in read-only mode</p>
                    <p className="text-xs text-warning mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      5 minute delay • Requires password
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isMaintenance}
                  onCheckedChange={() => handleToggleSetting('maintenance_mode', isMaintenance)}
                  disabled={updating === 'maintenance_mode'}
                />
              </div>
            </CardContent>
          </Card>

          {/* Registration Fee - Tier 2 */}
          <Card className="shadow-card border-yellow-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Registration Fee
                <Badge className={`${getTierColor('tier2')} border ml-2`}>RISKY</Badge>
              </CardTitle>
              <CardDescription>Set the registration fee for students (requires justification)</CardDescription>
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
                <Button onClick={() => setShowFeeDialog(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Change Fee
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Current fee: ₦{registrationFee ? Number(registrationFee).toLocaleString() : '...'}
              </p>
            </CardContent>
          </Card>

          {/* Feature Toggles - Tier 2 */}
          <Card className="shadow-card border-yellow-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Power className="h-5 w-5" />
                Feature Toggles
                <Badge className={`${getTierColor('tier2')} border ml-2`}>RISKY</Badge>
              </CardTitle>
              <CardDescription>Control which features are available (requires justification)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'registration_open', icon: Shield, label: 'Registration Open', desc: 'Allow new student registrations' },
                { key: 'payment_enabled', icon: CreditCard, label: 'Payments Enabled', desc: 'Allow payment processing' },
                { key: 'form_submissions_open', icon: FileText, label: 'Form Submissions Open', desc: 'Allow skill form submissions' },
                { key: 'id_generation_enabled', icon: IdCard, label: 'ID Generation Enabled', desc: 'Allow students to generate ID cards' },
                { key: 'edit_requests_enabled', icon: Edit, label: 'Edit Requests Enabled', desc: 'Allow form edit requests' },
              ].map(({ key, icon: Icon, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <Label className="text-base font-medium">{label}</Label>
                      </div>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={getSetting(key)}
                    onCheckedChange={() => handleToggleSetting(key, getSetting(key))}
                    disabled={updating === key || isFrozen}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <SettingsHistory />
        </TabsContent>
      </Tabs>

      {/* Safe Action Dialog */}
      {safeActionDialog && (
        <SafeActionDialog
          open={safeActionDialog.open}
          onOpenChange={(open) => !open && setSafeActionDialog(null)}
          actionType={safeActionDialog.actionType}
          onConfirm={handleSettingConfirm}
          affectedCount={safeActionDialog.affectedCount}
        />
      )}

      {/* Fee Change Dialog */}
      <Dialog open={showFeeDialog} onOpenChange={setShowFeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Change Registration Fee
            </DialogTitle>
            <DialogDescription>
              This change requires justification and will be logged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="border-warning/50 bg-warning/5">
              <Users className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning">Impact Notice</AlertTitle>
              <AlertDescription>
                This will affect all future student registrations.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>New Amount (₦)</Label>
              <Input
                type="number"
                value={registrationFee}
                onChange={(e) => setRegistrationFee(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Justification <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={feeJustification}
                onChange={(e) => setFeeJustification(e.target.value)}
                placeholder="Explain why you are changing the fee..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This will be permanently recorded in the audit log.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeeDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateFee} disabled={savingFee || !feeJustification.trim()}>
              {savingFee && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Fee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SafeSystemControls;
