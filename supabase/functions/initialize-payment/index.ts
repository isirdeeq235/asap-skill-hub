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
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const credoSecretKey = Deno.env.get('CREDO_SECRET_KEY')!;

    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    console.log('User error:', userError);
    console.log('User:', user ? 'exists' : 'null');
    
    if (userError || !user) {
      console.error('Auth failed:', userError?.message || 'No user');
      throw new Error(`Unauthorized: ${userError?.message || 'No user found'}`);
    }

    const { amount } = await req.json();

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    console.log('Initializing payment for user:', user.id, 'amount:', amount);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
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
    const credoResponse = await fetch('https://api.credocentral.com/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credoSecretKey}`,
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

    if (!credoResponse.ok) {
      const errorText = await credoResponse.text();
      console.error('Credo API error:', errorText);
      throw new Error(`Payment initialization failed: ${errorText}`);
    }

    const credoData = await credoResponse.json();

    console.log('Credo response:', credoData);

    // Store payment record in database
    const { error: paymentError } = await supabase
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
        authorization_url: credoData.data?.authorization_url || credoData.authorization_url,
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
