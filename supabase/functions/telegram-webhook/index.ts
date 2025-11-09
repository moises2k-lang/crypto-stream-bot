import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const update: TelegramUpdate = await req.json();
    console.log('Telegram webhook received:', JSON.stringify(update));

    // Handle /start command with deep link parameter
    if (update.message?.text?.startsWith('/start')) {
      const parts = update.message.text.split(' ');
      const chatId = update.message.chat.id.toString();
      const username = update.message.from?.username || update.message.chat.username;
      const firstName = update.message.from?.first_name || update.message.chat.first_name;

      // If there's a parameter, it's the user_id from our app
      if (parts.length > 1) {
        const userId = parts[1];
        
        console.log(`Connecting user ${userId} to Telegram chat ${chatId}`);

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
          console.error('Error saving telegram connection:', upsertError);
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

        console.log(`Successfully connected user ${userId} to Telegram`);
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
    console.error('Error in telegram-webhook:', error);
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
