import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, Search, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentData {
  id: string;
  reference: string;
  amount: number;
  status: string;
  created_at: string;
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
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    checkAdmin();
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
          
          // Refresh payments when any change occurs
          fetchPayments();
          
          // Show toast notification for new payments
          if (payload.eventType === 'INSERT') {
            toast({
              title: "New Payment Received",
              description: "A new payment has been recorded",
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
      const { data: paymentsData } = await supabase
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

      if (!paymentsData) return;

      const formattedPayments: PaymentData[] = paymentsData.map((payment: any) => ({
        id: payment.id,
        reference: payment.reference,
        amount: payment.amount,
        status: payment.status,
        created_at: payment.created_at,
        student_name: payment.profiles?.full_name || "N/A",
        student_email: payment.profiles?.email || "N/A",
        matric_number: payment.profiles?.matric_number || "N/A",
      }));

      setPayments(formattedPayments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast({
        title: "Error",
        description: "Failed to fetch payments",
        variant: "destructive",
      });
    }
  };

  const filterPayments = (status?: string) => {
    let filtered = payments;

    if (status && status !== "all") {
      filtered = filtered.filter((p) => p.status === status);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.matric_number.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const exportToCSV = () => {
    const filtered = filterPayments(activeTab);
    
    if (filtered.length === 0) {
      toast({
        title: "No Data",
        description: "No payments to export",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Reference", "Student Name", "Matric Number", "Email", "Amount (₦)", "Status", "Date"];
    const rows = filtered.map((p) => [
      p.reference,
      p.student_name,
      p.matric_number,
      p.student_email,
      p.amount.toFixed(2),
      p.status,
      new Date(p.created_at).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `payments_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Success",
      description: "Payment report exported successfully",
    });
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-success text-success-foreground">Success</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getStats = () => {
    return {
      total: payments.length,
      success: payments.filter((p) => p.status === "success").length,
      pending: payments.filter((p) => p.status === "pending").length,
      failed: payments.filter((p) => p.status === "failed").length,
      revenue: payments
        .filter((p) => p.status === "success")
        .reduce((sum, p) => sum + Number(p.amount), 0),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = getStats();
  const filteredPayments = filterPayments(activeTab);

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
        {/* Stats */}
        <div className="grid md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Successful</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.success}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{stats.revenue.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle>Payment Records</CardTitle>
                  <CardDescription>View and manage all payment transactions</CardDescription>
                </div>
                <Badge variant="outline" className="bg-success/10 text-success border-success">
                  <span className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse"></span>
                  Live
                </Badge>
              </div>
              <Button onClick={exportToCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, reference, or matric number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                <TabsTrigger value="success">Success ({stats.success})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
                <TabsTrigger value="failed">Failed ({stats.failed})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Matric Number</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No payments found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-mono text-sm">{payment.reference}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{payment.student_name}</div>
                                <div className="text-sm text-muted-foreground">{payment.student_email}</div>
                              </div>
                            </TableCell>
                            <TableCell>{payment.matric_number}</TableCell>
                            <TableCell className="font-medium">₦{payment.amount.toLocaleString()}</TableCell>
                            <TableCell>{getPaymentBadge(payment.status)}</TableCell>
                            <TableCell>
                              {new Date(payment.created_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPayments;
