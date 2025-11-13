import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fromBase64(input: string): Uint8Array {
  // Support standard and URL-safe base64
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

serve(async (req) => {
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

    for (const connection of connections) {
      // Get encrypted credentials
      const { data: creds } = await supabaseClient
        .from('exchange_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange_name', connection.exchange_name)
        .single();

      if (!creds) continue;

// Decrypt API keys with salt
let apiKey: string;
let apiSecret: string;
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
} catch (e) {
  console.error('Decryption failed for', connection.exchange_name, e);
  // Skip this connection if decryption fails (likely due to legacy mismatched salt)
  continue;
}

      // Fetch balance based on exchange
      if (connection.exchange_name === 'Bybit') {
        const recvWindow = '5000';

        const attemptFetch = async (accountType: 'UNIFIED' | 'CONTRACT') => {
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
          const response = await fetch(url, {
            headers: {
              'X-BAPI-API-KEY': apiKey,
              'X-BAPI-TIMESTAMP': timestamp,
              'X-BAPI-RECV-WINDOW': recvWindow,
              'X-BAPI-SIGN': signatureHex,
              'X-BAPI-SIGN-TYPE': '2',
            },
          });

          return response;
        };

        let bybitSuccess = false;
        for (const type of ['UNIFIED', 'CONTRACT'] as const) {
          try {
            const response = await attemptFetch(type);

            if (!response.ok) {
              console.error(`Bybit API error (${type}):`, response.status, response.statusText);
              continue;
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              console.error(`Bybit returned non-JSON response (${type})`);
              continue;
            }

            const data = await response.json();
            console.log(`Bybit balance response (${type}):`, data);

            if (data.retCode === 0 && data.result?.list) {
              const walletBalance = data.result.list[0]?.totalEquity || '0';
              totalBalance += parseFloat(walletBalance);
              hadSuccess = true;
              bybitSuccess = true;
              break;
            } else {
              console.error('Bybit balance error:', {
                accountType: type,
                retCode: data?.retCode,
                retMsg: data?.retMsg,
              });
            }
          } catch (err) {
            console.error(`Bybit fetch failed (${type}):`, err);
          }
        }

        if (!bybitSuccess) {
          console.warn('Bybit balance fetch failed for all account types');
        }
      } else if (connection.exchange_name === 'Binance') {
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        
        // Create signature for Binance
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

        // Try Binance API endpoints
        let response: Response | null = null;
        const binanceBases = [
          'https://api.binance.com',
          'https://api1.binance.com',
          'https://api2.binance.com',
          'https://api3.binance.com',
          'https://api4.binance.com'
        ];

        for (const base of binanceBases) {
          try {
            const r = await fetch(`${base}/api/v3/account?${queryString}&signature=${signatureHex}`, {
              headers: {
                'X-MBX-APIKEY': apiKey,
              }
            });
            
            if (r.ok) {
              response = r;
              console.log(`Binance API success on ${base}`);
              break;
            }
            
            if (r.status !== 451 && r.status !== 403) {
              console.log(`Binance API responded with status ${r.status} on ${base}`);
            }
          } catch (e) {
            console.error(`Binance fetch failed on ${base}:`, e);
          }
        }

        if (!response) {
          console.error('Binance API not reachable on any endpoint');
          continue;
        }

        if (!response.ok) {
          console.error('Binance API error:', response.status, response.statusText);
          continue;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Binance returned non-JSON response');
          continue;
        }

        const data = await response.json();
        console.log('Binance balance response: balances count:', Array.isArray(data?.balances) ? data.balances.length : 0);

        if (Array.isArray(data?.balances)) {
          try {
            // Fetch current prices for all trading pairs
            let pricesRes: Response | null = null;
            for (const base of binanceBases) {
              try {
                const pr = await fetch(`${base}/api/v3/ticker/price`);
                if (pr.ok) {
                  pricesRes = pr;
                  console.log(`Binance price API success on ${base}`);
                  break;
                }
              } catch (e) {
                console.error(`Binance price fetch failed on ${base}:`, e);
              }
            }

            if (!pricesRes || !pricesRes.ok) {
              console.error('Binance price API error - using USDT only');
              // Fallback to USDT only if price API fails
              const usdtBalance = data.balances.find((b: any) => b.asset === 'USDT');
              if (usdtBalance) {
                totalBalance += parseFloat(usdtBalance.free || '0') + parseFloat(usdtBalance.locked || '0');
                hadSuccess = true;
              }
              continue;
            }

            const pricesJson = await pricesRes.json();
            const priceMap = new Map<string, number>();
            for (const p of pricesJson) {
              if (p?.symbol && p?.price) {
                priceMap.set(p.symbol, parseFloat(p.price));
              }
            }

            let userUsdtTotal = 0;
            for (const b of data.balances) {
              const free = parseFloat(b.free ?? '0');
              const locked = parseFloat(b.locked ?? '0');
              const qty = free + locked;
              
              if (qty <= 0.00000001) continue; // Skip dust
              
              const asset = String(b.asset);

              if (asset === 'USDT') {
                userUsdtTotal += qty;
                continue;
              }

              // Try to find price for this asset
              const symbol = `${asset}USDT`;
              const price = priceMap.get(symbol);

              if (typeof price === 'number' && !Number.isNaN(price) && price > 0) {
                const usdtValue = qty * price;
                userUsdtTotal += usdtValue;
                console.log(`${asset}: ${qty} @ ${price} = ${usdtValue} USDT`);
              } else if (asset === 'BUSD' || asset === 'FDUSD') {
                // Stablecoins pegged to USD
                userUsdtTotal += qty;
              } else {
                console.warn(`No USDT pair found for ${asset} (qty: ${qty})`);
              }
            }

            if (userUsdtTotal > 0) {
              totalBalance += userUsdtTotal;
              hadSuccess = true;
              console.log(`Total Binance USDT equivalent: ${userUsdtTotal}`);
            }
          } catch (e) {
            console.error('Error converting Binance balances to USDT:', e);
          }
        }
      }
    }

    // Update user_stats with new balance only if we had any successful fetch
    if (hadSuccess) {
      const { error: updateError } = await supabaseClient
        .from('user_stats')
        .update({ 
          total_balance: totalBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating balance:', updateError);
      }
    } else {
      console.warn('No exchange balances fetched successfully, skipping user_stats update');
    }

    return new Response(JSON.stringify({ 
      success: hadSuccess,
      balance: hadSuccess ? totalBalance : null,
      message: hadSuccess ? 'Balance synced' : 'No balances fetched (errors upstream)'
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Error syncing balance:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});