import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Trash2, Edit, FileText, Eye, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SkillFormData {
  id: string;
  student_id: string;
  student_name: string;
  matric_number: string;
  skill_choice: string;
  level: string;
  reason: string;
  additional_info: string | null;
  photo_url: string | null;
  submitted_at: string;
  access_blocked: boolean;
  verification_notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  application_status: string;
}

const ContentManagement = () => {
  const { toast } = useToast();
  const [forms, setForms] = useState<SkillFormData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit dialog
  const [editingForm, setEditingForm] = useState<SkillFormData | null>(null);
  const [editData, setEditData] = useState({
    skill_choice: '',
    level: '',
    reason: '',
    additional_info: '',
  });
  const [saving, setSaving] = useState(false);
  
  // Delete dialog
  const [deletingForm, setDeletingForm] = useState<SkillFormData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // View dialog
  const [viewingForm, setViewingForm] = useState<SkillFormData | null>(null);

  // Verify/Reject dialog
  const [actionForm, setActionForm] = useState<SkillFormData | null>(null);
  const [actionType, setActionType] = useState<'verify' | 'reject' | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isActioning, setIsActioning] = useState(false);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      setLoading(true);
      
      const { data: formsData, error } = await supabase
        .from('skill_forms')
        .select(`
          *,
          profiles:student_id (
            full_name,
            matric_number,
            application_status
          )
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      const formatted: SkillFormData[] = (formsData || []).map((form: any) => ({
        id: form.id,
        student_id: form.student_id,
        student_name: form.profiles?.full_name || 'Unknown',
        matric_number: form.profiles?.matric_number || 'N/A',
        skill_choice: form.skill_choice,
        level: form.level,
        reason: form.reason,
        additional_info: form.additional_info,
        photo_url: form.photo_url,
        submitted_at: form.submitted_at,
        access_blocked: form.access_blocked,
        verification_notes: form.verification_notes,
        verified_by: form.verified_by,
        verified_at: form.verified_at,
        application_status: form.profiles?.application_status || 'form_submitted',
      }));

      setForms(formatted);
    } catch (error) {
      console.error('Error fetching forms:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch skill forms',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (form: SkillFormData) => {
    setEditingForm(form);
    setEditData({
      skill_choice: form.skill_choice,
      level: form.level,
      reason: form.reason,
      additional_info: form.additional_info || '',
    });
  };

  const handleSave = async () => {
    if (!editingForm) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('skill_forms')
        .update({
          skill_choice: editData.skill_choice,
          level: editData.level,
          reason: editData.reason,
          additional_info: editData.additional_info || null,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', editingForm.id);

      if (error) throw error;

      toast({
        title: 'Form Updated',
        description: 'The skill form has been updated successfully',
      });

      setEditingForm(null);
      fetchForms();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update form',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingForm) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('skill_forms')
        .delete()
        .eq('id', deletingForm.id);

      if (error) throw error;

      toast({
        title: 'Form Deleted',
        description: `${deletingForm.student_name}'s form has been deleted`,
      });

      setDeletingForm(null);
      fetchForms();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete form',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVerifyReject = async () => {
    if (!actionForm || !actionType) return;
    if (actionType === 'reject' && !verificationNotes.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for rejection',
        variant: 'destructive',
      });
      return;
    }

    setIsActioning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const newStatus = actionType === 'verify' ? 'form_verified' : 'form_rejected';

      // Update skill_forms with verification info
      const { error: formError } = await supabase
        .from('skill_forms')
        .update({
          verification_notes: verificationNotes || null,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', actionForm.id);

      if (formError) throw formError;

      // Update profile application_status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ application_status: newStatus })
        .eq('user_id', actionForm.student_id);

      if (profileError) throw profileError;

      // Log the action
      await supabase.from('action_logs').insert({
        actor_id: user.id,
        action_type: actionType === 'verify' ? 'verify_form' : 'reject_form',
        target_table: 'skill_forms',
        target_id: actionForm.id,
        metadata: {
          student_id: actionForm.student_id,
          student_name: actionForm.student_name,
          notes: verificationNotes || null,
          new_status: newStatus,
        },
      });

      toast({
        title: actionType === 'verify' ? 'Form Verified' : 'Form Rejected',
        description: `${actionForm.student_name}'s form has been ${actionType === 'verify' ? 'verified' : 'rejected'}`,
      });

      setActionForm(null);
      setActionType(null);
      setVerificationNotes('');
      fetchForms();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${actionType} form`,
        variant: 'destructive',
      });
    } finally {
      setIsActioning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'form_verified':
        return <Badge className="bg-success">Verified</Badge>;
      case 'form_rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'id_generated':
        return <Badge className="bg-primary">ID Generated</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const filteredForms = forms.filter(form =>
    form.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    form.matric_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    form.skill_choice.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <FileText className="h-5 w-5" />
            Skill Forms Management
          </CardTitle>
          <CardDescription>Verify, edit or delete student skill forms</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name, matric number, or skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Matric Number</TableHead>
                  <TableHead>Skill Choice</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredForms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No forms found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredForms.map((form) => (
                    <TableRow key={form.id}>
                      <TableCell className="font-medium">{form.student_name}</TableCell>
                      <TableCell>{form.matric_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{form.skill_choice}</Badge>
                      </TableCell>
                      <TableCell>{form.level}</TableCell>
                      <TableCell>{getStatusBadge(form.application_status)}</TableCell>
                      <TableCell>{new Date(form.submitted_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewingForm(form)}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          {form.application_status === 'form_submitted' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-success hover:text-success"
                                onClick={() => {
                                  setActionForm(form);
                                  setActionType('verify');
                                  setVerificationNotes('');
                                }}
                              >
                                <CheckCircle className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setActionForm(form);
                                  setActionType('reject');
                                  setVerificationNotes('');
                                }}
                              >
                                <XCircle className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(form)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingForm(form)}
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

      {/* View Dialog */}
      <Dialog open={!!viewingForm} onOpenChange={() => setViewingForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>View Skill Form</DialogTitle>
            <DialogDescription>
              Submitted by {viewingForm?.student_name}
            </DialogDescription>
          </DialogHeader>
          {viewingForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Matric Number</Label>
                  <p className="font-medium">{viewingForm.matric_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Skill Choice</Label>
                  <p className="font-medium">{viewingForm.skill_choice}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Level</Label>
                  <p className="font-medium">{viewingForm.level}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(viewingForm.application_status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p className="font-medium">{new Date(viewingForm.submitted_at).toLocaleString()}</p>
                </div>
                {viewingForm.verified_at && (
                  <div>
                    <Label className="text-muted-foreground">Verified At</Label>
                    <p className="font-medium">{new Date(viewingForm.verified_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground">Reason</Label>
                <p className="mt-1">{viewingForm.reason}</p>
              </div>
              {viewingForm.additional_info && (
                <div>
                  <Label className="text-muted-foreground">Additional Info</Label>
                  <p className="mt-1">{viewingForm.additional_info}</p>
                </div>
              )}
              {viewingForm.verification_notes && (
                <div>
                  <Label className="text-muted-foreground">Verification Notes</Label>
                  <p className="mt-1">{viewingForm.verification_notes}</p>
                </div>
              )}
              {viewingForm.photo_url && (
                <div>
                  <Label className="text-muted-foreground">Photo</Label>
                  <img 
                    src={viewingForm.photo_url} 
                    alt="Student" 
                    className="mt-2 w-32 h-32 object-cover rounded-lg"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingForm(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify/Reject Dialog */}
      <Dialog open={!!actionForm && !!actionType} onOpenChange={() => { setActionForm(null); setActionType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === 'verify' ? 'Verify Form' : 'Reject Form'}</DialogTitle>
            <DialogDescription>
              {actionType === 'verify' 
                ? `Confirm verification of ${actionForm?.student_name}'s skill form`
                : `Provide a reason for rejecting ${actionForm?.student_name}'s form`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{actionType === 'verify' ? 'Notes (Optional)' : 'Rejection Reason (Required)'}</Label>
              <Textarea
                placeholder={actionType === 'verify' ? 'Add any notes...' : 'Explain why this form is being rejected...'}
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionForm(null); setActionType(null); }}>Cancel</Button>
            <Button 
              onClick={handleVerifyReject} 
              disabled={isActioning}
              variant={actionType === 'reject' ? 'destructive' : 'default'}
            >
              {isActioning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {actionType === 'verify' ? 'Verify Form' : 'Reject Form'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingForm} onOpenChange={() => setEditingForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Skill Form</DialogTitle>
            <DialogDescription>
              Editing form for {editingForm?.student_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Skill Choice</Label>
              <Select value={editData.skill_choice} onValueChange={(v) => setEditData({ ...editData, skill_choice: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Web Development">Web Development</SelectItem>
                  <SelectItem value="Mobile App Development">Mobile App Development</SelectItem>
                  <SelectItem value="Data Science">Data Science</SelectItem>
                  <SelectItem value="Cybersecurity">Cybersecurity</SelectItem>
                  <SelectItem value="UI/UX Design">UI/UX Design</SelectItem>
                  <SelectItem value="Cloud Computing">Cloud Computing</SelectItem>
                  <SelectItem value="Digital Marketing">Digital Marketing</SelectItem>
                  <SelectItem value="Graphics Design">Graphics Design</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Level</Label>
              <Select value={editData.level} onValueChange={(v) => setEditData({ ...editData, level: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ND I">ND I</SelectItem>
                  <SelectItem value="ND II">ND II</SelectItem>
                  <SelectItem value="HND I">HND I</SelectItem>
                  <SelectItem value="HND II">HND II</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={editData.reason}
                onChange={(e) => setEditData({ ...editData, reason: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Additional Info</Label>
              <Textarea
                value={editData.additional_info}
                onChange={(e) => setEditData({ ...editData, additional_info: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingForm(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deletingForm} onOpenChange={() => setDeletingForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Skill Form</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingForm?.student_name}'s skill form? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingForm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ContentManagement;