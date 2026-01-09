import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

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
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Handle empty or invalid request bodies
    const contentType = req.headers.get('content-type') || '';
    let payload;
    
    if (contentType.includes('application/json')) {
      const text = await req.text();
      if (!text || text.trim() === '') {
        console.log('Empty request body received');
        return new Response(
          JSON.stringify({ success: true, message: 'Empty payload received' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      try {
        payload = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError, 'Body:', text);
        throw new Error('Invalid JSON payload');
      }
    } else {
      console.log('Non-JSON content type received:', contentType);
      return new Response(
        JSON.stringify({ success: true, message: 'Non-JSON payload received' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    // Verify Paystack webhook signature - REJECT unsigned requests
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      console.error('Missing webhook signature - rejecting request');
      return new Response(
        JSON.stringify({ error: 'Missing webhook signature' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify HMAC signature (Paystack uses SHA-512)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(paystackSecretKey);
    const messageData = encoder.encode(JSON.stringify(payload));
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature - rejecting request');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Webhook signature verified successfully');

    // Paystack webhook event structure
    const event = payload.event;
    const data = payload.data;
    const reference = data?.reference;
    const status = data?.status;

    console.log('Processing event:', event, 'reference:', reference, 'status:', status);

    if (!reference) {
      console.error('Missing payment reference. Payload:', JSON.stringify(payload, null, 2));
      throw new Error('Missing payment reference');
    }

    // Only process charge.success events
    if (event !== 'charge.success') {
      console.log(`Ignoring event type: ${event}`);
      return new Response(
        JSON.stringify({ success: true, message: `Event ${event} acknowledged but not processed` }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify payment with Paystack API for extra security
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!verifyResponse.ok) {
      throw new Error('Failed to verify payment with Paystack');
    }

    const verifyData = await verifyResponse.json();
    console.log('Verification response:', verifyData);

    const paymentStatus = verifyData.data?.status;
    const isSuccessful = paymentStatus === 'success';

    // Update payment status in database
    const { data: paymentData, error: updateError } = await supabase
      .from('payments')
      .update({
        status: isSuccessful ? 'success' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('reference', reference)
      .select('student_id, amount')
      .single();

    if (updateError) {
      console.error('Failed to update payment:', updateError);
      throw updateError;
    }

    console.log(`Payment ${reference} updated to status: ${isSuccessful ? 'success' : 'failed'}`);

    // Update profile application_status to 'paid' if successful
    if (isSuccessful && paymentData?.student_id) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ application_status: 'paid' })
        .eq('user_id', paymentData.student_id);

      if (profileError) {
        console.error('Failed to update profile application_status:', profileError);
        // Don't throw - payment update was successful
      } else {
        console.log(`Profile application_status updated to 'paid' for user ${paymentData.student_id}`);
      }
    }

    // Send email notification if payment is successful
    if (isSuccessful && paymentData) {
      try {
        // Get student profile information
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('user_id', paymentData.student_id)
          .single();

        if (profile?.email) {
          const paymentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          await resend.emails.send({
            from: 'ATAP Registration <onboarding@resend.dev>',
            to: [profile.email],
            subject: 'Payment Successful - ATAP Registration',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #22c55e;">Payment Successful!</h1>
                
                <p>Dear ${profile.full_name},</p>
                
                <p>Your payment for ATAP Registration has been successfully processed.</p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h2 style="margin-top: 0;">Payment Receipt</h2>
                  <table style="width: 100%;">
                    <tr>
                      <td><strong>Reference:</strong></td>
                      <td>${reference}</td>
                    </tr>
                    <tr>
                      <td><strong>Amount:</strong></td>
                      <td>₦${paymentData.amount.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td><strong>Date:</strong></td>
                      <td>${paymentDate}</td>
                    </tr>
                    <tr>
                      <td><strong>Status:</strong></td>
                      <td style="color: #22c55e;"><strong>Success</strong></td>
                    </tr>
                  </table>
                </div>
                
                <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h2 style="margin-top: 0; color: #1e40af;">Next Steps</h2>
                  <ol style="line-height: 1.8;">
                    <li>Log in to your dashboard at <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}">your student portal</a></li>
                    <li>Complete the Skill Acquisition Form</li>
                    <li>Upload your passport photograph</li>
                    <li>Submit the form to complete your registration</li>
                  </ol>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                  If you have any questions, please contact the ATAP administration.
                </p>
                
                <p style="margin-top: 30px;">Best regards,<br><strong>ATAP Team</strong></p>
              </div>
            `,
          });

          console.log(`Email sent to ${profile.email} for payment ${reference}`);
        }
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't throw - payment was successful, email is just a notification
      }
    }

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
