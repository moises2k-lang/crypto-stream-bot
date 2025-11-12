import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Decrypt function
    async function decrypt(encryptedData: string, iv: string, key: string): Promise<string> {
      const keyBuffer = new TextEncoder().encode(key.padEnd(32, '0').slice(0, 32));
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBuffer },
        cryptoKey,
        encryptedBuffer
      );

      return new TextDecoder().decode(decrypted);
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

    for (const connection of connections) {
      // Get encrypted credentials
      const { data: creds } = await supabaseClient
        .from('exchange_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange_name', connection.exchange_name)
        .single();

      if (!creds) continue;

      // Decrypt API keys
      const apiKey = await decrypt(creds.api_key_ciphertext, creds.api_key_iv, ENCRYPTION_KEY);
      const apiSecret = await decrypt(creds.api_secret_ciphertext, creds.api_secret_iv, ENCRYPTION_KEY);

      // Fetch balance based on exchange
      if (connection.exchange_name === 'Bybit') {
        const timestamp = Date.now();
        const params = `timestamp=${timestamp}`;
        
        // Create signature for Bybit
        const encoder = new TextEncoder();
        const keyData = encoder.encode(apiSecret);
        const messageData = encoder.encode(params);
        
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

        const response = await fetch(`https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED&${params}&sign=${signatureHex}`, {
          headers: {
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-TIMESTAMP': timestamp.toString(),
            'X-BAPI-SIGN': signatureHex,
          }
        });

        const data = await response.json();
        console.log('Bybit balance response:', data);

        if (data.retCode === 0 && data.result?.list) {
          const walletBalance = data.result.list[0]?.totalEquity || '0';
          totalBalance += parseFloat(walletBalance);
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

        const response = await fetch(`https://api.binance.com/api/v3/account?${queryString}&signature=${signatureHex}`, {
          headers: {
            'X-MBX-APIKEY': apiKey,
          }
        });

        const data = await response.json();
        console.log('Binance balance response:', data);

        if (data.balances) {
          // Sum all balances in USDT equivalent
          const usdtBalance = data.balances.find((b: any) => b.asset === 'USDT');
          if (usdtBalance) {
            totalBalance += parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked);
          }
        }
      }
    }

    // Update user_stats with new balance
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

    return new Response(JSON.stringify({ 
      success: true,
      balance: totalBalance 
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