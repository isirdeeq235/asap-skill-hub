import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, CreditCard, FileText, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  full_name: string;
  email: string;
  phone: string;
  matric_number: string;
  department: string;
}

interface Payment {
  status: string;
  amount: number;
  created_at: string;
}

interface SkillForm {
  skill_choice: string;
  submitted_at: string;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [skillForm, setSkillForm] = useState<SkillForm | null>(null);

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

      // Fetch payment status
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

      // Fetch skill form
      const { data: formData } = await supabase
        .from("skill_forms")
        .select("*")
        .eq("student_id", user.id)
        .maybeSingle();

      if (formData) {
        setSkillForm(formData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
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
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
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
              <div className="space-y-2">
                <p className="text-success font-medium">Payment completed successfully!</p>
                <p className="text-sm text-muted-foreground">
                  Amount: ₦{payment.amount.toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skill Form Card */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Skill Acquisition Form
              {skillForm && <Badge variant="default" className="bg-success">Submitted</Badge>}
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
              <div className="space-y-2">
                <p className="font-medium text-success">Form submitted successfully!</p>
                <p className="text-sm text-muted-foreground">
                  Skill Choice: {skillForm.skill_choice}
                </p>
                <p className="text-sm text-muted-foreground">
                  Submitted: {new Date(skillForm.submitted_at).toLocaleDateString()}
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
