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
  console.log('🚀 Starting sync-exchange-balance-single function');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { exchangeName } = await req.json();
    
    if (!exchangeName || !['Binance', 'Bybit'].includes(exchangeName)) {
      return new Response(JSON.stringify({ error: "Invalid exchange name. Must be 'Binance' or 'Bybit'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('📊 Requested exchange:', exchangeName);

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

    // Get Cloudflare Worker configuration
    const workerUrl = Deno.env.get('CLOUDFLARE_WORKER_URL');
    const proxyToken = Deno.env.get('CLOUDFLARE_PROXY_TOKEN');
    
    if (!workerUrl || !proxyToken) {
      console.error('❌ Missing Cloudflare Worker configuration');
      return new Response(
        JSON.stringify({ error: 'Cloudflare Worker not configured. Please add CLOUDFLARE_WORKER_URL and CLOUDFLARE_PROXY_TOKEN secrets.' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('🌍 Using Cloudflare Worker:', workerUrl);

    const ENCRYPTION_KEY = Deno.env.get("EXCHANGE_ENCRYPTION_KEY");
    if (!ENCRYPTION_KEY) {
      console.error("❌ Missing EXCHANGE_ENCRYPTION_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all exchange connections (demo and real)
    const { data: connections } = await supabaseClient
      .from('exchange_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('exchange_name', exchangeName)
      .eq('is_connected', true);

    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ 
        error: `No connected ${exchangeName} exchange`,
        logs: [`No active connection found for ${exchangeName}`]
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📋 Found ${connections.length} connection(s) for ${exchangeName}`);

    // Get all encrypted credentials for this exchange
    const { data: allCreds } = await supabaseClient
      .from('exchange_credentials')
      .select('*')
      .eq('user_id', user.id)
      .eq('exchange_name', exchangeName);

    if (!creds) {
      return new Response(JSON.stringify({ 
        error: "Credentials not found",
        logs: [`No credentials found for ${exchangeName}`]
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt credentials
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

    console.log('🔓 Credentials decrypted successfully');

    // Detectar cuenta demo
    if (apiKey.startsWith('DEMO_')) {
      console.log('🎮 Demo account detected, returning stored balance');
      
      const { data: userStats } = await supabaseClient
        .from('user_stats')
        .select('total_balance')
        .eq('user_id', user.id)
        .single();
      
      const demoBalance = userStats?.total_balance || 0;
      
      return new Response(JSON.stringify({
        success: true,
        balance: demoBalance,
        logs: [
          `🎮 Cuenta demo de ${exchangeName}`,
          `💰 Saldo demo: $${demoBalance.toFixed(2)} USD`,
          `ℹ️ Este es un saldo simulado`
        ]
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🌐 Calling Cloudflare Worker proxy in Europe...');

    // Call Cloudflare Worker proxy instead of direct API calls
    const proxyResponse = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proxyToken}`
      },
      body: JSON.stringify({
        exchange: exchangeName.toLowerCase(),
        action: 'getBalance',
        apiKey: apiKey,
        apiSecret: apiSecret,
        params: {
          // Para Bybit, consultar TODAS las wallets
          accountTypes: exchangeName.toLowerCase() === 'bybit' 
            ? ['UNIFIED', 'SPOT', 'CONTRACT', 'FUNDING'] 
            : undefined
        }
      })
    });

    if (!proxyResponse.ok) {
      const errorText = await proxyResponse.text();
      console.error('❌ Cloudflare Worker error:', proxyResponse.status, errorText);

      // Graceful handling for geo-restricted or unreachable responses (e.g. 451/403/502)
      const isGeoOrBlocked =
        proxyResponse.status === 451 ||
        proxyResponse.status === 403 ||
        proxyResponse.status === 502 ||
        /restricted location|All Binance endpoints failed/i.test(errorText);

      if (isGeoOrBlocked) {
        const logs = [
          `⚠️ ${exchangeName} bloqueado o no disponible desde la ubicación actual (código ${proxyResponse.status}).`,
          'Motivo probable: geobloqueo. Binance puede bloquear ciertas IPs de Cloudflare.',
          'Sugerencia: usar VPS europeo con IP fija o un proxy dedicado en la UE y enrutar el Worker hacia ese VPS.',
        ];
        return new Response(JSON.stringify({
          success: false,
          balance: 0,
          error: 'Restricted or unreachable location',
          logs,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Cloudflare Worker error: ${proxyResponse.status} - ${errorText}`);
    }

    const proxyData = await proxyResponse.json();
    console.log('✅ Cloudflare Worker response:', JSON.stringify(proxyData));

    if (proxyData.error) {
      throw new Error(`Proxy error: ${proxyData.error}`);
    }

    let balance = proxyData.balance || 0;
    let logs: string[] = [];

    if (exchangeName === 'Bybit') {
      logs.push(`✅ Bybit balance: $${balance.toFixed(2)} USDT`);
      logs.push(`🌍 Connected via Cloudflare Worker (Europe)`);
    } else if (exchangeName === 'Binance') {
      logs.push(`✅ Binance balance: $${balance.toFixed(2)} USDT`);
      logs.push(`🌍 Connected via Cloudflare Worker (Europe)`);
      if (proxyData.endpoint) {
        logs.push(`📡 Binance endpoint: ${proxyData.endpoint}`);
      }
    }

    console.log(`💰 Final balance: $${balance.toFixed(2)} USDT`);

    return new Response(JSON.stringify({ 
      balance,
      logs,
      success: true
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Error in sync-exchange-balance-single:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      logs: [`Error: ${errorMessage}`]
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
