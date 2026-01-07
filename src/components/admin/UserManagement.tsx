import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Search, Trash2, Shield, User, UserCog, Users, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from '@/hooks/useUserRole';

interface UserWithRole {
  user_id: string;
  full_name: string;
  email: string;
  matric_number: string;
  department: string;
  phone: string;
  roles: AppRole[];
  created_at: string;
}

interface UserManagementProps {
  currentUserId: string;
}

const UserManagement = ({ currentUserId }: UserManagementProps) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // Dialog states
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('student');
  const [savingRole, setSavingRole] = useState(false);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRoles = roles?.filter(r => r.user_id === profile.user_id).map(r => r.role as AppRole) || [];
        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          email: profile.email,
          matric_number: profile.matric_number,
          department: profile.department,
          phone: profile.phone,
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

  const handleEditRole = (user: UserWithRole) => {
    setEditingUser(user);
    setSelectedRole(getHighestRole(user.roles));
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;
    
    setSavingRole(true);
    try {
      // First delete all existing roles for this user
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUser.user_id);

      if (deleteError) throw deleteError;

      // Insert the new role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: editingUser.user_id,
          role: selectedRole,
        });

      if (insertError) throw insertError;

      toast({
        title: 'Role Updated',
        description: `${editingUser.full_name} is now a ${selectedRole.replace('_', ' ')}`,
      });

      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    setDeletingUser(userToDelete.user_id);
    try {
      // Delete profile (cascades to other tables due to foreign keys)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userToDelete.user_id);

      if (error) throw error;

      toast({
        title: 'User Deleted',
        description: `${userToDelete.full_name} has been removed`,
      });

      setConfirmDeleteDialog(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    } finally {
      setDeletingUser(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.matric_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter as AppRole);

    return matchesSearch && matchesRole;
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
          <CardDescription>Manage all users and their roles</CardDescription>
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
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Matric Number</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.matric_number}</TableCell>
                      <TableCell>{user.department}</TableCell>
                      <TableCell>{getRoleBadge(getHighestRole(user.roles))}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditRole(user)}
                            disabled={user.user_id === currentUserId}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit Role
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setUserToDelete(user);
                              setConfirmDeleteDialog(true);
                            }}
                            disabled={user.user_id === currentUserId || user.roles.includes('super_admin')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Change the role for {editingUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
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
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDeleteDialog} onOpenChange={setConfirmDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {userToDelete?.full_name}? This will remove all their data including payments, forms, and profile. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteDialog(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              disabled={!!deletingUser}
            >
              {deletingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserManagement;
