import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const credoSecretKey = Deno.env.get('CREDO_SECRET_KEY')!;

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    // Verify webhook signature (Credo sends a signature in headers)
    const signature = req.headers.get('x-credo-signature');
    if (!signature) {
      console.warn('Missing webhook signature');
    }

    const event = payload.event || payload.status;
    const reference = payload.reference || payload.data?.reference;
    const status = payload.status || payload.data?.status;

    console.log('Processing event:', event, 'reference:', reference, 'status:', status);

    if (!reference) {
      throw new Error('Missing payment reference');
    }

    // Verify payment with Credo API
    const verifyResponse = await fetch(
      `https://api.credocentral.com/transaction/verify/${reference}`,
      {
        headers: {
          'Authorization': `Bearer ${credoSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!verifyResponse.ok) {
      throw new Error('Failed to verify payment with Credo');
    }

    const verifyData = await verifyResponse.json();
    console.log('Verification response:', verifyData);

    const paymentStatus = verifyData.data?.status || verifyData.status;
    const isSuccessful = paymentStatus === 'success' || paymentStatus === 'successful';

    // Update payment status in database
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: isSuccessful ? 'success' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('reference', reference);

    if (updateError) {
      console.error('Failed to update payment:', updateError);
      throw updateError;
    }

    console.log(`Payment ${reference} updated to status: ${isSuccessful ? 'success' : 'failed'}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
