import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const SignalSchema = z.object({
  pair: z.string().trim().min(3, "Pair must be at least 3 characters").max(20, "Pair must be less than 20 characters").regex(/^[A-Z0-9\/]+$/, "Pair must contain only uppercase letters, numbers, and /"),
  type: z.enum(['LONG', 'SHORT'], { errorMap: () => ({ message: "Type must be either LONG or SHORT" }) }),
  entry: z.string().trim().min(1).max(20).regex(/^[0-9.]+$/, "Entry must be a valid number"),
  target: z.string().trim().min(1).max(20).regex(/^[0-9.]+$/, "Target must be a valid number"),
  stop: z.string().trim().min(1).max(20).regex(/^[0-9.]+$/, "Stop must be a valid number")
});

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
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_GROUP_CHAT_ID');

    if (!botToken || !chatId) {
      throw new Error('Telegram credentials not configured');
    }

    const requestData = await req.json();
    
    // Validate input data
    const validationResult = SignalSchema.safeParse(requestData);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input data', 
          details: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    const { pair, type, entry, target, stop }: SignalData = validationResult.data;

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
