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
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN no está configurado');
    }

    if (!webhookSecret) {
      throw new Error('TELEGRAM_WEBHOOK_SECRET no está configurado');
    }

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook`;

    // Set webhook with secret token
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: webhookSecret,
          drop_pending_updates: true,
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.description || 'Error al configurar webhook');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook configurado exitosamente',
        webhookUrl,
        result: data.result,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
