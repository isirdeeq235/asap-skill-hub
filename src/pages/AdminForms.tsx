import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, LogOut, Search, Download, FileText, ArrowLeft, Grid, List, Edit, Lock, Unlock, CheckCircle, XCircle, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface FormData {
  id: string;
  student_id: string;
  student_name: string;
  matric_number: string;
  department: string;
  email: string;
  phone: string;
  skill_choice: string;
  level: string;
  reason: string;
  additional_info: string | null;
  photo_url: string | null;
  submitted_at: string;
  access_blocked: boolean;
  has_pending_edit_request: boolean;
  has_approved_edit_request: boolean;
}

const AdminForms = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<FormData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "gallery">("table");
  
  // Edit form dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormData | null>(null);
  const [editFormData, setEditFormData] = useState({
    skill_choice: "",
    level: "",
    reason: "",
    additional_info: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  // Real-time subscription for form updates
  useEffect(() => {
    const channel = supabase
      .channel('skill-forms-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'skill_forms'
        },
        (payload) => {
          console.log('Real-time form update:', payload);
          fetchForms();
          
          if (payload.eventType === 'UPDATE') {
            toast({
              title: "Form Updated",
              description: "A student has updated their skill form",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/admin/auth");
        return;
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/admin/auth");
        return;
      }

      await fetchForms();
    } catch (error) {
      console.error("Error checking admin:", error);
      navigate("/admin/auth");
    } finally {
      setLoading(false);
    }
  };

  const fetchForms = async () => {
    try {
      // Fetch forms with profiles
      const { data: formsData, error: formsError } = await supabase
        .from("skill_forms")
        .select(`
          *,
          profiles:student_id (
            full_name,
            matric_number,
            department,
            email,
            phone
          )
        `)
        .order("submitted_at", { ascending: false });

      if (formsError) throw formsError;

      // Fetch all edit requests to check status
      const { data: editRequests } = await supabase
        .from("edit_requests")
        .select("student_id, status");

      if (formsData) {
        const formattedData: FormData[] = formsData.map((form: any) => {
          const studentEditRequests = editRequests?.filter(r => r.student_id === form.student_id) || [];
          const hasPending = studentEditRequests.some(r => r.status === "pending");
          const hasApproved = studentEditRequests.some(r => r.status === "approved");

          return {
            id: form.id,
            student_id: form.student_id,
            student_name: form.profiles?.full_name || "N/A",
            matric_number: form.profiles?.matric_number || "N/A",
            department: form.profiles?.department || "N/A",
            email: form.profiles?.email || "N/A",
            phone: form.profiles?.phone || "N/A",
            skill_choice: form.skill_choice,
            level: form.level,
            reason: form.reason,
            additional_info: form.additional_info,
            photo_url: form.photo_url,
            submitted_at: form.submitted_at,
            access_blocked: form.access_blocked || false,
            has_pending_edit_request: hasPending,
            has_approved_edit_request: hasApproved,
          };
        });

        setForms(formattedData);
      }
    } catch (error) {
      console.error("Error fetching forms:", error);
      toast({
        title: "Error",
        description: "Failed to fetch skill forms",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    if (filteredForms.length === 0) {
      toast({
        title: "No Data",
        description: "No forms to export",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Student Name",
      "Matric Number",
      "Department",
      "Email",
      "Phone",
      "Skill Choice",
      "Level",
      "Reason",
      "Additional Info",
      "Submitted At"
    ];

    const csvContent = [
      headers.join(","),
      ...filteredForms.map(form =>
        [
          `"${form.student_name}"`,
          `"${form.matric_number}"`,
          `"${form.department}"`,
          `"${form.email}"`,
          `"${form.phone}"`,
          `"${form.skill_choice}"`,
          `"${form.level}"`,
          `"${form.reason.replace(/"/g, '""')}"`,
          `"${form.additional_info?.replace(/"/g, '""') || 'N/A'}"`,
          `"${new Date(form.submitted_at).toLocaleString()}"`
        ].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `skill_forms_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `Exported ${filteredForms.length} forms to CSV`,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Open edit dialog
  const openEditDialog = (form: FormData) => {
    setEditingForm(form);
    setEditFormData({
      skill_choice: form.skill_choice,
      level: form.level,
      reason: form.reason,
      additional_info: form.additional_info || "",
    });
    setEditDialogOpen(true);
  };

  // Save edited form
  const handleSaveForm = async () => {
    if (!editingForm) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("skill_forms")
        .update({
          skill_choice: editFormData.skill_choice,
          level: editFormData.level,
          reason: editFormData.reason,
          additional_info: editFormData.additional_info || null,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", editingForm.id);

      if (error) throw error;

      toast({
        title: "Form Updated",
        description: "The skill form has been updated successfully",
      });
      
      setEditDialogOpen(false);
      fetchForms();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update form",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Toggle access blocked
  const handleToggleAccess = async (form: FormData) => {
    try {
      const { error } = await supabase
        .from("skill_forms")
        .update({ access_blocked: !form.access_blocked })
        .eq("id", form.id);

      if (error) throw error;

      toast({
        title: form.access_blocked ? "Access Restored" : "Access Blocked",
        description: form.access_blocked 
          ? `${form.student_name} can now view their form` 
          : `${form.student_name} can no longer view their form`,
      });
      
      fetchForms();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update access",
        variant: "destructive",
      });
    }
  };

  // Grant edit access
  const handleGrantEditAccess = async (form: FormData) => {
    try {
      // Check if there's a pending request to approve
      const { data: pendingRequest } = await supabase
        .from("edit_requests")
        .select("id")
        .eq("student_id", form.student_id)
        .eq("status", "pending")
        .maybeSingle();

      if (pendingRequest) {
        // Approve the pending request
        const { error } = await supabase
          .from("edit_requests")
          .update({ 
            status: "approved", 
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", pendingRequest.id);

        if (error) throw error;
      } else {
        // Create a new approved edit request
        const { error } = await supabase
          .from("edit_requests")
          .insert({
            student_id: form.student_id,
            status: "approved",
            reason: "Granted by admin",
            reviewed_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      toast({
        title: "Edit Access Granted",
        description: `${form.student_name} can now edit their form`,
      });
      
      fetchForms();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to grant edit access",
        variant: "destructive",
      });
    }
  };

  // Revoke edit access
  const handleRevokeEditAccess = async (form: FormData) => {
    try {
      // Update any approved edit requests to denied
      const { error } = await supabase
        .from("edit_requests")
        .update({ 
          status: "denied", 
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("student_id", form.student_id)
        .eq("status", "approved");

      if (error) throw error;

      toast({
        title: "Edit Access Revoked",
        description: `${form.student_name} can no longer edit their form`,
      });
      
      fetchForms();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke edit access",
        variant: "destructive",
      });
    }
  };

  const filteredForms = forms.filter(
    (form) =>
      form.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.matric_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.skill_choice.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Submitted Skill Forms</h1>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Card */}
        <Card className="mb-8 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Total Submissions</CardTitle>
              <CardDescription>All skill acquisition forms submitted by students</CardDescription>
            </div>
            <Badge variant="default" className="text-lg px-4 py-2">
              <FileText className="w-4 h-4 mr-2" />
              {forms.length}
            </Badge>
          </CardHeader>
        </Card>

        {/* Forms Table/Gallery */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>All Submitted Forms</CardTitle>
                <CardDescription>View and export student skill forms</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex border border-border rounded-md">
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className="rounded-r-none"
                  >
                    <List className="w-4 h-4 mr-2" />
                    Table
                  </Button>
                  <Button
                    variant={viewMode === "gallery" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("gallery")}
                    className="rounded-l-none"
                  >
                    <Grid className="w-4 h-4 mr-2" />
                    Gallery
                  </Button>
                </div>
                <Button onClick={exportToCSV} disabled={filteredForms.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export to CSV
                </Button>
              </div>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, matric number, skill, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "table" ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Matric Number</TableHead>
                      <TableHead>Department</TableHead>
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
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          {searchQuery ? "No forms found matching your search" : "No forms submitted yet"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredForms.map((form) => (
                        <TableRow key={form.id} className={form.access_blocked ? "opacity-60" : ""}>
                          <TableCell className="font-medium">{form.student_name}</TableCell>
                          <TableCell>{form.matric_number}</TableCell>
                          <TableCell>{form.department}</TableCell>
                          <TableCell>{form.skill_choice}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{form.level}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {form.access_blocked && (
                                <Badge variant="destructive" className="text-xs">
                                  <Lock className="w-3 h-3 mr-1" />
                                  Blocked
                                </Badge>
                              )}
                              {form.has_approved_edit_request && (
                                <Badge variant="default" className="text-xs bg-green-600">
                                  <Edit className="w-3 h-3 mr-1" />
                                  Can Edit
                                </Badge>
                              )}
                              {form.has_pending_edit_request && (
                                <Badge variant="outline" className="text-xs">
                                  Pending Request
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(form.submitted_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  toast({
                                    title: form.student_name,
                                    description: (
                                      <div className="mt-2 space-y-1 text-sm">
                                        <p><strong>Email:</strong> {form.email}</p>
                                        <p><strong>Phone:</strong> {form.phone}</p>
                                        <p><strong>Skill:</strong> {form.skill_choice}</p>
                                        <p><strong>Level:</strong> {form.level}</p>
                                        <p><strong>Reason:</strong> {form.reason}</p>
                                        {form.additional_info && (
                                          <p><strong>Additional Info:</strong> {form.additional_info}</p>
                                        )}
                                      </div>
                                    ),
                                  });
                                }}>
                                  <FileText className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditDialog(form)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit Form
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {form.has_approved_edit_request ? (
                                  <DropdownMenuItem onClick={() => handleRevokeEditAccess(form)}>
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Revoke Edit Access
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleGrantEditAccess(form)}>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Grant Edit Access
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleToggleAccess(form)}
                                  className={form.access_blocked ? "text-green-600" : "text-destructive"}
                                >
                                  {form.access_blocked ? (
                                    <>
                                      <Unlock className="w-4 h-4 mr-2" />
                                      Restore Access
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="w-4 h-4 mr-2" />
                                      Block Access
                                    </>
                                  )}
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
            ) : (
              <div>
                {filteredForms.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {searchQuery ? "No forms found matching your search" : "No forms submitted yet"}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredForms.map((form) => (
                      <Card key={form.id} className={`overflow-hidden hover:shadow-lg transition-shadow ${form.access_blocked ? "opacity-60" : ""}`}>
                        <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                          {form.photo_url ? (
                            <img
                              src={form.photo_url}
                              alt={`${form.student_name}'s photo`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FileText className="w-16 h-16 text-muted-foreground" />
                            </div>
                          )}
                          {/* Status badges overlay */}
                          <div className="absolute top-2 right-2 flex flex-col gap-1">
                            {form.access_blocked && (
                              <Badge variant="destructive" className="text-xs">
                                <Lock className="w-3 h-3 mr-1" />
                                Blocked
                              </Badge>
                            )}
                            {form.has_approved_edit_request && (
                              <Badge variant="default" className="text-xs bg-green-600">
                                <Edit className="w-3 h-3 mr-1" />
                                Can Edit
                              </Badge>
                            )}
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg mb-1 truncate">{form.student_name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{form.matric_number}</p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Skill:</span>
                              <span className="text-sm font-medium truncate ml-2">{form.skill_choice}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Level:</span>
                              <Badge variant="secondary" className="text-xs">{form.level}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Department:</span>
                              <span className="text-xs truncate ml-2">{form.department}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Submitted:</span>
                              <span className="text-xs">{new Date(form.submitted_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => openEditDialog(form)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  toast({
                                    title: form.student_name,
                                    description: (
                                      <div className="mt-2 space-y-1 text-sm">
                                        <p><strong>Email:</strong> {form.email}</p>
                                        <p><strong>Phone:</strong> {form.phone}</p>
                                        <p><strong>Matric:</strong> {form.matric_number}</p>
                                        <p><strong>Department:</strong> {form.department}</p>
                                        <p><strong>Skill:</strong> {form.skill_choice}</p>
                                        <p><strong>Level:</strong> {form.level}</p>
                                        <p><strong>Reason:</strong> {form.reason}</p>
                                        {form.additional_info && (
                                          <p><strong>Additional Info:</strong> {form.additional_info}</p>
                                        )}
                                      </div>
                                    ),
                                  });
                                }}>
                                  <FileText className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {form.has_approved_edit_request ? (
                                  <DropdownMenuItem onClick={() => handleRevokeEditAccess(form)}>
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Revoke Edit
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleGrantEditAccess(form)}>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Grant Edit
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleToggleAccess(form)}
                                  className={form.access_blocked ? "text-green-600" : "text-destructive"}
                                >
                                  {form.access_blocked ? (
                                    <>
                                      <Unlock className="w-4 h-4 mr-2" />
                                      Restore Access
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="w-4 h-4 mr-2" />
                                      Block Access
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Form Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Skill Form</DialogTitle>
            <DialogDescription>
              Update form details for {editingForm?.student_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-skill">Skill Choice</Label>
              <Select 
                value={editFormData.skill_choice} 
                onValueChange={(value) => setEditFormData({...editFormData, skill_choice: value})}
              >
                <SelectTrigger id="edit-skill">
                  <SelectValue placeholder="Select a skill" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Web Development">Web Development</SelectItem>
                  <SelectItem value="Mobile App Development">Mobile App Development</SelectItem>
                  <SelectItem value="Data Science">Data Science</SelectItem>
                  <SelectItem value="Cybersecurity">Cybersecurity</SelectItem>
                  <SelectItem value="Cloud Computing">Cloud Computing</SelectItem>
                  <SelectItem value="UI/UX Design">UI/UX Design</SelectItem>
                  <SelectItem value="Digital Marketing">Digital Marketing</SelectItem>
                  <SelectItem value="Graphic Design">Graphic Design</SelectItem>
                  <SelectItem value="Video Editing">Video Editing</SelectItem>
                  <SelectItem value="Photography">Photography</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-level">Level</Label>
              <Select 
                value={editFormData.level} 
                onValueChange={(value) => setEditFormData({...editFormData, level: value})}
              >
                <SelectTrigger id="edit-level">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ND1">ND1</SelectItem>
                  <SelectItem value="ND2">ND2</SelectItem>
                  <SelectItem value="HND1">HND1</SelectItem>
                  <SelectItem value="HND2">HND2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reason">Reason for Choosing This Skill</Label>
              <Textarea
                id="edit-reason"
                value={editFormData.reason}
                onChange={(e) => setEditFormData({...editFormData, reason: e.target.value})}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-additional">Additional Information</Label>
              <Textarea
                id="edit-additional"
                value={editFormData.additional_info}
                onChange={(e) => setEditFormData({...editFormData, additional_info: e.target.value})}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveForm} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminForms;
