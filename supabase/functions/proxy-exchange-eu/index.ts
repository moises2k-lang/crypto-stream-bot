import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExchangeRequest {
  exchange: string;
  action: string;
  apiKey: string;
  apiSecret: string;
  params?: any;
}

async function signHmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchBybitBalance(apiKey: string, apiSecret: string, accountType: string = 'UNIFIED'): Promise<number> {
  const timestamp = Date.now().toString();
  const params = new URLSearchParams({ accountType });
  const queryString = params.toString();
  const signString = timestamp + apiKey + '5000' + queryString;
  const signature = await signHmacSha256(signString, apiSecret);
  
  const url = `https://api.bybit.com/v5/account/wallet-balance?${queryString}`;
  
  console.log(`🔍 Fetching Bybit ${accountType} balance directly...`);
  
  const headers = {
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-SIGN': signature,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': '5000',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
  };
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  const data = await response.json();
  if (data.retCode !== 0) {
    throw new Error(`Bybit API error: ${data.retMsg}`);
  }
  
  const balance = extractBybitBalance(data);
  console.log(`✅ Bybit ${accountType} balance: ${balance}`);
  return balance;
}

function extractBybitBalance(data: any): number {
  if (!data.result?.list || data.result.list.length === 0) {
    return 0;
  }
  
  const account = data.result.list[0];
  if (!account.coin) {
    return 0;
  }
  
  for (const coin of account.coin) {
    if (coin.coin === 'USDT') {
      return parseFloat(coin.walletBalance || coin.equity || '0');
    }
  }
  
  return 0;
}

async function fetchBinanceBalance(apiKey: string, apiSecret: string): Promise<number> {
  console.log('🔍 Fetching Binance balance...');
  
  const timestamp = Date.now();
  const params = `timestamp=${timestamp}`;
  const signature = await signHmacSha256(params, apiSecret);
  
  const url = `https://api.binance.com/api/v3/account?${params}&signature=${signature}`;
  
  const headers = {
    'X-MBX-APIKEY': apiKey,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  const data = await response.json();
  let totalUsdt = 0;
  
  for (const balance of data.balances || []) {
    if (balance.asset === 'USDT') {
      totalUsdt += parseFloat(balance.free) + parseFloat(balance.locked);
    }
  }
  
  console.log(`✅ Binance balance: ${totalUsdt}`);
  return totalUsdt;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting proxy-exchange-eu function');
    
    // Authenticate user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const isInternalCall = token === anonKey;

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user && !isInternalCall) {
      throw new Error('Unauthorized');
    }

    if (user) {
      console.log(`✅ User authenticated: ${user.id}`);
    } else {
      console.log('✅ Internal call authenticated with anon key');
    }
    
    const body: ExchangeRequest = await req.json();
    const { exchange, action, apiKey, apiSecret, params } = body;
    
    console.log(`📊 Request: ${exchange} - ${action}`);
    
    if (action !== 'getBalance') {
      throw new Error('Only getBalance action is supported');
    }
    
    let balance = 0;
    
    if (exchange === 'bybit') {
      const accountTypes = params?.accountTypes || ['UNIFIED'];
      
      for (const accountType of accountTypes) {
        try {
          const accountBalance = await fetchBybitBalance(apiKey, apiSecret, accountType);
          balance += accountBalance;
        } catch (error) {
          console.error(`❌ Error fetching ${accountType} balance:`, error);
          // Continuar con otros tipos de cuenta
        }
      }
    } else if (exchange === 'binance') {
      balance = await fetchBinanceBalance(apiKey, apiSecret);
    } else {
      throw new Error('Unsupported exchange');
    }
    
    console.log(`💰 Total balance: ${balance}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        balance,
        source: 'eu-proxy'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
