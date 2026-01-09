import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Search, Shield, User, UserCog, Users, MoreHorizontal, Lock, Unlock, Ban, RotateCcw, Trash2, Edit, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from '@/hooks/useUserRole';

interface UserWithRole {
  user_id: string;
  full_name: string;
  email: string;
  matric_number: string;
  department: string;
  phone: string;
  application_status: string;
  account_locked: boolean;
  banned: boolean;
  banned_reason: string | null;
  roles: AppRole[];
  created_at: string;
}

interface EnhancedUserManagementProps {
  currentUserId: string;
}

const EnhancedUserManagement = ({ currentUserId }: EnhancedUserManagementProps) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Dialog states
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('student');
  const [savingRole, setSavingRole] = useState(false);
  
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'delete' | 'ban' | 'unban' | 'lock' | 'unlock' | 'reset';
    user: UserWithRole | null;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [viewingUser, setViewingUser] = useState<UserWithRole | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRoles = roles?.filter(r => r.user_id === profile.user_id).map(r => r.role as AppRole) || [];
        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          email: profile.email,
          matric_number: profile.matric_number,
          department: profile.department,
          phone: profile.phone,
          application_status: profile.application_status,
          account_locked: profile.account_locked || false,
          banned: profile.banned || false,
          banned_reason: profile.banned_reason,
          roles: userRoles,
          created_at: profile.created_at,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const logAction = async (actionType: string, targetId: string, metadata: Record<string, unknown>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase.from('action_logs').insert([{
        actor_id: user.id,
        action_type: actionType,
        target_table: 'profiles',
        target_id: targetId,
        metadata: metadata as any,
      }]);
    } catch (error) {
      console.error('Error logging action:', error);
    }
  };

  const getHighestRole = (roles: AppRole[]): AppRole => {
    const hierarchy: AppRole[] = ['super_admin', 'admin', 'moderator', 'student'];
    for (const role of hierarchy) {
      if (roles.includes(role)) return role;
    }
    return 'student';
  };

  const getRoleBadge = (role: AppRole) => {
    switch (role) {
      case 'super_admin':
        return <Badge className="bg-destructive text-destructive-foreground"><Shield className="w-3 h-3 mr-1" />Super Admin</Badge>;
      case 'admin':
        return <Badge className="bg-primary text-primary-foreground"><UserCog className="w-3 h-3 mr-1" />Admin</Badge>;
      case 'moderator':
        return <Badge variant="secondary"><Users className="w-3 h-3 mr-1" />Moderator</Badge>;
      default:
        return <Badge variant="outline"><User className="w-3 h-3 mr-1" />Student</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      unpaid: 'bg-muted text-muted-foreground',
      paid: 'bg-blue-500/10 text-blue-500',
      form_submitted: 'bg-yellow-500/10 text-yellow-500',
      form_verified: 'bg-green-500/10 text-green-500',
      form_rejected: 'bg-red-500/10 text-red-500',
      id_generated: 'bg-purple-500/10 text-purple-500',
    };
    return <Badge className={colors[status] || 'bg-muted'}>{status.replace('_', ' ')}</Badge>;
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;
    
    setSavingRole(true);
    try {
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUser.user_id);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: editingUser.user_id, role: selectedRole });

      if (insertError) throw insertError;

      await logAction('change_user_role', editingUser.user_id, {
        user_email: editingUser.email,
        old_role: getHighestRole(editingUser.roles),
        new_role: selectedRole,
      });

      toast({
        title: 'Role Updated',
        description: `${editingUser.full_name} is now a ${selectedRole.replace('_', ' ')}`,
      });

      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    } finally {
      setSavingRole(false);
    }
  };

  const handleAction = async () => {
    if (!confirmDialog?.user) return;
    
    const { action, user } = confirmDialog;
    setProcessing(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      switch (action) {
        case 'lock':
          await supabase.from('profiles').update({
            account_locked: true,
            locked_at: new Date().toISOString(),
            locked_by: currentUser?.id,
          }).eq('user_id', user.user_id);
          await logAction('lock_account', user.user_id, { user_email: user.email, reason: actionReason });
          toast({ title: 'Account Locked', description: `${user.full_name}'s account is now locked` });
          break;

        case 'unlock':
          await supabase.from('profiles').update({
            account_locked: false,
            locked_at: null,
            locked_by: null,
          }).eq('user_id', user.user_id);
          await logAction('unlock_account', user.user_id, { user_email: user.email });
          toast({ title: 'Account Unlocked', description: `${user.full_name}'s account is now unlocked` });
          break;

        case 'ban':
          await supabase.from('profiles').update({
            banned: true,
            banned_reason: actionReason,
          }).eq('user_id', user.user_id);
          await logAction('ban_user', user.user_id, { user_email: user.email, reason: actionReason });
          toast({ title: 'User Banned', description: `${user.full_name} has been banned` });
          break;

        case 'unban':
          await supabase.from('profiles').update({
            banned: false,
            banned_reason: null,
          }).eq('user_id', user.user_id);
          await logAction('unban_user', user.user_id, { user_email: user.email });
          toast({ title: 'User Unbanned', description: `${user.full_name} has been unbanned` });
          break;

        case 'reset':
          // Reset application status and delete related data
          await supabase.from('skill_forms').delete().eq('student_id', user.user_id);
          await supabase.from('id_cards').delete().eq('user_id', user.user_id);
          await supabase.from('edit_requests').delete().eq('student_id', user.user_id);
          await supabase.from('profiles').update({
            application_status: 'unpaid',
          }).eq('user_id', user.user_id);
          await logAction('reset_application', user.user_id, { user_email: user.email, reason: actionReason });
          toast({ title: 'Application Reset', description: `${user.full_name}'s application has been reset` });
          break;

        case 'delete':
          await supabase.from('profiles').delete().eq('user_id', user.user_id);
          await logAction('delete_user', user.user_id, { user_email: user.email, reason: actionReason });
          toast({ title: 'User Deleted', description: `${user.full_name} has been deleted` });
          break;
      }

      setConfirmDialog(null);
      setActionReason('');
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${action} user`,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleChangeStatus = async (userId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ application_status: newStatus as any })
        .eq('user_id', userId);

      if (error) throw error;

      await logAction('change_application_status', userId, { new_status: newStatus });

      toast({ title: 'Status Updated', description: `Application status changed to ${newStatus}` });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.matric_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter as AppRole);
    const matchesStatus = statusFilter === 'all' || user.application_status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

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
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>Full control over users, roles, and application status</CardDescription>
          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, email, or matric number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="form_submitted">Form Submitted</SelectItem>
                <SelectItem value="form_verified">Form Verified</SelectItem>
                <SelectItem value="form_rejected">Form Rejected</SelectItem>
                <SelectItem value="id_generated">ID Generated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.user_id} className={user.banned ? 'bg-destructive/5' : user.account_locked ? 'bg-warning/5' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground">{user.matric_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(getHighestRole(user.roles))}</TableCell>
                      <TableCell>{getStatusBadge(user.application_status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {user.banned && <Badge variant="destructive"><Ban className="w-3 h-3 mr-1" />Banned</Badge>}
                          {user.account_locked && <Badge variant="secondary"><Lock className="w-3 h-3 mr-1" />Locked</Badge>}
                          {!user.banned && !user.account_locked && <Badge variant="outline">Active</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingUser(user)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setEditingUser(user);
                                setSelectedRole(getHighestRole(user.roles));
                              }}
                              disabled={user.user_id === currentUserId}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Change Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.account_locked ? (
                              <DropdownMenuItem onClick={() => setConfirmDialog({ open: true, action: 'unlock', user })}>
                                <Unlock className="w-4 h-4 mr-2" />
                                Unlock Account
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setConfirmDialog({ open: true, action: 'lock', user })}>
                                <Lock className="w-4 h-4 mr-2" />
                                Lock Account
                              </DropdownMenuItem>
                            )}
                            {user.banned ? (
                              <DropdownMenuItem onClick={() => setConfirmDialog({ open: true, action: 'unban', user })}>
                                <User className="w-4 h-4 mr-2" />
                                Unban User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => setConfirmDialog({ open: true, action: 'ban', user })}
                                className="text-destructive"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Ban User
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => setConfirmDialog({ open: true, action: 'reset', user })}
                              className="text-warning"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Reset Application
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setConfirmDialog({ open: true, action: 'delete', user })}
                              className="text-destructive"
                              disabled={user.user_id === currentUserId || user.roles.includes('super_admin')}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View User Dialog */}
      <Dialog open={!!viewingUser} onOpenChange={() => setViewingUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Full Name</Label>
                  <p className="font-medium">{viewingUser.full_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{viewingUser.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Matric Number</Label>
                  <p className="font-medium">{viewingUser.matric_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Department</Label>
                  <p className="font-medium">{viewingUser.department}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{viewingUser.phone}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Role</Label>
                  <div className="mt-1">{getRoleBadge(getHighestRole(viewingUser.roles))}</div>
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Application Status</Label>
                <Select 
                  value={viewingUser.application_status} 
                  onValueChange={(v) => handleChangeStatus(viewingUser.user_id, v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="form_submitted">Form Submitted</SelectItem>
                    <SelectItem value="form_verified">Form Verified</SelectItem>
                    <SelectItem value="form_rejected">Form Rejected</SelectItem>
                    <SelectItem value="id_generated">ID Generated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {viewingUser.banned && viewingUser.banned_reason && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <Label className="text-destructive">Ban Reason</Label>
                  <p className="text-sm">{viewingUser.banned_reason}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>Update role for {editingUser?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleSaveRole} disabled={savingRole}>
              {savingRole && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog?.open} onOpenChange={() => {
        setConfirmDialog(null);
        setActionReason('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.action === 'delete' && 'Delete User'}
              {confirmDialog?.action === 'ban' && 'Ban User'}
              {confirmDialog?.action === 'unban' && 'Unban User'}
              {confirmDialog?.action === 'lock' && 'Lock Account'}
              {confirmDialog?.action === 'unlock' && 'Unlock Account'}
              {confirmDialog?.action === 'reset' && 'Reset Application'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.action === 'delete' && `Are you sure you want to permanently delete ${confirmDialog.user?.full_name}?`}
              {confirmDialog?.action === 'ban' && `Ban ${confirmDialog?.user?.full_name} from the system?`}
              {confirmDialog?.action === 'unban' && `Restore access for ${confirmDialog?.user?.full_name}?`}
              {confirmDialog?.action === 'lock' && `Lock ${confirmDialog?.user?.full_name}'s account?`}
              {confirmDialog?.action === 'unlock' && `Unlock ${confirmDialog?.user?.full_name}'s account?`}
              {confirmDialog?.action === 'reset' && `Reset ${confirmDialog?.user?.full_name}'s application? This will delete their form and ID card data.`}
            </DialogDescription>
          </DialogHeader>
          {(confirmDialog?.action === 'ban' || confirmDialog?.action === 'lock' || confirmDialog?.action === 'reset' || confirmDialog?.action === 'delete') && (
            <div className="py-4">
              <Label>Reason (optional)</Label>
              <Textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Enter reason for this action..."
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setConfirmDialog(null);
              setActionReason('');
            }}>Cancel</Button>
            <Button 
              variant={confirmDialog?.action === 'unban' || confirmDialog?.action === 'unlock' ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={processing}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EnhancedUserManagement;
