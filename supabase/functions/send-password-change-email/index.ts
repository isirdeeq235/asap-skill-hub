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
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to fetch user profile');
    }

    const changeTime = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // Send email notification
    const { error: emailError } = await resend.emails.send({
      from: 'ATAP Security <onboarding@resend.dev>',
      to: [profile.email],
      subject: 'Password Changed - ATAP Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #dc2626; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Security Alert</h1>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #1f2937;">Dear ${profile.full_name},</p>
            
            <p style="font-size: 16px; color: #1f2937;">
              Your ATAP account password was successfully changed.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h2 style="margin-top: 0; color: #1f2937;">Change Details</h2>
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0;"><strong>Account:</strong></td>
                  <td style="padding: 8px 0;">${profile.email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Date & Time:</strong></td>
                  <td style="padding: 8px 0;">${changeTime}</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fecaca;">
              <p style="margin: 0; color: #991b1b; font-size: 14px;">
                <strong>⚠️ Didn't change your password?</strong><br>
                If you did not make this change, please contact the ATAP administration immediately 
                and consider resetting your password.
              </p>
            </div>
            
            <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #93c5fd;">
              <p style="margin: 0; color: #1e40af; font-size: 14px;">
                <strong>🔐 Security Tips:</strong><br>
                • Use a strong, unique password<br>
                • Never share your password with anyone<br>
                • Enable two-factor authentication when available<br>
                • Be cautious of phishing emails
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated security notification from your ATAP account.
              If you have any questions, please contact the ATAP administration.
            </p>
            
            <p style="margin-top: 30px; color: #1f2937;">
              Best regards,<br>
              <strong>ATAP Security Team</strong>
            </p>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error('Failed to send email:', emailError);
      throw emailError;
    }

    console.log(`Password change notification sent to ${profile.email}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Notification email sent' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in send-password-change-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
