import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationData {
  message: string;
  userId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    
    if (!botToken) {
      throw new Error('Telegram bot token not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { message, userId }: NotificationData = await req.json();
    
    // If userId is specified (sending to another user), verify admin role
    if (userId && userId !== user.id) {
      const { data: isAdmin } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });
      
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Admin role required to send notifications to other users' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
    }
    
    const targetUserId = userId || user.id;

    // Get user's telegram connection
    const { data: connection, error: connectionError } = await supabase
      .from('telegram_connections')
      .select('chat_id, is_active')
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .single();

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Usuario no tiene Telegram conectado' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Send notification to user's personal chat
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: connection.chat_id,
        text: `🔔 ${message}`,
        parse_mode: 'Markdown',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notificación enviada' }),
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
