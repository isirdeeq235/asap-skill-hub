import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, LogOut, Search, ArrowLeft, DollarSign, RotateCcw, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

interface PaymentData {
  id: string;
  student_id: string;
  student_name: string;
  matric_number: string;
  email: string;
  amount: number;
  reference: string;
  status: string;
  created_at: string;
  refunded_at: string | null;
  refund_amount: number | null;
  refund_reason: string | null;
  refunded_by: string | null;
}

const AdminRefunds = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "refunded">("all");
  const [refundDialog, setRefundDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentData | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
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
      console.error("Error checking admin:", error);
      navigate("/admin/auth");
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          profiles:student_id (
            full_name,
            matric_number,
            email
          )
        `)
        .eq("status", "success")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedData: PaymentData[] = data.map((payment: any) => ({
          id: payment.id,
          student_id: payment.student_id,
          student_name: payment.profiles?.full_name || "N/A",
          matric_number: payment.profiles?.matric_number || "N/A",
          email: payment.profiles?.email || "N/A",
          amount: payment.amount,
          reference: payment.reference,
          status: payment.status,
          created_at: payment.created_at,
          refunded_at: payment.refunded_at,
          refund_amount: payment.refund_amount,
          refund_reason: payment.refund_reason,
          refunded_by: payment.refunded_by,
        }));

        setPayments(formattedData);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast({
        title: "Error",
        description: "Failed to fetch payments",
        variant: "destructive",
      });
    }
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;

    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0 || amount > selectedPayment.amount) {
      toast({
        title: "Invalid Amount",
        description: `Please enter a valid amount between ₦1 and ₦${selectedPayment.amount.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    if (!refundReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for the refund",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("payments")
        .update({
          refunded_at: new Date().toISOString(),
          refund_amount: amount,
          refund_reason: refundReason,
          refunded_by: user?.id,
        })
        .eq("id", selectedPayment.id);

      if (error) throw error;

      toast({
        title: "Refund Processed",
        description: `Successfully refunded ₦${amount.toLocaleString()} to ${selectedPayment.student_name}`,
      });

      setRefundDialog(false);
      setSelectedPayment(null);
      setRefundAmount("");
      setRefundReason("");
      await fetchPayments();
    } catch (error) {
      console.error("Error processing refund:", error);
      toast({
        title: "Refund Failed",
        description: "Failed to process refund. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const openRefundDialog = (payment: PaymentData) => {
    setSelectedPayment(payment);
    setRefundAmount(payment.amount.toString());
    setRefundReason("");
    setRefundDialog(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.matric_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.reference.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === "all" ? true : payment.refunded_at !== null;

    return matchesSearch && matchesTab;
  });

  const stats = {
    total: payments.length,
    refunded: payments.filter((p) => p.refunded_at).length,
    totalRefunded: payments
      .filter((p) => p.refunded_at)
      .reduce((sum, p) => sum + (p.refund_amount || 0), 0),
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
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Refund Management</h1>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Refunded</CardTitle>
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.refunded}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Refunded Amount</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{stats.totalRefunded.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Payment Records</CardTitle>
            <CardDescription>Process refunds for successful payments</CardDescription>
            
            {/* Tabs */}
            <div className="flex gap-2 mt-4">
              <Button
                variant={activeTab === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("all")}
              >
                All Payments
              </Button>
              <Button
                variant={activeTab === "refunded" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("refunded")}
              >
                Refunded Only
              </Button>
            </div>

            {/* Search */}
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, matric number, or reference..."
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
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No payments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.student_name}</TableCell>
                        <TableCell>{payment.matric_number}</TableCell>
                        <TableCell>₦{payment.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{payment.reference}</TableCell>
                        <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {payment.refunded_at ? (
                            <Badge variant="secondary" className="bg-orange-500/20 text-orange-700">
                              Refunded ₦{payment.refund_amount?.toLocaleString()}
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-success">Paid</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!payment.refunded_at ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRefundDialog(payment)}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Refund
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {new Date(payment.refunded_at).toLocaleDateString()}
                            </span>
                          )}
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

      {/* Refund Dialog */}
      <Dialog open={refundDialog} onOpenChange={setRefundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Refund payment for {selectedPayment?.student_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Student Details</Label>
              <div className="text-sm text-muted-foreground mt-1">
                <p>{selectedPayment?.student_name}</p>
                <p>{selectedPayment?.email}</p>
                <p>Matric: {selectedPayment?.matric_number}</p>
              </div>
            </div>
            <div>
              <Label htmlFor="refund-amount">Refund Amount (₦)</Label>
              <Input
                id="refund-amount"
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Enter amount"
                max={selectedPayment?.amount}
                min={1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Original amount: ₦{selectedPayment?.amount.toLocaleString()}
              </p>
            </div>
            <div>
              <Label htmlFor="refund-reason">Reason for Refund</Label>
              <Textarea
                id="refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Explain why this payment is being refunded..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRefund} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Process Refund"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRefunds;
