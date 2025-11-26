import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting cleanup of old pending, cancelled, and failed payments...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate timestamp for 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    console.log('Deleting pending, cancelled, and failed payments older than:', twentyFourHoursAgo.toISOString());

    // Delete pending, cancelled, and failed payments older than 24 hours
    const { data, error } = await supabase
      .from('payments')
      .delete()
      .in('status', ['pending', 'cancelled', 'failed'])
      .lt('created_at', twentyFourHoursAgo.toISOString())
      .select();

    if (error) {
      console.error('Error deleting old payments:', error);
      throw error;
    }

    const deletedCount = data?.length || 0;
    console.log(`Successfully deleted ${deletedCount} old payment(s) (pending/cancelled/failed)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleaned up ${deletedCount} old payment(s) (pending/cancelled/failed)`,
        deletedCount,
        cutoffTime: twentyFourHoursAgo.toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Cleanup function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to cleanup old payments',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
