import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignalData {
  pair: string;
  type: 'LONG' | 'SHORT';
  entry: string;
  target: string;
  stop: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_GROUP_CHAT_ID');

    if (!botToken || !chatId) {
      throw new Error('Telegram credentials not configured');
    }

    const { pair, type, entry, target, stop }: SignalData = await req.json();

    const emoji = type === 'LONG' ? '🟢' : '🔴';
    const message = `
${emoji} *NUEVA SEÑAL DE TRADING* ${emoji}

📊 Par: *${pair}*
📈 Tipo: *${type}*
💰 Entrada: *$${entry}*
🎯 Objetivo: *$${target}*
🛑 Stop Loss: *$${stop}*

⏰ Hora: ${new Date().toLocaleString('es-ES')}
    `.trim();

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Telegram API error:', data);
      throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
    }

    console.log('Signal sent successfully to Telegram');

    return new Response(
      JSON.stringify({ success: true, message: 'Signal sent to Telegram' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in send-telegram-signal:', error);
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
