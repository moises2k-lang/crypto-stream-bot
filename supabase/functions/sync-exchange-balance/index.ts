import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fromBase64(input: string): Uint8Array {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const passphraseBytes = new TextEncoder().encode(passphrase);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passphraseBytes as unknown as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: (salt as unknown as BufferSource), iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function decrypt(ciphertext: string, iv: string, salt: string, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, fromBase64(salt));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: (fromBase64(iv) as unknown as BufferSource) },
    key,
    (fromBase64(ciphertext).buffer as ArrayBuffer),
  );
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  console.log('🚀 Starting sync-exchange-balance function');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      console.error('❌ Authentication error: No user');
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('✅ User authenticated:', user.id);

    // Get Python proxy server configuration
    const proxyUrl = Deno.env.get('EXCHANGE_PROXY_URL') || 'https://sistema.mbconstruccion.com:5443/api/exchange/balance';
    const proxyApiKey = Deno.env.get('EXCHANGE_PROXY_KEY') || '';
    
    if (!proxyApiKey) {
      console.error('❌ Missing EXCHANGE_PROXY_KEY');
      return new Response(
        JSON.stringify({ error: 'Proxy not configured. Please add EXCHANGE_PROXY_KEY secret.' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('🌍 Using Python proxy:', proxyUrl);

    const ENCRYPTION_KEY = Deno.env.get("EXCHANGE_ENCRYPTION_KEY");
    if (!ENCRYPTION_KEY) {
      console.error('❌ Missing EXCHANGE_ENCRYPTION_KEY');
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get exchange connections
    const { data: connections } = await supabaseClient
      .from('exchange_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_connected', true);

    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No connected exchanges",
        balance: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalBalance = 0;
    let hadSuccess = false;

    // Helper function to sync via Python proxy
    const syncExchangeViaProxy = async (exchangeName: string, creds: any) => {
      console.log(`🌐 Syncing ${exchangeName} via Python proxy...`);
      
      const apiKey = await decrypt(
        creds.api_key_ciphertext,
        creds.api_key_iv,
        creds.salt,
        ENCRYPTION_KEY
      );

      const apiSecret = await decrypt(
        creds.api_secret_ciphertext,
        creds.api_secret_iv,
        creds.salt,
        ENCRYPTION_KEY
      );

      // Detectar cuenta demo
      if (apiKey.startsWith('DEMO_')) {
        console.log(`🎮 Demo account detected for ${exchangeName}`);
        const { data: userStats } = await supabaseClient
          .from('user_stats')
          .select('total_balance')
          .eq('user_id', user.id)
          .single();
        
        return userStats?.total_balance || 0;
      }

      const proxyResponse = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${proxyApiKey}`
        },
        body: JSON.stringify({
          exchange: exchangeName.toLowerCase(),
          apiKey: apiKey,
          apiSecret: apiSecret,
          accountType: creds.account_type || 'spot'
        })
      });

      if (!proxyResponse.ok) {
        const errorText = await proxyResponse.text();
        console.error(`❌ ${exchangeName} Python proxy error:`, proxyResponse.status, errorText);
        throw new Error(`Python proxy error for ${exchangeName}: ${proxyResponse.status}`);
      }

      const proxyData = await proxyResponse.json();
      
      if (proxyData.error) {
        throw new Error(`${exchangeName} proxy error: ${proxyData.error}`);
      }

      return proxyData.balance || 0;
    };

    // Process each connected exchange
    for (const connection of connections) {
      const { data: creds } = await supabaseClient
        .from('exchange_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange_name', connection.exchange_name)
        .single();

      if (!creds) {
        console.log(`⚠️ No credentials found for ${connection.exchange_name}`);
        continue;
      }

      try {
        const balance = await syncExchangeViaProxy(connection.exchange_name, creds);
        totalBalance += balance;
        hadSuccess = true;
        console.log(`✅ ${connection.exchange_name} balance: $${balance.toFixed(2)} USDT`);
      } catch (error) {
        console.error(`❌ Error syncing ${connection.exchange_name}:`, error);
      }
    }

    if (hadSuccess) {
      // Update user stats with total balance
      const { error: updateError } = await supabaseClient
        .from('user_stats')
        .upsert({
          user_id: user.id,
          total_balance: totalBalance,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (updateError) {
        console.error('❌ Error updating user stats:', updateError);
      } else {
        console.log(`💾 Updated user stats with total balance: $${totalBalance.toFixed(2)} USDT`);
      }
    }

    console.log(`💰 Final total balance: $${totalBalance.toFixed(2)} USDT`);

    return new Response(JSON.stringify({ 
      message: "Balance sync completed",
      balance: totalBalance,
      success: hadSuccess
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('❌ Error in sync-exchange-balance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
