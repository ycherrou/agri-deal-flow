import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting cleanup of expired validations...');

    // Find all reventes waiting for validation that have expired (> 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: expiredReventes, error: fetchError } = await supabase
      .from('reventes_clients')
      .select('id, vente_id')
      .eq('etat', 'en_attente_validation')
      .lt('date_expiration_validation', thirtyMinutesAgo);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${expiredReventes?.length || 0} expired validations`);

    if (expiredReventes && expiredReventes.length > 0) {
      // Update expired reventes to 'retire' status
      const { error: updateError } = await supabase
        .from('reventes_clients')
        .update({
          etat: 'retire',
          updated_at: new Date().toISOString()
        })
        .in('id', expiredReventes.map(r => r.id));

      if (updateError) {
        throw updateError;
      }

      console.log(`Successfully marked ${expiredReventes.length} reventes as retired due to expired validation`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        cleaned_count: expiredReventes?.length || 0,
        message: 'Cleanup completed successfully'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Error in cleanup function:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});