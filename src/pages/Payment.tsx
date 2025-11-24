import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, ArrowLeft, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const REGISTRATION_FEE = 5000; // ₦5,000

const Payment = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    checkUser();
  }, []);

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

      if (payment && payment.status === "success") {
        toast({
          title: "Already Paid",
          description: "You have already completed the payment",
        });
        navigate("/student/dashboard");
      }
    } catch (error) {
      console.error("Error checking user:", error);
      navigate("/student/auth");
    }
  };

  const handlePayment = async () => {
    setLoading(true);

    try {
      // Generate payment reference
      const reference = `ATAP-${Date.now()}-${userId.substring(0, 8)}`;

      // TODO: Integrate with Credo payment gateway
      // For now, we'll create a pending payment record
      // In production, you would redirect to Credo's payment page here

      const { error } = await supabase.from("payments").insert({
        student_id: userId,
        amount: REGISTRATION_FEE,
        reference,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Payment Integration Required",
        description: "Credo payment gateway integration is pending. Payment record created as pending.",
      });

      // In production, this would redirect to Credo's payment page
      // window.location.href = credoPaymentUrl;

      navigate("/student/dashboard");
    } catch (error: any) {
      toast({
        title: "Payment failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
            <CardTitle>Payment</CardTitle>
            <CardDescription>Complete your registration fee payment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Credo payment gateway integration is required to complete this feature. Once integrated, you'll be redirected to a secure payment page.
              </AlertDescription>
            </Alert>

            <div className="bg-gradient-card rounded-lg p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Registration Fee:</span>
                <span className="text-2xl font-bold">₦{REGISTRATION_FEE.toLocaleString()}</span>
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
                  You'll receive a confirmation email
                </li>
              </ul>
            </div>

            <Button 
              onClick={handlePayment} 
              className="w-full" 
              size="lg"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CreditCard className="w-4 h-4 mr-2" />
              Proceed to Payment
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Secure payment powered by Credo Payment Gateway
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Payment;
