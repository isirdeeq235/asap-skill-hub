import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Settings, Lock, Unlock, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AppSetting {
  key: string;
  value: string;
  description: string | null;
}

const SettingsManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  
  // Individual setting states
  const [registrationFee, setRegistrationFee] = useState('');
  const [formSubmissionsOpen, setFormSubmissionsOpen] = useState(true);
  
  // Saving states
  const [savingFee, setSavingFee] = useState(false);
  const [togglingForm, setTogglingForm] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) throw error;

      setSettings(data || []);
      
      // Set individual values
      const fee = data?.find(s => s.key === 'registration_fee');
      if (fee) setRegistrationFee(fee.value);
      
      const formOpen = data?.find(s => s.key === 'form_submissions_open');
      if (formOpen) setFormSubmissionsOpen(formOpen.value === 'true');
      
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
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('app_settings')
        .update({
          value: registrationFee,
          updated_by: userData?.user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('key', 'registration_fee');

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Registration fee updated successfully',
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

  const handleToggleFormSubmissions = async () => {
    setTogglingForm(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const newValue = !formSubmissionsOpen;
      
      const { error } = await supabase
        .from('app_settings')
        .update({
          value: newValue ? 'true' : 'false',
          updated_by: userData?.user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('key', 'form_submissions_open');

      if (error) throw error;

      setFormSubmissionsOpen(newValue);
      toast({
        title: newValue ? 'Form Submissions Opened' : 'Form Submissions Closed',
        description: newValue 
          ? 'Students can now submit new forms' 
          : 'New form submissions are now locked',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle form submissions',
        variant: 'destructive',
      });
    } finally {
      setTogglingForm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Form Submissions */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {formSubmissionsOpen ? (
              <Unlock className="h-5 w-5 text-success" />
            ) : (
              <Lock className="h-5 w-5 text-destructive" />
            )}
            Form Submissions
          </CardTitle>
          <CardDescription>Control whether students can submit new skill forms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={formSubmissionsOpen}
                onCheckedChange={handleToggleFormSubmissions}
                disabled={togglingForm}
              />
              <span className={`font-medium ${formSubmissionsOpen ? 'text-success' : 'text-destructive'}`}>
                {formSubmissionsOpen ? 'Open' : 'Closed'}
              </span>
            </div>
            {togglingForm && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </CardContent>
      </Card>

      {/* All Settings Overview */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            All Settings
          </CardTitle>
          <CardDescription>View all configured settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings.map((setting) => (
              <div key={setting.key} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium">{setting.key}</p>
                  {setting.description && (
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  )}
                </div>
                <code className="px-2 py-1 bg-muted rounded text-sm">{setting.value}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsManagement;
