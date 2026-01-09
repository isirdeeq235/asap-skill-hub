import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Search, History, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ActionLog {
  id: string;
  actor_id: string;
  actor_name: string;
  action_type: string;
  target_table: string;
  target_id: string;
  metadata: Record<string, any>;
  created_at: string;
}

const ACTION_TYPE_LABELS: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  verify_form: { label: 'Form Verified', variant: 'default' },
  reject_form: { label: 'Form Rejected', variant: 'destructive' },
  verify_payment: { label: 'Payment Verified', variant: 'default' },
  reject_payment: { label: 'Payment Rejected', variant: 'destructive' },
  generate_id: { label: 'ID Generated', variant: 'secondary' },
  update_settings: { label: 'Settings Updated', variant: 'outline' },
  delete_user: { label: 'User Deleted', variant: 'destructive' },
  update_role: { label: 'Role Updated', variant: 'secondary' },
};

const AuditLogsViewer = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('action_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (actionFilter !== 'all') {
        query = query.eq('action_type', actionFilter);
      }

      const { data: logsData, error } = await query;

      if (error) throw error;

      // Fetch actor names
      const actorIds = [...new Set((logsData || []).map(log => log.actor_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', actorIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      const formattedLogs: ActionLog[] = (logsData || []).map(log => ({
        id: log.id,
        actor_id: log.actor_id,
        actor_name: profileMap.get(log.actor_id) || 'Unknown',
        action_type: log.action_type,
        target_table: log.target_table,
        target_id: log.target_id,
        metadata: log.metadata as Record<string, any>,
        created_at: log.created_at,
      }));

      setLogs(formattedLogs);
      setHasMore((logsData || []).length === pageSize);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch audit logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (actionType: string) => {
    const config = ACTION_TYPE_LABELS[actionType] || { label: actionType, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatMetadata = (metadata: Record<string, any>) => {
    if (!metadata) return '-';
    const keys = Object.keys(metadata).slice(0, 3);
    return keys.map(key => `${key}: ${String(metadata[key]).slice(0, 30)}`).join(', ');
  };

  const filteredLogs = logs.filter(log =>
    log.actor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.metadata?.student_name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading && page === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Admin Action Logs
        </CardTitle>
        <CardDescription>
          Immutable audit trail of all admin actions
        </CardDescription>
        <div className="flex flex-col md:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by actor or target..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="verify_form">Form Verified</SelectItem>
              <SelectItem value="reject_form">Form Rejected</SelectItem>
              <SelectItem value="verify_payment">Payment Verified</SelectItem>
              <SelectItem value="delete_user">User Deleted</SelectItem>
              <SelectItem value="update_role">Role Updated</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm">{new Date(log.created_at).toLocaleDateString()}</div>
                      <div className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</div>
                    </TableCell>
                    <TableCell className="font-medium">{log.actor_name}</TableCell>
                    <TableCell>{getActionBadge(log.action_type)}</TableCell>
                    <TableCell>
                      <div className="text-sm">{log.target_table}</div>
                      <div className="text-xs text-muted-foreground font-mono">{log.target_id.slice(0, 8)}...</div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {log.metadata?.student_name && (
                        <span className="font-medium text-foreground">{log.metadata.student_name} - </span>
                      )}
                      {log.metadata?.notes || log.metadata?.new_status || formatMetadata(log.metadata)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Page {page + 1}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore || loading}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AuditLogsViewer;