import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, LogOut, CreditCard, FileText, CheckCircle, XCircle, Clock, RefreshCw, Download, Edit, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface Profile {
  full_name: string;
  email: string;
  phone: string;
  matric_number: string;
  department: string;
}

interface Payment {
  id: string;
  status: string;
  amount: number;
  reference: string;
  created_at: string;
}

interface SkillForm {
  skill_choice: string;
  submitted_at: string;
  level: string;
  reason: string;
  additional_info: string | null;
}

interface EditRequest {
  id: string;
  status: string;
  reason: string | null;
  requested_at: string;
  reviewed_at: string | null;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [skillForm, setSkillForm] = useState<SkillForm | null>(null);
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
  const [requestingEdit, setRequestingEdit] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [showEditRequestForm, setShowEditRequestForm] = useState(false);
  const [formSubmissionsOpen, setFormSubmissionsOpen] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  // Auto-refresh payment status every 30 seconds if pending
  useEffect(() => {
    if (!payment || payment.status !== "pending") {
      return;
    }

    const interval = setInterval(async () => {
      console.log("Auto-checking payment status...");
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;

        const { data: paymentData } = await supabase
          .from("payments")
          .select("*")
          .eq("student_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (paymentData && paymentData.status !== payment.status) {
          setPayment(paymentData);
          
          if (paymentData.status === "success") {
            toast({
              title: "Payment Confirmed!",
              description: "Your payment has been verified successfully.",
            });
          }
        }
      } catch (error) {
        console.error("Error auto-checking payment:", error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [payment?.status]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/student/auth");
        return;
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch latest payment status
      const { data: paymentData } = await supabase
        .from("payments")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentData) {
        setPayment(paymentData);
      }

      // Fetch payment history
      const { data: historyData } = await supabase
        .from("payments")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (historyData) {
        setPaymentHistory(historyData);
      }

      // Fetch skill form
      const { data: formData } = await supabase
        .from("skill_forms")
        .select("*")
        .eq("student_id", user.id)
        .maybeSingle();

      if (formData) {
        setSkillForm(formData);
      }

      // Fetch latest edit request
      const { data: editRequestData } = await supabase
        .from("edit_requests")
        .select("*")
        .eq("student_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (editRequestData) {
        setEditRequest(editRequestData);
      }

      // Fetch form submission lock status
      const { data: formLockSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "form_submissions_open")
        .single();

      if (formLockSetting) {
        setFormSubmissionsOpen(formLockSetting.value === "true");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEdit = async () => {
    if (!editReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for requesting edit access",
        variant: "destructive",
      });
      return;
    }

    setRequestingEdit(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("edit_requests").insert({
        student_id: user.id,
        reason: editReason.trim(),
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Request Submitted",
        description: "Your edit request has been submitted. Please wait for admin approval.",
      });

      setShowEditRequestForm(false);
      setEditReason("");
      
      // Refresh edit request status
      const { data: editRequestData } = await supabase
        .from("edit_requests")
        .select("*")
        .eq("student_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (editRequestData) {
        setEditRequest(editRequestData);
      }
    } catch (error: any) {
      console.error("Error requesting edit:", error);
      toast({
        title: "Request Failed",
        description: error.message || "Failed to submit edit request",
        variant: "destructive",
      });
    } finally {
      setRequestingEdit(false);
    }
  };

  const getEditRequestBadge = () => {
    if (!editRequest) return null;
    
    switch (editRequest.status) {
      case "approved":
        return <Badge variant="default" className="bg-success">Edit Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Edit Rejected</Badge>;
      case "used":
        return null; // Don't show badge for used/completed edits
      case "pending":
        return <Badge variant="secondary">Edit Pending</Badge>;
      default:
        return null;
    }
  };

  const handleVerifyPayment = async () => {
    setVerifying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Re-fetch payment status from database
      const { data: paymentData, error } = await supabase
        .from("payments")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (paymentData) {
        setPayment(paymentData);
        
        if (paymentData.status === "success") {
          toast({
            title: "Payment Verified!",
            description: "Your payment has been confirmed successfully.",
          });
        } else if (paymentData.status === "pending") {
          toast({
            title: "Payment Still Pending",
            description: "Your payment is being processed. Please wait a few minutes.",
            variant: "default",
          });
        } else {
          toast({
            title: "Payment Status Updated",
            description: `Current status: ${paymentData.status}`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "No Payment Found",
          description: "No payment record found for your account.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
      toast({
        title: "Verification Failed",
        description: "Failed to verify payment status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleDownloadReceipt = () => {
    if (!payment || !profile) return;

    const doc = new jsPDF();
    
    // Colors
    const primaryColor = [41, 128, 185]; // Blue
    const textColor = [44, 62, 80]; // Dark gray
    const lightGray = [236, 240, 241];

    // Header with background
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 50, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont(undefined, 'bold');
    doc.text('PAYMENT RECEIPT', 105, 25, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text('Skill Acquisition Registration', 105, 35, { align: 'center' });

    // Reset text color
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    // Receipt details box
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.rect(15, 60, 180, 25, 'F');
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Receipt Number:', 20, 70);
    doc.setFont(undefined, 'normal');
    doc.text(payment.reference, 60, 70);
    
    doc.setFont(undefined, 'bold');
    doc.text('Date:', 20, 78);
    doc.setFont(undefined, 'normal');
    doc.text(new Date(payment.created_at).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }), 60, 78);

    // Student Information Section
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Student Information', 20, 100);
    
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(20, 102, 190, 102);

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Full Name:', 20, 112);
    doc.setFont(undefined, 'normal');
    doc.text(profile.full_name, 60, 112);

    doc.setFont(undefined, 'bold');
    doc.text('Matric Number:', 20, 122);
    doc.setFont(undefined, 'normal');
    doc.text(profile.matric_number, 60, 122);

    doc.setFont(undefined, 'bold');
    doc.text('Department:', 20, 132);
    doc.setFont(undefined, 'normal');
    doc.text(profile.department, 60, 132);

    doc.setFont(undefined, 'bold');
    doc.text('Email:', 20, 142);
    doc.setFont(undefined, 'normal');
    doc.text(profile.email, 60, 142);

    doc.setFont(undefined, 'bold');
    doc.text('Phone:', 20, 152);
    doc.setFont(undefined, 'normal');
    doc.text(profile.phone, 60, 152);

    // Payment Details Section
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Payment Details', 20, 172);
    
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.line(20, 174, 190, 174);

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Description:', 20, 184);
    doc.setFont(undefined, 'normal');
    doc.text('Skill Acquisition Registration Fee', 60, 184);

    doc.setFont(undefined, 'bold');
    doc.text('Payment Method:', 20, 194);
    doc.setFont(undefined, 'normal');
    doc.text('Online Payment', 60, 194);

    doc.setFont(undefined, 'bold');
    doc.text('Transaction ID:', 20, 204);
    doc.setFont(undefined, 'normal');
    doc.text(payment.reference, 60, 204);

    doc.setFont(undefined, 'bold');
    doc.text('Status:', 20, 214);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(46, 125, 50); // Green
    doc.text('PAID', 60, 214);

    // Amount box with highlight
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.rect(15, 225, 180, 20, 'F');
    
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Total Amount:', 20, 237);
    doc.setFontSize(16);
    doc.text(`₦${payment.amount.toLocaleString()}`, 170, 237, { align: 'right' });

    // Footer
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text('This is a computer-generated receipt and requires no signature.', 105, 265, { align: 'center' });
    doc.text('For inquiries, please contact the administration office.', 105, 270, { align: 'center' });
    
    // Generated timestamp
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 280, { align: 'center' });

    // Save the PDF
    doc.save(`Receipt_${payment.reference}.pdf`);
    
    toast({
      title: "Receipt Downloaded",
      description: "Your payment receipt has been downloaded successfully.",
    });
  };

  const getPaymentStatusBadge = () => {
    if (!payment) {
      return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="w-3 h-3" /> Not Paid</Badge>;
    }
    
    switch (payment.status) {
      case "success":
        return <Badge variant="default" className="flex items-center gap-1 bg-success"><CheckCircle className="w-3 h-3" /> Paid</Badge>;
      case "failed":
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</Badge>;
      default:
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
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
          <h1 className="text-2xl font-bold text-foreground">Student Dashboard</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/student/profile")}>
              Profile
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Profile Card */}
        <Card className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Your registered details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{profile?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Matric Number</p>
                <p className="font-medium">{profile?.matric_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{profile?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-medium">{profile?.department}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{profile?.phone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Status Card */}
        <Card className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Payment Status
              {getPaymentStatusBadge()}
            </CardTitle>
            <CardDescription>Registration fee payment</CardDescription>
          </CardHeader>
          <CardContent>
            {!payment || payment.status !== "success" ? (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  You need to complete the payment to access the skill acquisition form.
                </p>
                <div className="flex flex-col md:flex-row gap-3">
                  <Button onClick={() => navigate("/student/payment")} className="w-full md:w-auto">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay Now
                  </Button>
                  {payment && payment.status === "pending" && (
                    <Button 
                      onClick={handleVerifyPayment} 
                      variant="outline" 
                      className="w-full md:w-auto"
                      disabled={verifying}
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Verify Payment
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-success font-medium">Payment completed successfully!</p>
                  <p className="text-sm text-muted-foreground">
                    Amount: ₦{payment.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paid on: {new Date(payment.created_at).toLocaleDateString()} at {new Date(payment.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleDownloadReceipt}
                  className="w-full md:w-auto"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Receipt
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment History Card */}
        {paymentHistory.length > 0 && (
          <Card className="mb-6 shadow-card">
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>All your payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paymentHistory.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex-1 space-y-1">
                      <p className="font-medium">₦{payment.amount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.created_at).toLocaleDateString()} at {new Date(payment.created_at).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Ref: {payment.reference}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {payment.status === "success" ? (
                        <>
                          <Badge variant="default" className="bg-success">Paid</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const successPayment = payment;
                              const doc = new jsPDF();
                              
                              const primaryColor = [41, 128, 185];
                              const textColor = [44, 62, 80];
                              const lightGray = [236, 240, 241];

                              doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                              doc.rect(0, 0, 210, 50, 'F');

                              doc.setTextColor(255, 255, 255);
                              doc.setFontSize(28);
                              doc.setFont(undefined, 'bold');
                              doc.text('PAYMENT RECEIPT', 105, 25, { align: 'center' });
                              
                              doc.setFontSize(12);
                              doc.setFont(undefined, 'normal');
                              doc.text('Skill Acquisition Registration', 105, 35, { align: 'center' });

                              doc.setTextColor(textColor[0], textColor[1], textColor[2]);

                              doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                              doc.rect(15, 60, 180, 25, 'F');
                              
                              doc.setFontSize(11);
                              doc.setFont(undefined, 'bold');
                              doc.text('Receipt Number:', 20, 70);
                              doc.setFont(undefined, 'normal');
                              doc.text(successPayment.reference, 60, 70);
                              
                              doc.setFont(undefined, 'bold');
                              doc.text('Date:', 20, 78);
                              doc.setFont(undefined, 'normal');
                              doc.text(new Date(successPayment.created_at).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              }), 60, 78);

                              doc.setFontSize(14);
                              doc.setFont(undefined, 'bold');
                              doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                              doc.text('Student Information', 20, 100);
                              
                              doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                              doc.setLineWidth(0.5);
                              doc.line(20, 102, 190, 102);

                              doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                              doc.setFontSize(11);
                              doc.setFont(undefined, 'bold');
                              doc.text('Full Name:', 20, 112);
                              doc.setFont(undefined, 'normal');
                              doc.text(profile?.full_name || '', 60, 112);

                              doc.setFont(undefined, 'bold');
                              doc.text('Matric Number:', 20, 122);
                              doc.setFont(undefined, 'normal');
                              doc.text(profile?.matric_number || '', 60, 122);

                              doc.setFont(undefined, 'bold');
                              doc.text('Department:', 20, 132);
                              doc.setFont(undefined, 'normal');
                              doc.text(profile?.department || '', 60, 132);

                              doc.setFontSize(14);
                              doc.setFont(undefined, 'bold');
                              doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                              doc.text('Payment Details', 20, 152);
                              
                              doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                              doc.line(20, 154, 190, 154);

                              doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                              doc.setFontSize(11);
                              doc.setFont(undefined, 'bold');
                              doc.text('Description:', 20, 164);
                              doc.setFont(undefined, 'normal');
                              doc.text('Skill Acquisition Registration Fee', 60, 164);

                              doc.setFont(undefined, 'bold');
                              doc.text('Transaction ID:', 20, 174);
                              doc.setFont(undefined, 'normal');
                              doc.text(successPayment.reference, 60, 174);

                              doc.setFont(undefined, 'bold');
                              doc.text('Status:', 20, 184);
                              doc.setFont(undefined, 'normal');
                              doc.setTextColor(46, 125, 50);
                              doc.text('PAID', 60, 184);

                              doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                              doc.rect(15, 195, 180, 20, 'F');
                              
                              doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                              doc.setFontSize(14);
                              doc.setFont(undefined, 'bold');
                              doc.text('Total Amount:', 20, 207);
                              doc.setFontSize(16);
                              doc.text(`₦${successPayment.amount.toLocaleString()}`, 170, 207, { align: 'right' });

                              doc.setFontSize(9);
                              doc.setFont(undefined, 'normal');
                              doc.setTextColor(128, 128, 128);
                              doc.text('This is a computer-generated receipt and requires no signature.', 105, 235, { align: 'center' });
                              doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 245, { align: 'center' });

                              doc.save(`Receipt_${successPayment.reference}.pdf`);
                              
                              toast({
                                title: "Receipt Downloaded",
                                description: "Your payment receipt has been downloaded successfully.",
                              });
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </>
                      ) : payment.status === "failed" ? (
                        <Badge variant="destructive">Failed</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Skill Form Card */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              <span>Skill Acquisition Form</span>
              <div className="flex gap-2">
                {skillForm && <Badge variant="default" className="bg-success">Submitted</Badge>}
                {getEditRequestBadge()}
              </div>
            </CardTitle>
            <CardDescription>Complete your skill registration</CardDescription>
          </CardHeader>
          <CardContent>
            {!payment || payment.status !== "success" ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Complete payment to unlock the skill acquisition form
                </p>
              </div>
            ) : skillForm ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="font-medium text-success">Form submitted successfully!</p>
                  <div className="grid md:grid-cols-2 gap-2 text-sm">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Level:</span> {skillForm.level}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Skill Choice:</span> {skillForm.skill_choice}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Submitted:</span> {new Date(skillForm.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Edit Request Section */}
                {editRequest?.status === "approved" ? (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-success mb-3">Your edit request has been approved! You can now update your form.</p>
                    <Button onClick={() => navigate("/student/edit-form")} variant="default">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Form
                    </Button>
                  </div>
                ) : editRequest?.status === "pending" ? (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Your edit request is pending approval. Please wait for admin review.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Requested: {new Date(editRequest.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                ) : editRequest?.status === "rejected" || editRequest?.status === "used" ? (
                  <div className="pt-4 border-t border-border space-y-3">
                    {editRequest?.status === "rejected" && (
                      <p className="text-sm text-destructive">
                        Your previous edit request was rejected.
                      </p>
                    )}
                    {editRequest?.status === "used" && (
                      <p className="text-sm text-muted-foreground">
                        Your form was updated on {new Date(skillForm.submitted_at).toLocaleDateString()}.
                      </p>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowEditRequestForm(true)}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Request Edit Access
                    </Button>
                  </div>
                ) : (
                  <div className="pt-4 border-t border-border">
                    {showEditRequestForm ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="editReason">Reason for Edit Request</Label>
                          <Textarea
                            id="editReason"
                            placeholder="Please explain why you need to edit your form..."
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            rows={3}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleRequestEdit} 
                            disabled={requestingEdit}
                            size="sm"
                          >
                            {requestingEdit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Submit Request
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setShowEditRequestForm(false);
                              setEditReason("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Need to make changes to your submitted form?
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowEditRequestForm(true)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Request Edit Access
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : !formSubmissionsOpen ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Form submissions are currently closed. Please check back later.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  You can now fill out your skill acquisition form.
                </p>
                <Button onClick={() => navigate("/student/skill-form")} className="w-full md:w-auto">
                  <FileText className="w-4 h-4 mr-2" />
                  Fill Skill Form
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentDashboard;
