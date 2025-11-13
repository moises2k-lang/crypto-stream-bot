import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramUpdate {
  message?: {
    chat: {
      id: number;
      username?: string;
      first_name?: string;
    };
    text?: string;
    from?: {
      id: number;
      username?: string;
      first_name?: string;
    };
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret token
    const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');

    if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const update: TelegramUpdate = await req.json();

    // Handle /start command with deep link parameter
    if (update.message?.text?.startsWith('/start')) {
      const parts = update.message.text.split(' ');
      const chatId = update.message.chat.id.toString();
      const username = update.message.from?.username || update.message.chat.username;
      const firstName = update.message.from?.first_name || update.message.chat.first_name;

      // If there's a parameter, it's the user_id from our app
      if (parts.length > 1) {
        const userId = parts[1];
        
        // Validate UUID format
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID_REGEX.test(userId)) {
          return new Response(
            JSON.stringify({ error: 'Invalid user ID format' }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          );
        }

        // Save or update the telegram connection
        const { error: upsertError } = await supabase
          .from('telegram_connections')
          .upsert({
            user_id: userId,
            chat_id: chatId,
            username,
            first_name: firstName,
            is_active: true,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });

        if (upsertError) {
          throw upsertError;
        }

        // Send confirmation message to user
        const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '✅ ¡Conexión exitosa! Ahora recibirás notificaciones de trading aquí.',
            }),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
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
