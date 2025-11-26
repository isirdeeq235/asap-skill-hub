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

    // Verify admin user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      throw new Error('Admin access required');
    }

    const { reference } = await req.json();

    if (!reference) {
      throw new Error('Payment reference is required');
    }

    console.log('Verifying payment with Credo API:', reference);

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
      console.error('Credo API error:', await verifyResponse.text());
      throw new Error('Failed to verify payment with Credo');
    }

    const verifyData = await verifyResponse.json();
    console.log('Credo verification response:', verifyData);

    const paymentStatus = verifyData.data?.status || verifyData.status;
    const isSuccessful = paymentStatus === 'success' || paymentStatus === 'successful';

    // Update payment status in database based on Credo response
    const { data: paymentData, error: updateError } = await supabase
      .from('payments')
      .update({
        status: isSuccessful ? 'success' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('reference', reference)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to update payment:', updateError);
      throw updateError;
    }

    console.log(`Payment ${reference} updated to status: ${isSuccessful ? 'success' : 'failed'}`);

    return new Response(
      JSON.stringify({
        success: true,
        payment_status: isSuccessful ? 'success' : 'failed',
        verified_with_credo: true,
        credo_status: paymentStatus,
        payment: paymentData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
