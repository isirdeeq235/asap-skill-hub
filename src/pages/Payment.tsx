import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, ArrowLeft, CheckCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Payment = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [registrationFee, setRegistrationFee] = useState<number | null>(null);
  const [fetchingFee, setFetchingFee] = useState(true);

  useEffect(() => {
    checkUser();
    fetchRegistrationFee();
  }, []);

  const fetchRegistrationFee = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'registration_fee')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setRegistrationFee(Number(data.value));
      }
    } catch (error) {
      console.error('Error fetching registration fee:', error);
      toast({
        title: "Error",
        description: "Failed to load registration fee. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setFetchingFee(false);
    }
  };

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/student/auth");
        return;
      }

      setUserId(user.id);

      // Check if already paid
      const { data: payment } = await supabase
        .from("payments")
        .select("status")
        .eq("student_id", user.id)
        .maybeSingle();

      if (payment) {
        setPaymentStatus(payment.status);
        if (payment.status === "success") {
          toast({
            title: "Already Paid",
            description: "You have already completed the payment",
          });
          setTimeout(() => navigate("/student/dashboard"), 2000);
        }
      }
    } catch (error) {
      console.error("Error checking user:", error);
      navigate("/student/auth");
    }
  };

  const handlePayment = async () => {
    if (!registrationFee) {
      toast({
        title: "Error",
        description: "Registration fee not loaded. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Please log in again');
      }

      const { data, error } = await supabase.functions.invoke('initialize-payment', {
        body: { amount: registrationFee },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      // Check for rate limiting
      if (data?.error && data?.retryAfter) {
        toast({
          title: "Too Many Attempts",
          description: data.message || `Please wait ${data.retryAfter} minute(s) before trying again.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.authorization_url) {
        throw new Error('Failed to get payment URL');
      }

      console.log('Payment initialized:', data);

      toast({
        title: "Redirecting to Payment",
        description: "You will be redirected to Credo payment page...",
      });

      // Redirect to Credo payment page
      window.location.href = data.authorization_url;

    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment initialization failed",
        description: error.message || "An error occurred while initializing payment",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  if (loading || fetchingFee || !userId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (paymentStatus === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-card">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-2xl font-bold">Payment Successful!</h2>
            <p className="text-muted-foreground">
              Your registration fee has been paid. Redirecting to dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/student/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Registration Payment</CardTitle>
            <CardDescription>Complete your skill acquisition program registration fee</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {paymentStatus === "pending" && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  You have a pending payment. Please complete it to proceed.
                </AlertDescription>
              </Alert>
            )}

            {paymentStatus === "failed" && (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Your previous payment attempt failed. Please try again.
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-gradient-card rounded-lg p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Registration Fee:</span>
                <span className="text-2xl font-bold">₦{registrationFee?.toLocaleString()}</span>
              </div>
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  This fee covers your skill acquisition program registration and materials.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">What happens after payment?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  Your payment will be verified instantly
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  Access to the skill acquisition form will be unlocked
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  You can start your skill training program
                </li>
              </ul>
            </div>

            <Button 
              onClick={handlePayment} 
              className="w-full" 
              size="lg"
              disabled={loading || !registrationFee}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay ₦{registrationFee?.toLocaleString()} Now
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              🔒 Secure payment powered by Credo Payment Gateway
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Payment;
