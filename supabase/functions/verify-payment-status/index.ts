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
      const errorText = await verifyResponse.text();
      console.error('Credo API error:', errorText);
      
      // Return info about the payment without updating database
      return new Response(
        JSON.stringify({
          success: false,
          verified_with_credo: false,
          message: 'Payment not found or cancelled on Credo',
          credo_error: errorText,
          reference: reference,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const verifyData = await verifyResponse.json();
    console.log('Credo verification response:', verifyData);

    const paymentStatus = verifyData.data?.status || verifyData.status;
    const isSuccessful = paymentStatus === 'success' || paymentStatus === 'successful';

    // Only update database if payment is successful
    if (isSuccessful) {
      const { data: paymentData, error: updateError } = await supabase
        .from('payments')
        .update({
          status: 'success',
          updated_at: new Date().toISOString(),
        })
        .eq('reference', reference)
        .select('*')
        .single();

      if (updateError) {
        console.error('Failed to update payment:', updateError);
        throw updateError;
      }

      console.log(`Payment ${reference} updated to status: success`);

      return new Response(
        JSON.stringify({
          success: true,
          payment_status: 'success',
          verified_with_credo: true,
          credo_status: paymentStatus,
          payment: paymentData,
          message: 'Payment verified successfully',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      // For failed or cancelled payments, don't update database
      // Just return the status from Credo
      console.log(`Payment ${reference} status from Credo: ${paymentStatus} - Not updating database`);

      return new Response(
        JSON.stringify({
          success: false,
          payment_status: paymentStatus,
          verified_with_credo: true,
          credo_status: paymentStatus,
          reference: reference,
          message: `Payment status: ${paymentStatus}. No database update for unsuccessful payments.`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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
