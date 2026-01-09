import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, History, RotateCcw, Eye, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SettingsVersion {
  id: string;
  setting_key: string;
  old_value: string | null;
  new_value: string;
  changed_by: string | null;
  change_reason: string | null;
  is_rollback: boolean;
  created_at: string;
}

interface SettingsHistoryProps {
  settingKey?: string;
}

const SettingsHistory = ({ settingKey }: SettingsHistoryProps) => {
  const { toast } = useToast();
  const [history, setHistory] = useState<SettingsVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollbackDialog, setRollbackDialog] = useState<SettingsVersion | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [settingKey]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('app_settings_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (settingKey) {
        query = query.eq('setting_key', settingKey);
      }

      const { data, error } = await query;
      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching settings history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!rollbackDialog) return;

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get current value
      const { data: currentSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', rollbackDialog.setting_key)
        .single();

      // Update setting to old value
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({
          value: rollbackDialog.old_value || rollbackDialog.new_value,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('key', rollbackDialog.setting_key);

      if (updateError) throw updateError;

      // Record rollback in history
      await supabase.from('app_settings_history').insert([{
        setting_key: rollbackDialog.setting_key,
        old_value: currentSetting?.value,
        new_value: rollbackDialog.old_value || rollbackDialog.new_value,
        changed_by: user?.id,
        change_reason: `Rolled back to version from ${new Date(rollbackDialog.created_at).toLocaleString()}`,
        is_rollback: true,
        rolled_back_from: rollbackDialog.id,
      }]);

      // Log action
      await supabase.from('action_logs').insert([{
        actor_id: user?.id,
        action_type: 'rollback_setting',
        target_table: 'app_settings',
        target_id: rollbackDialog.setting_key,
        metadata: {
          setting_key: rollbackDialog.setting_key,
          restored_to: rollbackDialog.old_value,
          from_version_id: rollbackDialog.id,
        } as any,
      }]);

      toast({
        title: 'Setting Restored',
        description: `${rollbackDialog.setting_key} has been rolled back.`,
      });

      setRollbackDialog(null);
      fetchHistory();
    } catch (error: any) {
      toast({
        title: 'Rollback Failed',
        description: error.message || 'Failed to restore setting',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
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
    <>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Settings Version History
          </CardTitle>
          <CardDescription>
            All setting changes are versioned. Click "Restore" to rollback to any previous version.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No history recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setting</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((version, index) => (
                    <TableRow key={version.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {version.setting_key}
                          </code>
                          {version.is_rollback && (
                            <Badge variant="secondary" className="text-xs">
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Rollback
                            </Badge>
                          )}
                          {index === 0 && (
                            <Badge className="bg-green-500/10 text-green-500 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Current
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {version.old_value && (
                            <div className="text-muted-foreground">
                              <span className="line-through">{version.old_value}</span>
                            </div>
                          )}
                          <div className="font-medium text-green-600">→ {version.new_value}</div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {version.change_reason || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(version.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {index !== 0 && version.old_value && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRollbackDialog(version)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Restore
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={!!rollbackDialog} onOpenChange={() => setRollbackDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Restore Previous Version
            </DialogTitle>
            <DialogDescription>
              This will restore the setting to its previous value. This action will be logged.
            </DialogDescription>
          </DialogHeader>
          {rollbackDialog && (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Setting:</p>
                <code className="font-medium">{rollbackDialog.setting_key}</code>
              </div>
              <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg space-y-2">
                <p className="text-sm text-green-600">Will be restored to:</p>
                <p className="font-medium">{rollbackDialog.old_value}</p>
                <p className="text-xs text-muted-foreground">
                  From: {new Date(rollbackDialog.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackDialog(null)}>Cancel</Button>
            <Button onClick={handleRollback} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Restore This Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SettingsHistory;
