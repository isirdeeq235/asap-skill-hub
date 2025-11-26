import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, LogOut, Search, Users, DollarSign, FileText, CheckCircle, RefreshCw } from "lucide-react";
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
  });
  const [registrationFee, setRegistrationFee] = useState("");
  const [newFee, setNewFee] = useState("");
  const [savingFee, setSavingFee] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState<string | null>(null);

  useEffect(() => {
    checkAdmin();
    fetchRegistrationFee();
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
      setStats({
        total: studentsData.length,
        paid: studentsData.filter((s) => s.payment_status === "success").length,
        submitted: studentsData.filter((s) => s.form_submitted).length,
      });
    } catch (error) {
      console.error("Error fetching students:", error);
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
          title: "Payment Verified",
          description: `Payment has been verified with Credo and marked as successful`,
        });
      } else if (data.success && data.payment_status === 'failed') {
        toast({
          title: "Payment Not Successful",
          description: `Credo reports this payment as ${data.credo_status}. Payment marked as failed.`,
          variant: "destructive",
        });
      } else {
        throw new Error('Verification failed');
      }

      // Refresh data
      await fetchStudents();
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
