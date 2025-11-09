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
      console.error('TELEGRAM_BOT_TOKEN no está configurado');
      return new Response(
        JSON.stringify({ 
          configured: false,
          error: 'Bot token no configurado'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Check webhook status
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`
    );

    const data = await response.json();

    if (!data.ok) {
      console.error('Error en respuesta de Telegram:', data);
      return new Response(
        JSON.stringify({ 
          configured: false,
          error: data.description || 'Error al verificar webhook'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
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
        error: error instanceof Error ? error.message : 'Error desconocido',
        configured: false,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
