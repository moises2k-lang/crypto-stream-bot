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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ENCRYPTION_KEY = Deno.env.get("EXCHANGE_ENCRYPTION_KEY");
    if (!ENCRYPTION_KEY) {
      console.error("Missing EXCHANGE_ENCRYPTION_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get exchange connection
    const { data: connection } = await supabaseClient
      .from('exchange_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('exchange_name', exchangeName)
      .eq('is_connected', true)
      .single();

    if (!connection) {
      return new Response(JSON.stringify({ 
        error: `No connected ${exchangeName} exchange`,
        logs: [`No active connection found for ${exchangeName}`]
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get encrypted credentials
    const { data: creds } = await supabaseClient
      .from('exchange_credentials')
      .select('*')
      .eq('user_id', user.id)
      .eq('exchange_name', exchangeName)
      .single();

    if (!creds) {
      return new Response(JSON.stringify({ 
        error: "Credentials not found",
        logs: [`Credentials not found for ${exchangeName}`]
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt API keys
    let apiKey: string;
    let apiSecret: string;
    const logs: string[] = [];
    
    try {
      apiKey = await decrypt(
        creds.api_key_ciphertext,
        creds.api_key_iv,
        creds.salt,
        ENCRYPTION_KEY
      );
      apiSecret = await decrypt(
        creds.api_secret_ciphertext,
        creds.api_secret_iv,
        creds.salt,
        ENCRYPTION_KEY
      );
      logs.push(`✓ Credentials decrypted successfully for ${exchangeName}`);
    } catch (e: any) {
      logs.push(`✗ Decryption failed: ${e.message}`);
      return new Response(JSON.stringify({
        error: "Decryption failed",
        logs
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let balance = 0;

    if (exchangeName === 'Bybit') {
      const recvWindow = '5000';
      
      for (const accountType of ['UNIFIED', 'CONTRACT'] as const) {
        const timestamp = Date.now().toString();
        const queryString = `accountType=${accountType}`;
        const prehash = `${timestamp}${apiKey}${recvWindow}${queryString}`;

        const encoder = new TextEncoder();
        const keyData = encoder.encode(apiSecret);
        const messageData = encoder.encode(prehash);

        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
        const signatureHex = Array.from(new Uint8Array(signature))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        const url = `https://api.bybit.com/v5/account/wallet-balance?${queryString}`;
        
        try {
          logs.push(`→ Requesting Bybit ${accountType} balance...`);
          const response = await fetch(url, {
            headers: {
              'X-BAPI-API-KEY': apiKey,
              'X-BAPI-TIMESTAMP': timestamp,
              'X-BAPI-RECV-WINDOW': recvWindow,
              'X-BAPI-SIGN': signatureHex,
              'X-BAPI-SIGN-TYPE': '2',
            },
          });

          logs.push(`← Bybit ${accountType} response: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            logs.push(`✗ Bybit API error (${accountType}): ${response.status} ${response.statusText}`);
            continue;
          }

          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            logs.push(`✗ Bybit returned non-JSON response (${accountType})`);
            continue;
          }

          const data = await response.json();
          logs.push(`← Bybit ${accountType} data: ${JSON.stringify(data)}`);

          if (data.retCode === 0 && data.result?.list) {
            const walletBalance = data.result.list[0]?.totalEquity || '0';
            balance = parseFloat(walletBalance);
            logs.push(`✓ Bybit ${accountType} balance: $${balance}`);
            break;
          } else {
            logs.push(`✗ Bybit error (${accountType}): retCode=${data?.retCode}, retMsg=${data?.retMsg}`);
          }
        } catch (err: any) {
          logs.push(`✗ Bybit fetch failed (${accountType}): ${err.message}`);
        }
      }
    } else if (exchangeName === 'Binance') {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      
      const encoder = new TextEncoder();
      const keyData = encoder.encode(apiSecret);
      const messageData = encoder.encode(queryString);
      
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      
      const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
      const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const binanceBases = [
        'https://api.binance.com',
        'https://api1.binance.com',
        'https://api2.binance.com',
        'https://api3.binance.com',
        'https://api4.binance.com'
      ];

      let response: Response | null = null;
      
      for (const base of binanceBases) {
        try {
          logs.push(`→ Trying Binance account API: ${base}`);
          const r = await fetch(`${base}/api/v3/account?${queryString}&signature=${signatureHex}`, {
            headers: {
              'X-MBX-APIKEY': apiKey,
            }
          });
          
          logs.push(`← Binance response from ${base}: ${r.status} ${r.statusText}`);
          
          if (r.ok) {
            response = r;
            logs.push(`✓ Binance API success on ${base}`);
            break;
          }
          
          if (r.status !== 451 && r.status !== 403) {
            logs.push(`⚠ Binance API responded with status ${r.status} on ${base}`);
          } else {
            logs.push(`✗ Binance API geo-blocked (${r.status}) on ${base}`);
          }
        } catch (e: any) {
          logs.push(`✗ Binance fetch failed on ${base}: ${e.message}`);
        }
      }

      if (!response || !response.ok) {
        logs.push(`✗ Binance API not reachable on any endpoint`);
        return new Response(JSON.stringify({ 
          error: "Binance API not reachable",
          balance: 0,
          logs
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      logs.push(`← Binance account data received: ${data?.balances?.length || 0} balances`);

      if (Array.isArray(data?.balances)) {
        // Get prices
        let pricesRes: Response | null = null;
        for (const base of binanceBases) {
          try {
            logs.push(`→ Trying Binance price API: ${base}`);
            const pr = await fetch(`${base}/api/v3/ticker/price`);
            if (pr.ok) {
              pricesRes = pr;
              logs.push(`✓ Binance price API success on ${base}`);
              break;
            }
          } catch (e: any) {
            logs.push(`✗ Binance price fetch failed on ${base}: ${e.message}`);
          }
        }

        if (!pricesRes || !pricesRes.ok) {
          logs.push(`⚠ Binance price API error - using USDT only`);
          const usdtBalance = data.balances.find((b: any) => b.asset === 'USDT');
          if (usdtBalance) {
            balance = parseFloat(usdtBalance.free || '0') + parseFloat(usdtBalance.locked || '0');
            logs.push(`✓ Binance USDT balance: $${balance}`);
          }
        } else {
          const pricesJson = await pricesRes.json();
          const priceMap = new Map<string, number>();
          for (const p of pricesJson) {
            if (p?.symbol && p?.price) {
              priceMap.set(p.symbol, parseFloat(p.price));
            }
          }
          logs.push(`✓ Loaded ${priceMap.size} price pairs`);

          let usdtTotal = 0;
          for (const b of data.balances) {
            const free = parseFloat(b.free ?? '0');
            const locked = parseFloat(b.locked ?? '0');
            const qty = free + locked;
            
            if (qty <= 0.00000001) continue;
            
            const asset = String(b.asset);

            if (asset === 'USDT') {
              usdtTotal += qty;
              continue;
            }

            const symbol = `${asset}USDT`;
            const price = priceMap.get(symbol);

            if (typeof price === 'number' && !Number.isNaN(price) && price > 0) {
              const usdtValue = qty * price;
              usdtTotal += usdtValue;
              logs.push(`  ${asset}: ${qty} @ $${price} = $${usdtValue.toFixed(2)}`);
            } else if (asset === 'BUSD' || asset === 'FDUSD') {
              usdtTotal += qty;
              logs.push(`  ${asset}: $${qty} (stablecoin)`);
            }
          }

          balance = usdtTotal;
          logs.push(`✓ Total Binance USDT equivalent: $${balance.toFixed(2)}`);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: balance > 0,
      exchange: exchangeName,
      balance,
      logs
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Error syncing balance:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      logs: [`Fatal error: ${error.message}`]
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
