import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[CRON] Starting automatic bot execution');

    // Get all active bots
    const { data: activeBots, error: botsError } = await supabase
      .from('trading_bots')
      .select('id, name, user_id')
      .eq('is_active', true);

    if (botsError) {
      console.error('Error fetching active bots:', botsError);
      throw botsError;
    }

    if (!activeBots || activeBots.length === 0) {
      console.log('[CRON] No active bots found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active bots', executed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CRON] Found ${activeBots.length} active bot(s)`);

    // Execute each bot
    const results = [];
    for (const bot of activeBots) {
      try {
        console.log(`[CRON] Executing bot: ${bot.name} (${bot.id})`);
        
        // Call the run-trading-bot function for this specific bot
        const { data, error } = await supabase.functions.invoke('run-trading-bot', {
          body: { botId: bot.id },
        });

        if (error) {
          console.error(`[CRON] Error running bot ${bot.name}:`, error);
          results.push({ botId: bot.id, name: bot.name, success: false, error: error.message });
        } else {
          console.log(`[CRON] Successfully executed bot: ${bot.name}`);
          results.push({ botId: bot.id, name: bot.name, success: true });
        }
      } catch (error) {
        console.error(`[CRON] Exception running bot ${bot.name}:`, error);
        results.push({ 
          botId: bot.id, 
          name: bot.name, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[CRON] Execution complete: ${successCount}/${activeBots.length} successful`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        executed: activeBots.length,
        successful: successCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in run-all-active-bots:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
