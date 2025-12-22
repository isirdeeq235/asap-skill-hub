import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, LogOut, Search, Users, DollarSign, FileText, CheckCircle, RefreshCw, Edit, X, Check, Lock, Unlock, MessageSquare, Mail, Trash2, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface StudentData {
  user_id: string;
  full_name: string;
  email: string;
  matric_number: string;
  department: string;
  phone: string;
  payment_status: string;
  payment_reference: string | null;
  form_submitted: boolean;
}

interface EditRequest {
  id: string;
  student_id: string;
  reason: string | null;
  status: string;
  requested_at: string;
  student_name?: string;
  student_matric?: string;
}

interface FeedbackMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    submitted: 0,
    pendingEditRequests: 0,
    unreadMessages: 0,
  });
  const [registrationFee, setRegistrationFee] = useState("");
  const [newFee, setNewFee] = useState("");
  const [savingFee, setSavingFee] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState<string | null>(null);
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [formSubmissionsOpen, setFormSubmissionsOpen] = useState(true);
  const [togglingFormLock, setTogglingFormLock] = useState(false);
  const [feedbackMessages, setFeedbackMessages] = useState<FeedbackMessage[]>([]);
  const [deletingMessage, setDeletingMessage] = useState<string | null>(null);

  useEffect(() => {
    checkAdmin();
    fetchRegistrationFee();
    fetchEditRequests();
    fetchFormLockStatus();
    fetchFeedbackMessages();
  }, []);

  useEffect(() => {
    // Set up real-time subscription for payment updates
    const channel = supabase
      .channel('admin-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments'
        },
        (payload) => {
          console.log('Real-time payment update:', payload);
          
          // Refresh student data when payment changes
          fetchStudents();
          
          // Show toast notification for new payments
          if (payload.eventType === 'INSERT') {
            toast({
              title: "New Payment",
              description: "A student has made a new payment",
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

      await fetchStudents();
    } catch (error) {
      console.error("Error checking admin:", error);
      navigate("/admin/auth");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      // Fetch all profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!profiles) return;

      // Fetch payments (latest for each student)
      const { data: payments } = await supabase
        .from("payments")
        .select("student_id, status, reference, created_at")
        .order("created_at", { ascending: false });

      // Get latest payment for each student
      const latestPayments = payments?.reduce((acc, payment) => {
        if (!acc[payment.student_id] || new Date(payment.created_at) > new Date(acc[payment.student_id].created_at)) {
          acc[payment.student_id] = payment;
        }
        return acc;
      }, {} as Record<string, any>);

      // Fetch skill forms
      const { data: forms } = await supabase
        .from("skill_forms")
        .select("student_id");

      // Combine data
      const studentsData: StudentData[] = profiles.map((profile) => {
        const payment = latestPayments?.[profile.user_id];
        const form = forms?.find((f) => f.student_id === profile.user_id);

        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          email: profile.email,
          matric_number: profile.matric_number,
          department: profile.department,
          phone: profile.phone,
          payment_status: payment?.status || "pending",
          payment_reference: payment?.reference || null,
          form_submitted: !!form,
        };
      });

      setStudents(studentsData);

      // Calculate stats
      setStats(prev => ({
        ...prev,
        total: studentsData.length,
        paid: studentsData.filter((s) => s.payment_status === "success").length,
        submitted: studentsData.filter((s) => s.form_submitted).length,
      }));
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  const fetchEditRequests = async () => {
    try {
      // Fetch pending edit requests
      const { data: requests, error } = await supabase
        .from("edit_requests")
        .select("*")
        .eq("status", "pending")
        .order("requested_at", { ascending: false });

      if (error) throw error;

      if (!requests || requests.length === 0) {
        setEditRequests([]);
        setStats(prev => ({ ...prev, pendingEditRequests: 0 }));
        return;
      }

      // Fetch student profiles for each request
      const studentIds = requests.map(r => r.student_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, matric_number")
        .in("user_id", studentIds);

      // Combine data
      const enrichedRequests: EditRequest[] = requests.map(request => {
        const profile = profiles?.find(p => p.user_id === request.student_id);
        return {
          ...request,
          student_name: profile?.full_name || "Unknown",
          student_matric: profile?.matric_number || "N/A",
        };
      });

      setEditRequests(enrichedRequests);
      setStats(prev => ({ ...prev, pendingEditRequests: enrichedRequests.length }));
    } catch (error) {
      console.error("Error fetching edit requests:", error);
    }
  };

  const fetchFeedbackMessages = async () => {
    try {
      const { data: messages, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setFeedbackMessages(messages || []);
      const unreadCount = messages?.filter(m => !m.is_read).length || 0;
      setStats(prev => ({ ...prev, unreadMessages: unreadCount }));
    } catch (error) {
      console.error("Error fetching feedback messages:", error);
    }
  };

  const handleToggleReadStatus = async (messageId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("feedback")
        .update({ is_read: !currentStatus })
        .eq("id", messageId);

      if (error) throw error;

      fetchFeedbackMessages();
    } catch (error) {
      console.error("Error updating message status:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setDeletingMessage(messageId);
    try {
      const { error } = await supabase
        .from("feedback")
        .delete()
        .eq("id", messageId);

      if (error) throw error;

      toast({
        title: "Message Deleted",
        description: "The message has been removed",
      });

      fetchFeedbackMessages();
    } catch (error: any) {
      console.error("Error deleting message:", error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    } finally {
      setDeletingMessage(null);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("edit_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Request Approved",
        description: "The student can now edit their form",
      });

      fetchEditRequests();
    } catch (error: any) {
      console.error("Error approving request:", error);
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive",
      });
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("edit_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Request Rejected",
        description: "The edit request has been rejected",
      });

      fetchEditRequests();
    } catch (error: any) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive",
      });
    } finally {
      setProcessingRequest(null);
    }
  };

  const fetchRegistrationFee = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'registration_fee')
        .single();

      if (error) throw error;
      
      if (data) {
        setRegistrationFee(data.value);
        setNewFee(data.value);
      }
    } catch (error) {
      console.error('Error fetching registration fee:', error);
    }
  };

  const fetchFormLockStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'form_submissions_open')
        .single();

      if (error) throw error;
      
      if (data) {
        setFormSubmissionsOpen(data.value === 'true');
      }
    } catch (error) {
      console.error('Error fetching form lock status:', error);
    }
  };

  const handleToggleFormLock = async () => {
    setTogglingFormLock(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const newValue = !formSubmissionsOpen;
      
      const { error } = await supabase
        .from('app_settings')
        .update({ 
          value: newValue ? 'true' : 'false',
          updated_by: userData?.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('key', 'form_submissions_open');

      if (error) throw error;

      setFormSubmissionsOpen(newValue);
      toast({
        title: newValue ? "Form Submissions Opened" : "Form Submissions Closed",
        description: newValue 
          ? "Students can now submit new forms" 
          : "New form submissions are now locked",
      });
    } catch (error) {
      console.error('Error toggling form lock:', error);
      toast({
        title: "Error",
        description: "Failed to update form submission status",
        variant: "destructive",
      });
    } finally {
      setTogglingFormLock(false);
    }
  };

  const handleUpdateFee = async () => {
    if (!newFee || isNaN(Number(newFee)) || Number(newFee) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    setSavingFee(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('app_settings')
        .update({ 
          value: newFee,
          updated_by: userData?.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('key', 'registration_fee');

      if (error) throw error;

      setRegistrationFee(newFee);
      toast({
        title: "Success",
        description: "Registration fee updated successfully",
      });
    } catch (error) {
      console.error('Error updating registration fee:', error);
      toast({
        title: "Error",
        description: "Failed to update registration fee",
        variant: "destructive",
      });
    } finally {
      setSavingFee(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const filteredStudents = students.filter(
    (student) =>
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.matric_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleVerifyPayment = async (studentId: string, reference: string | null) => {
    if (!reference) {
      toast({
        title: "No Payment Reference",
        description: "This student hasn't made a payment yet",
        variant: "destructive",
      });
      return;
    }

    setVerifyingPayment(studentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call edge function to verify with Credo
      const { data, error } = await supabase.functions.invoke('verify-payment-status', {
        body: { reference },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.success && data.payment_status === 'success') {
        toast({
          title: "Payment Verified Successfully",
          description: `Payment has been verified with Credo and marked as successful`,
        });
        await fetchStudents();
      } else if (data.verified_with_credo) {
        // Payment exists on Credo but is not successful (cancelled, failed, pending, etc.)
        toast({
          title: "Payment Not Successful",
          description: data.message || `Credo status: ${data.credo_status}. Payment remains pending.`,
          variant: "destructive",
        });
      } else {
        // Payment not found on Credo or API error
        toast({
          title: "Payment Not Found",
          description: data.message || "Payment not found on Credo. It may have been cancelled.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error verifying payment:", error);
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify payment with Credo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setVerifyingPayment(null);
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-success">Paid</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

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
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Quick Actions */}
        <Card className="mb-8 shadow-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/admin/forms")} variant="default">
              <FileText className="w-4 h-4 mr-2" />
              View Submitted Forms
            </Button>
            <Button onClick={() => navigate("/admin/payments")} variant="outline">
              <DollarSign className="w-4 h-4 mr-2" />
              Manage Payments
            </Button>
          </CardContent>
        </Card>

        {/* Form Submissions Lock */}
        <Card className="mb-8 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {formSubmissionsOpen ? (
                <Unlock className="h-5 w-5 text-success" />
              ) : (
                <Lock className="h-5 w-5 text-destructive" />
              )}
              Form Submissions
            </CardTitle>
            <CardDescription>
              Control whether students can submit new skill acquisition forms
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={formSubmissionsOpen}
                onCheckedChange={handleToggleFormLock}
                disabled={togglingFormLock}
              />
              <span className={`font-medium ${formSubmissionsOpen ? 'text-success' : 'text-destructive'}`}>
                {formSubmissionsOpen ? 'Open' : 'Closed'}
              </span>
            </div>
            {togglingFormLock && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Paid Students</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.paid}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Forms Submitted</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.submitted}</div>
            </CardContent>
          </Card>
        </div>

        {/* Edit Requests Section */}
        {editRequests.length > 0 && (
          <Card className="mb-8 shadow-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                Pending Edit Requests
                <Badge variant="secondary">{editRequests.length}</Badge>
              </CardTitle>
              <CardDescription>Students requesting permission to edit their forms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {editRequests.map((request) => (
                  <div key={request.id} className="flex items-start justify-between p-4 border border-border rounded-lg bg-muted/30">
                    <div className="space-y-1">
                      <p className="font-medium">{request.student_name}</p>
                      <p className="text-sm text-muted-foreground">Matric: {request.student_matric}</p>
                      {request.reason && (
                        <p className="text-sm text-muted-foreground mt-2">
                          <span className="font-medium">Reason:</span> {request.reason}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Requested: {new Date(request.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApproveRequest(request.id)}
                        disabled={processingRequest === request.id}
                      >
                        {processingRequest === request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRejectRequest(request.id)}
                        disabled={processingRequest === request.id}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feedback Messages Section */}
        <Card className="mb-8 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Messages & Feedback
              {stats.unreadMessages > 0 && (
                <Badge variant="default">{stats.unreadMessages} unread</Badge>
              )}
            </CardTitle>
            <CardDescription>Contact messages and feedback from visitors</CardDescription>
          </CardHeader>
          <CardContent>
            {feedbackMessages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No messages yet</p>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {feedbackMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`p-4 border rounded-lg transition-colors ${
                      msg.is_read 
                        ? 'border-border bg-muted/20' 
                        : 'border-primary/30 bg-primary/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{msg.name}</span>
                          <Badge variant={msg.type === 'contact' ? 'outline' : 'secondary'}>
                            {msg.type === 'contact' ? (
                              <><Mail className="h-3 w-3 mr-1" /> Contact</>
                            ) : (
                              <><MessageSquare className="h-3 w-3 mr-1" /> Feedback</>
                            )}
                          </Badge>
                          {!msg.is_read && <Badge variant="default">New</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{msg.email}</p>
                        {msg.subject && (
                          <p className="text-sm font-medium">Subject: {msg.subject}</p>
                        )}
                        <p className="text-sm mt-2">{msg.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleToggleReadStatus(msg.id, msg.is_read)}
                          title={msg.is_read ? "Mark as unread" : "Mark as read"}
                        >
                          {msg.is_read ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteMessage(msg.id)}
                          disabled={deletingMessage === msg.id}
                        >
                          {deletingMessage === msg.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings Section */}
        <Card className="mb-8 shadow-card">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Configure application settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Registration Fee (₦)
                </label>
                <div className="flex gap-4 items-center">
                  <Input
                    type="number"
                    value={newFee}
                    onChange={(e) => setNewFee(e.target.value)}
                    placeholder="Enter fee amount"
                    className="max-w-xs"
                  />
                  <Button 
                    onClick={handleUpdateFee}
                    disabled={savingFee || newFee === registrationFee}
                  >
                    {savingFee ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Current fee: ₦{registrationFee ? Number(registrationFee).toLocaleString() : '...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Students Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>All Students</CardTitle>
            <CardDescription>Manage student registrations and payments</CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, matric number, or department..."
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
                    <TableHead>Name</TableHead>
                    <TableHead>Matric Number</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.user_id}>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell>{student.matric_number}</TableCell>
                      <TableCell>{student.department}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{getPaymentBadge(student.payment_status)}</TableCell>
                      <TableCell>
                        {student.form_submitted ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.payment_status === "pending" && student.payment_reference && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerifyPayment(student.user_id, student.payment_reference)}
                            disabled={verifyingPayment === student.user_id}
                          >
                            {verifyingPayment === student.user_id ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Verifying...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Verify
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
