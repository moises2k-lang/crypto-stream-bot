import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN no está configurado');
    }

    // Check webhook status
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`
    );

    if (!response.ok) {
      throw new Error('Error al verificar webhook');
    }

    const data = await response.json();
    
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook`;
    const isConfigured = data.result?.url === webhookUrl;

    return new Response(
      JSON.stringify({
        configured: isConfigured,
        currentUrl: data.result?.url || null,
        expectedUrl: webhookUrl,
        lastError: data.result?.last_error_message || null,
        pendingUpdateCount: data.result?.pending_update_count || 0,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error checking webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        configured: false,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
