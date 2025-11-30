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

    console.log('🌍 Direct connection to exchange APIs');

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

    if (!allCreds || allCreds.length === 0) {
      return new Response(JSON.stringify({ 
        error: "Credentials not found",
        logs: [`No credentials found for ${exchangeName}`]
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalBalance = 0;
    const allLogs: string[] = [];

    // Process each account type (demo and real)
    for (let idx = 0; idx < allCreds.length; idx++) {
      const cred = allCreds[idx];
      const accountType = cred.account_type || 'real';
      allLogs.push(`\n--- Processing ${exchangeName} ${accountType.toUpperCase()} account ---`);
      
      // Decrypt credentials
      const apiKey = await decrypt(
        cred.api_key_ciphertext,
        cred.api_key_iv,
        cred.salt,
        ENCRYPTION_KEY
      );

      const apiSecret = await decrypt(
        cred.api_secret_ciphertext,
        cred.api_secret_iv,
        cred.salt,
        ENCRYPTION_KEY
      );

      allLogs.push('🔓 Credentials decrypted successfully');

      // Detectar cuenta demo
      if (apiKey.startsWith('DEMO_')) {
        allLogs.push('🎮 Demo account detected, using stored balance');
        
        const { data: userStats } = await supabaseClient
          .from('user_stats')
          .select('total_balance')
          .eq('user_id', user.id)
          .single();
        
        const demoBalance = userStats?.total_balance || 10000;
        totalBalance += demoBalance;
        
        allLogs.push(`✓ Demo balance: $${demoBalance}`);
        continue;
      }

      // Call proxy server to fetch balance
      try {
        const proxyUrl = Deno.env.get('EXCHANGE_PROXY_URL') || 'https://sistema.mbconstruccion.com/api/exchange/balance';
        const proxyApiKey = Deno.env.get('EXCHANGE_PROXY_KEY') || '';
        
        if (!proxyApiKey) {
          throw new Error('EXCHANGE_PROXY_KEY not configured');
        }

        allLogs.push(`🔄 Fetching ${accountType} balance via proxy server...`);
        
        const proxyResponse = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${proxyApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            exchange: exchangeName.toLowerCase(),
            apiKey: apiKey,
            apiSecret: apiSecret,
            accountType: accountType
          }),
        });

        if (!proxyResponse.ok) {
          const errorText = await proxyResponse.text();
          throw new Error(`Proxy error: ${proxyResponse.status} - ${errorText}`);
        }

        const proxyData = await proxyResponse.json();
        
        if (proxyData.success) {
          const accountBalance = proxyData.balance || 0;
          totalBalance += accountBalance;
          allLogs.push(`✅ ${accountType} balance from proxy: $${accountBalance}`);
        } else {
          throw new Error(proxyData.error || 'Unknown proxy error');
        }

      } catch (error: any) {
        allLogs.push(`❌ Error for ${accountType}: ${error.message}`);
        console.error(`Error processing ${accountType} account:`, error.message);
      }
    }

    allLogs.push(`\n💰 Total balance from all ${exchangeName} accounts: $${totalBalance.toFixed(2)}`);
    console.log('💰 Final total balance:', totalBalance);

    // Update user_stats
    const { error: updateError } = await supabaseClient
      .from('user_stats')
      .upsert({
        user_id: user.id,
        total_balance: totalBalance,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (updateError) {
      console.error('❌ Error updating user_stats:', updateError);
      allLogs.push(`⚠️ Warning: Could not update stats: ${updateError.message}`);
    } else {
      console.log('✅ User stats updated successfully');
      allLogs.push('✓ Stats updated successfully');
    }

    return new Response(JSON.stringify({ 
      success: true,
      balance: totalBalance,
      logs: allLogs 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      logs: [`Unexpected error: ${error.message}`]
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
