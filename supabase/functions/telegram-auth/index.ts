import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify Telegram auth data using Web Crypto API
async function verifyTelegramAuth(authData: any, botToken: string): Promise<boolean> {
  const { hash, ...dataToCheck } = authData;
  
  // Create data check string
  const dataCheckArr = Object.keys(dataToCheck)
    .sort()
    .map(key => `${key}=${dataToCheck[key]}`);
  const dataCheckString = dataCheckArr.join('\n');
  
  // Create secret key using HMAC-SHA256
  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(botToken),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const secretKeyBytes = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    enc.encode('WebAppData')
  );
  
  // Calculate hash using the secret key
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    enc.encode(dataCheckString)
  );
  
  // Convert to hex
  const calculatedHash = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return calculatedHash === hash;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const authData = await req.json();
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    // Verify the auth data
    if (!(await verifyTelegramAuth(authData, botToken))) {
      throw new Error('Invalid Telegram auth data');
    }

    // Check if auth data is not too old (5 minutes)
    const authTime = parseInt(authData.auth_date);
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - authTime > 300) {
      throw new Error('Auth data is too old');
    }

    // Create email from Telegram ID
    const telegramId = authData.id.toString();
    const email = `telegram_${telegramId}@telegram.user`;
    
    // Try to find existing user
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    let user = existingUser?.users.find(u => u.email === email);

    if (!user) {
      // Generate a secure random password for the new user
      const securePassword = crypto.randomUUID() + crypto.randomUUID();
      
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: securePassword,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramId,
          first_name: authData.first_name,
          last_name: authData.last_name,
          username: authData.username,
          photo_url: authData.photo_url,
          auth_date: authData.auth_date
        }
      });

      if (createError) throw createError;
      user = newUser.user;

      // Create profile and stats
      await supabaseAdmin.from('profiles').insert({
        user_id: user.id,
        email,
        full_name: `${authData.first_name || ''} ${authData.last_name || ''}`.trim() || authData.username || 'Telegram User'
      });

      await supabaseAdmin.from('user_stats').insert({
        user_id: user.id,
        total_balance: 0,
        today_pnl: 0,
        win_rate: 0
      });
    } else {
      // Update user metadata
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          telegram_id: telegramId,
          first_name: authData.first_name,
          last_name: authData.last_name,
          username: authData.username,
          photo_url: authData.photo_url,
          auth_date: authData.auth_date
        }
      });
    }

    // Generate a secure session using admin API (no password needed)
    const { data, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!,
    });

    if (sessionError) throw sessionError;
    if (!data) throw new Error('Failed to generate auth link');

    // Extract session from the properties
    const session = data.properties;

    return new Response(
      JSON.stringify({ session }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    console.error('Error in telegram-auth:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
