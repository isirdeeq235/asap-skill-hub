import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Clock, XCircle, CheckCircle, AlertTriangle, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getActionConfig, getTierColor, getTierLabel } from '@/lib/actionTiers';

interface PendingAction {
  id: string;
  actor_id: string;
  action_type: string;
  action_tier: string;
  payload: any;
  target_table: string | null;
  target_id: string | null;
  justification: string;
  scheduled_for: string;
  status: string;
  affected_users_count: number;
  created_at: string;
}

const PendingActionsManager = () => {
  const { toast } = useToast();
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialog, setCancelDialog] = useState<PendingAction | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPendingActions();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchPendingActions, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingActions = async () => {
    try {
      const { data, error } = await supabase
        .from('pending_actions')
        .select('*')
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      setActions(data || []);
    } catch (error) {
      console.error('Error fetching pending actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelDialog) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('pending_actions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_reason: cancelReason || 'No reason provided',
        })
        .eq('id', cancelDialog.id)
        .eq('status', 'pending');

      if (error) throw error;

      // Log the cancellation
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('action_logs').insert([{
          actor_id: user.id,
          action_type: 'cancel_pending_action',
          target_table: 'pending_actions',
          target_id: cancelDialog.id,
          metadata: {
            original_action: cancelDialog.action_type,
            cancel_reason: cancelReason,
          } as any,
        }]);
      }

      toast({
        title: 'Action Cancelled',
        description: 'The pending action has been cancelled and will not execute.',
      });

      setCancelDialog(null);
      setCancelReason('');
      fetchPendingActions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel action',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getTimeRemaining = (scheduledFor: string): string => {
    const scheduled = new Date(scheduledFor);
    const now = new Date();
    const diff = scheduled.getTime() - now.getTime();

    if (diff <= 0) return 'Executing...';

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'executed':
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle className="w-3 h-3 mr-1" />Executed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/10 text-red-500"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      case 'expired':
        return <Badge variant="secondary"><Pause className="w-3 h-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingActions = actions.filter(a => a.status === 'pending');
  const historyActions = actions.filter(a => a.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Pending Actions Alert */}
      {pendingActions.length > 0 && (
        <Alert className="border-warning/50 bg-warning/5">
          <Clock className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">
            {pendingActions.length} Pending Action{pendingActions.length !== 1 ? 's' : ''}
          </AlertTitle>
          <AlertDescription>
            These actions are scheduled to execute soon. You can cancel them before they run.
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Actions */}
      <Card className="shadow-card border-warning/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Pending Actions
          </CardTitle>
          <CardDescription>Actions waiting to be executed (cancelable)</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingActions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending actions</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Time Remaining</TableHead>
                    <TableHead>Affected Users</TableHead>
                    <TableHead>Justification</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingActions.map((action) => {
                    const config = getActionConfig(action.action_type);
                    return (
                      <TableRow key={action.id} className="bg-warning/5">
                        <TableCell className="font-medium">{config.label}</TableCell>
                        <TableCell>
                          <Badge className={`${getTierColor(config.tier)} border`}>
                            {getTierLabel(config.tier)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-warning">
                            {getTimeRemaining(action.scheduled_for)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {action.affected_users_count > 0 && (
                            <Badge variant="outline">{action.affected_users_count} users</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {action.justification}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setCancelDialog(action)}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action History */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Recent Action History
          </CardTitle>
          <CardDescription>Previously scheduled actions</CardDescription>
        </CardHeader>
        <CardContent>
          {historyActions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No action history</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scheduled For</TableHead>
                    <TableHead>Justification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyActions.slice(0, 10).map((action) => {
                    const config = getActionConfig(action.action_type);
                    return (
                      <TableRow key={action.id}>
                        <TableCell className="font-medium">{config.label}</TableCell>
                        <TableCell>{getStatusBadge(action.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(action.scheduled_for).toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-muted-foreground">
                          {action.justification}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={() => {
        setCancelDialog(null);
        setCancelReason('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Cancel Pending Action
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this scheduled action?
            </DialogDescription>
          </DialogHeader>
          {cancelDialog && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="font-medium">{getActionConfig(cancelDialog.action_type).label}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Scheduled for: {new Date(cancelDialog.scheduled_for).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Original justification: {cancelDialog.justification}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Reason for Cancellation (optional)</Label>
                <Textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Why are you cancelling this action?"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCancelDialog(null);
              setCancelReason('');
            }}>
              Keep Scheduled
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancel Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingActionsManager;
