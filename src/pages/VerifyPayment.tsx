import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";

interface PaymentVerification {
  reference: string;
  amount: number;
  status: string;
  student_name: string;
  matric_number: string;
  created_at: string;
}

const VerifyPayment = () => {
  const { reference } = useParams<{ reference: string }>();
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentVerification | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      if (!reference) {
        setError("Invalid payment reference");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("payments")
          .select(`
            reference,
            amount,
            status,
            created_at,
            profiles:student_id (
              full_name,
              matric_number
            )
          `)
          .eq("reference", reference)
          .single();

        if (error) throw error;

        if (!data) {
          setError("Payment not found");
          setLoading(false);
          return;
        }

        setPayment({
          reference: data.reference,
          amount: data.amount,
          status: data.status,
          student_name: (data.profiles as any)?.full_name || "Unknown",
          matric_number: (data.profiles as any)?.matric_number || "Unknown",
          created_at: data.created_at,
        });
      } catch (err) {
        console.error("Verification error:", err);
        setError("Unable to verify payment");
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [reference]);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "success":
      case "successful":
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle className="w-4 h-4 mr-1" />
            Verified - Genuine Payment
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500 text-white">
            <Clock className="w-4 h-4 mr-1" />
            Pending Verification
          </Badge>
        );
      case "failed":
      case "cancelled":
        return (
          <Badge className="bg-red-500 text-white">
            <XCircle className="w-4 h-4 mr-1" />
            Payment {status}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-500 flex items-center gap-2">
              <XCircle className="w-6 h-6" />
              Verification Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error || "Payment not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Payment Verification</CardTitle>
          <CardDescription>
            This payment has been verified from our records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            {getStatusBadge(payment.status)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Student Name</p>
              <p className="font-semibold">{payment.student_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Matric Number</p>
              <p className="font-semibold">{payment.matric_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Amount Paid</p>
              <p className="font-semibold">₦{(payment.amount / 100).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Reference</p>
              <p className="font-semibold text-sm break-all">{payment.reference}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Payment Date</p>
              <p className="font-semibold">
                {new Date(payment.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {payment.status.toLowerCase() === "success" || payment.status.toLowerCase() === "successful" ? (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200 font-semibold flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                This is a genuine payment verified from our system
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyPayment;
