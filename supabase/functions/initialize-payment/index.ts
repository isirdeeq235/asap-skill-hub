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

    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Extract JWT token
    const jwt = authHeader.replace('Bearer ', '');

    // Create Supabase client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    
    if (userError || !user) {
      console.error('Auth failed:', userError?.message || 'No user');
      throw new Error(`Unauthorized: ${userError?.message || 'No user found'}`);
    }

    console.log('User authenticated:', user.id);

    const { amount } = await req.json();

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    console.log('Initializing payment for user:', user.id, 'amount:', amount);

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, phone')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    // Generate unique reference
    const reference = `ATAP-${Date.now()}-${user.id.substring(0, 8)}`;

    // Initialize payment with Credo
    console.log('Calling Credo API...');
    const credoResponse = await fetch('https://api.credocentral.com/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': credoSecretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100, // Convert to kobo
        currency: 'NGN',
        email: profile.email,
        reference: reference,
        callback_url: `${supabaseUrl}/functions/v1/payment-webhook`,
        metadata: {
          user_id: user.id,
          full_name: profile.full_name,
          phone: profile.phone,
        },
      }),
    });

    console.log('Credo response status:', credoResponse.status);
    const responseText = await credoResponse.text();
    console.log('Credo response body:', responseText);

    if (!credoResponse.ok) {
      console.error('Credo API error:', responseText);
      throw new Error(`Payment initialization failed: ${responseText || 'Invalid API credentials or configuration'}`);
    }

    let credoData;
    try {
      credoData = JSON.parse(responseText);
    } catch (e) {
      throw new Error('Invalid response from payment gateway');
    }

    console.log('Credo data parsed:', credoData);

    // Store payment record in database
    const { error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        student_id: user.id,
        amount: amount,
        reference: reference,
        status: 'pending',
      });

    if (paymentError) {
      console.error('Database error:', paymentError);
      throw new Error('Failed to create payment record');
    }

    return new Response(
      JSON.stringify({
        success: true,
        reference: reference,
        authorization_url: credoData.data?.authorizationUrl || credoData.authorizationUrl,
        access_code: credoData.data?.access_code || credoData.access_code,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in initialize-payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
