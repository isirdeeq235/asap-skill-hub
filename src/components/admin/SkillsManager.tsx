import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Edit, Trash2, GraduationCap, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Skill {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

const SkillsManager = () => {
  const { toast } = useToast();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    display_order: 0,
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<Skill | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('available_skills')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setSkills(data || []);
    } catch (error) {
      console.error('Error fetching skills:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch skills',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const logAction = async (actionType: string, targetId: string, metadata: object) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase.from('action_logs').insert([{
        actor_id: user.id,
        action_type: actionType,
        target_table: 'available_skills',
        target_id: targetId,
        metadata,
      }]);
    } catch (error) {
      console.error('Error logging action:', error);
    }
  };

  const handleOpenCreate = () => {
    setEditingSkill(null);
    setFormData({
      name: '',
      description: '',
      is_active: true,
      display_order: skills.length + 1,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setFormData({
      name: skill.name,
      description: skill.description || '',
      is_active: skill.is_active,
      display_order: skill.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Skill name is required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingSkill) {
        const { error } = await supabase
          .from('available_skills')
          .update({
            name: formData.name,
            description: formData.description || null,
            is_active: formData.is_active,
            display_order: formData.display_order,
            updated_by: user?.id,
          })
          .eq('id', editingSkill.id);

        if (error) throw error;

        await logAction('update_skill', editingSkill.id, {
          name: formData.name,
          is_active: formData.is_active,
        });

        toast({ title: 'Skill Updated', description: `"${formData.name}" has been updated` });
      } else {
        const { data, error } = await supabase
          .from('available_skills')
          .insert({
            name: formData.name,
            description: formData.description || null,
            is_active: formData.is_active,
            display_order: formData.display_order,
            created_by: user?.id,
            updated_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;

        await logAction('create_skill', data.id, { name: formData.name });

        toast({ title: 'Skill Created', description: `"${formData.name}" has been added` });
      }

      setIsDialogOpen(false);
      fetchSkills();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save skill',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (skill: Skill) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('available_skills')
        .update({
          is_active: !skill.is_active,
          updated_by: user?.id,
        })
        .eq('id', skill.id);

      if (error) throw error;

      await logAction('toggle_skill_status', skill.id, {
        name: skill.name,
        is_active: !skill.is_active,
      });

      toast({
        title: skill.is_active ? 'Skill Deactivated' : 'Skill Activated',
        description: `"${skill.name}" is now ${skill.is_active ? 'inactive' : 'active'}`,
      });

      fetchSkills();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle skill status',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!skillToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('available_skills')
        .delete()
        .eq('id', skillToDelete.id);

      if (error) throw error;

      await logAction('delete_skill', skillToDelete.id, { name: skillToDelete.name });

      toast({ title: 'Skill Deleted', description: `"${skillToDelete.name}" has been deleted` });
      setDeleteConfirmOpen(false);
      setSkillToDelete(null);
      fetchSkills();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete skill',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Skills Management
              </CardTitle>
              <CardDescription>Manage available skills for student registration</CardDescription>
            </div>
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add Skill
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No skills configured
                    </TableCell>
                  </TableRow>
                ) : (
                  skills.map((skill) => (
                    <TableRow key={skill.id} className={!skill.is_active ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <GripVertical className="w-4 h-4" />
                          {skill.display_order}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{skill.name}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-muted-foreground">
                        {skill.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={skill.is_active}
                            onCheckedChange={() => handleToggleActive(skill)}
                          />
                          <Badge variant={skill.is_active ? 'default' : 'secondary'}>
                            {skill.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleOpenEdit(skill)}>
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setSkillToDelete(skill);
                              setDeleteConfirmOpen(true);
                            }}
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSkill ? 'Edit Skill' : 'Add Skill'}</DialogTitle>
            <DialogDescription>
              {editingSkill ? 'Update skill details' : 'Add a new skill option for students'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Skill Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Web Development"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the skill..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Active (visible to students)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingSkill ? 'Save Changes' : 'Add Skill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Skill</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{skillToDelete?.name}"? Students who selected this skill will keep their existing selection.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SkillsManager;
