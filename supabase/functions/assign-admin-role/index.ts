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
    
    // Create client with service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id } = await req.json();

    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log('Attempting to assign admin role to user:', user_id);

    // Check if any admins already exist
    const { data: existingAdmins, error: adminCheckError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (adminCheckError) {
      console.error('Error checking for existing admins:', adminCheckError);
      throw adminCheckError;
    }

    // If admins already exist, prevent creating more through setup
    if (existingAdmins && existingAdmins.length > 0) {
      console.log('Admin setup blocked: admins already exist');
      return new Response(
        JSON.stringify({ 
          error: 'Admin setup is no longer available. Admin users already exist in the system.' 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if user exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .eq('user_id', user_id)
      .single();

    if (profileError || !profile) {
      console.error('User not found:', profileError);
      throw new Error('User not found');
    }

    // Check if user already has admin role
    const { data: existingRole, error: roleCheckError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user_id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleCheckError) {
      console.error('Error checking existing role:', roleCheckError);
      throw roleCheckError;
    }

    if (existingRole) {
      console.log('User already has admin role');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User already has admin role',
          user: profile
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Assign admin role
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({ 
        user_id: user_id, 
        role: 'admin' 
      });

    if (insertError) {
      console.error('Error inserting admin role:', insertError);
      throw insertError;
    }

    console.log('Successfully assigned admin role to:', profile.email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin role assigned successfully',
        user: profile
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in assign-admin-role function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
