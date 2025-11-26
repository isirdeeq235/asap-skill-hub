import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Search, CheckCircle, XCircle, Clock, RefreshCw, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentData {
  id: string;
  student_id: string;
  reference: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  student_name: string;
  student_email: string;
  matric_number: string;
}

const AdminPayments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verifyingPayment, setVerifyingPayment] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndFetchPayments();
  }, []);

  useEffect(() => {
    // Set up real-time subscription for payment updates
    const channel = supabase
      .channel('admin-payments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments'
        },
        (payload) => {
          console.log('Real-time payment update:', payload);
          fetchPayments();
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: "New Payment",
              description: "A new payment has been received",
            });
          } else if (payload.eventType === 'UPDATE') {
            toast({
              title: "Payment Updated",
              description: "A payment status has been updated",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAdminAndFetchPayments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/admin/auth");
        return;
      }

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

      await fetchPayments();
    } catch (error) {
      console.error("Error:", error);
      navigate("/admin/auth");
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const { data: paymentsData, error } = await supabase
        .from("payments")
        .select(`
          *,
          profiles!payments_student_id_fkey (
            full_name,
            email,
            matric_number
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedPayments: PaymentData[] = paymentsData?.map((payment: any) => ({
        id: payment.id,
        student_id: payment.student_id,
        reference: payment.reference,
        amount: payment.amount,
        status: payment.status,
        created_at: payment.created_at,
        updated_at: payment.updated_at,
        student_name: payment.profiles?.full_name || "Unknown",
        student_email: payment.profiles?.email || "Unknown",
        matric_number: payment.profiles?.matric_number || "Unknown",
      })) || [];

      setPayments(formattedPayments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast({
        title: "Error",
        description: "Failed to fetch payment data",
        variant: "destructive",
      });
    }
  };

  const handleVerifyPayment = async (paymentId: string, reference: string) => {
    setVerifyingPayment(paymentId);
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
          description: `Payment ${reference} has been verified with Credo and marked as successful`,
        });
        await fetchPayments();
      } else if (data.verified_with_credo) {
        // Payment exists on Credo but is not successful (cancelled, failed, pending, etc.)
        toast({
          title: "Payment Not Successful",
          description: data.message || `Credo status: ${data.credo_status}. Payment remains pending in database.`,
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

  const handleMarkAsFailed = async (paymentId: string, reference: string) => {
    if (!confirm("Are you sure you want to mark this payment as failed?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", paymentId);

      if (error) throw error;

      toast({
        title: "Payment Updated",
        description: `Payment ${reference} has been marked as failed`,
      });

      await fetchPayments();
    } catch (error) {
      console.error("Error updating payment:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update payment status",
        variant: "destructive",
      });
    }
  };

  const handleDeletePayment = async (paymentId: string, reference: string) => {
    if (!confirm("Are you sure you want to delete this pending payment record? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;

      toast({
        title: "Payment Deleted",
        description: `Payment record ${reference} has been removed`,
      });

      await fetchPayments();
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete payment record",
        variant: "destructive",
      });
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-success">
            <CheckCircle className="w-3 h-3" /> Paid
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending
          </Badge>
        );
    }
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.matric_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.student_email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalAmount = filteredPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const successfulPayments = filteredPayments.filter((p) => p.status === "success");
  const totalSuccessAmount = successfulPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/dashboard")}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Payment Management</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredPayments.length}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{successfulPayments.length}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{totalAmount.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">₦{totalSuccessAmount.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>All Payments</CardTitle>
            <CardDescription>Track and verify student payments</CardDescription>
            <div className="flex flex-col md:flex-row gap-4 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name, reference, matric number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Matric Number</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No payments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{payment.student_name}</div>
                            <div className="text-sm text-muted-foreground">{payment.student_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{payment.matric_number}</TableCell>
                        <TableCell className="font-mono text-sm">{payment.reference}</TableCell>
                        <TableCell className="font-semibold">₦{Number(payment.amount).toLocaleString()}</TableCell>
                        <TableCell>{getPaymentBadge(payment.status)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(payment.created_at).toLocaleDateString()}
                            <div className="text-xs text-muted-foreground">
                              {new Date(payment.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {payment.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleVerifyPayment(payment.id, payment.reference)}
                                  disabled={verifyingPayment === payment.id}
                                >
                                  {verifyingPayment === payment.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Verify
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMarkAsFailed(payment.id, payment.reference)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Fail
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeletePayment(payment.id, payment.reference)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
                              </>
                            )}
                            {payment.status === "failed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleVerifyPayment(payment.id, payment.reference)}
                                disabled={verifyingPayment === payment.id}
                              >
                                {verifyingPayment === payment.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Mark Paid
                                  </>
                                )}
                              </Button>
                            )}
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
      </div>
    </div>
  );
};

export default AdminPayments;
