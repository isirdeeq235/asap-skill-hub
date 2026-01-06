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
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')!;

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

    // Rate limiting: Check if user has exceeded payment attempts
    const RATE_LIMIT_WINDOW = 60; // 60 minutes
    const MAX_ATTEMPTS = 5; // 5 attempts per hour
    const endpoint = 'initialize-payment';
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW * 60 * 1000);

    // Get or create rate limit record
    const { data: existingLimit } = await supabaseAdmin
      .from('rate_limits')
      .select('*')
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
      .gte('window_start', windowStart.toISOString())
      .maybeSingle();

    if (existingLimit) {
      if (existingLimit.request_count >= MAX_ATTEMPTS) {
        const resetTime = new Date(existingLimit.window_start);
        resetTime.setMinutes(resetTime.getMinutes() + RATE_LIMIT_WINDOW);
        const minutesRemaining = Math.ceil((resetTime.getTime() - Date.now()) / 60000);
        
        console.log(`Rate limit exceeded for user ${user.id}`);
        return new Response(
          JSON.stringify({ 
            error: 'Too many payment attempts. Please try again later.',
            retryAfter: minutesRemaining,
            message: `You have exceeded the maximum number of payment attempts. Please wait ${minutesRemaining} minute(s) before trying again.`
          }),
          {
            status: 429,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': String(minutesRemaining * 60)
            },
          }
        );
      }

      // Increment request count
      await supabaseAdmin
        .from('rate_limits')
        .update({ 
          request_count: existingLimit.request_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLimit.id);
    } else {
      // Create new rate limit record
      await supabaseAdmin
        .from('rate_limits')
        .insert({
          user_id: user.id,
          endpoint: endpoint,
          request_count: 1,
          window_start: new Date().toISOString(),
        });
    }

    console.log('Rate limit check passed for user:', user.id);

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

    // Get the app URL from environment or construct it
    const appUrl = Deno.env.get('APP_URL') || supabaseUrl.replace('fgagmcvovrrpebpijflg.supabase.co', 'a3b59232-0ce9-4e5b-8e7e-3e6c9d63bfc9.lovableproject.com');
    
    // Initialize payment with Paystack
    console.log('Calling Paystack API...');
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100, // Convert to kobo
        currency: 'NGN',
        email: profile.email,
        reference: reference,
        callback_url: `${appUrl}/student/dashboard`,
        metadata: {
          user_id: user.id,
          full_name: profile.full_name,
          phone: profile.phone,
          custom_fields: [
            {
              display_name: "Student Name",
              variable_name: "student_name",
              value: profile.full_name
            },
            {
              display_name: "Phone",
              variable_name: "phone",
              value: profile.phone
            }
          ]
        },
      }),
    });

    console.log('Paystack response status:', paystackResponse.status);
    const responseText = await paystackResponse.text();
    console.log('Paystack response body:', responseText);

    if (!paystackResponse.ok) {
      console.error('Paystack API error:', responseText);
      throw new Error(`Payment initialization failed: ${responseText || 'Invalid API credentials or configuration'}`);
    }

    let paystackData;
    try {
      paystackData = JSON.parse(responseText);
    } catch (e) {
      throw new Error('Invalid response from payment gateway');
    }

    console.log('Paystack data parsed:', paystackData);

    if (!paystackData.status) {
      throw new Error(paystackData.message || 'Payment initialization failed');
    }

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
        authorization_url: paystackData.data?.authorization_url,
        access_code: paystackData.data?.access_code,
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
