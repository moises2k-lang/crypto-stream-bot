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

// Configuración del proxy Webshare
function getProxyConfig() {
  const host = Deno.env.get('WEBSHARE_PROXY_HOST');
  const port = Deno.env.get('WEBSHARE_PROXY_PORT');
  const user = Deno.env.get('WEBSHARE_PROXY_USER');
  const password = Deno.env.get('WEBSHARE_PROXY_PASSWORD');

  if (!host || !port || !user || !password) {
    console.warn('⚠️ Webshare proxy credentials not configured');
    return null;
  }

  return {
    host,
    port,
    user,
    password,
    url: `http://${user}:${password}@${host}:${port}`
  };
}

async function fetchWithProxy(url: string, options: RequestInit = {}): Promise<Response> {
  const proxyConfig = getProxyConfig();
  
  if (!proxyConfig) {
    console.log('📡 Making direct request (no proxy configured)');
    return fetch(url, options);
  }

  console.log(`🌐 Using Webshare proxy: ${proxyConfig.host}:${proxyConfig.port}`);
  
  // Crear headers con autenticación de proxy
  const proxyAuth = btoa(`${proxyConfig.user}:${proxyConfig.password}`);
  const headers = {
    ...options.headers,
    'Proxy-Authorization': `Basic ${proxyAuth}`,
  };

  // Intentar con proxy configurado
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    console.log(`✅ Proxy request successful: ${response.status}`);
    return response;
  } catch (error) {
    console.warn(`⚠️ Proxy request failed, trying direct connection:`, error);
    // Fallback a conexión directa si el proxy falla
    return fetch(url, options);
  }
}

async function fetchBybitBalance(apiKey: string, apiSecret: string, accountType: string = 'UNIFIED'): Promise<number> {
  const timestamp = Date.now().toString();
  const params = new URLSearchParams({ accountType });
  const queryString = params.toString();
  const signString = timestamp + apiKey + '5000' + queryString;
  const signature = await signHmacSha256(signString, apiSecret);
  
  const url = `https://api.bybit.com/v5/account/wallet-balance?${queryString}`;
  
  console.log(`🔍 Fetching Bybit ${accountType} balance from EU proxy...`);
  
  // Headers para simular navegador europeo
  const headers = {
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-SIGN': signature,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': '5000',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://www.bybit.com',
    'Referer': 'https://www.bybit.com/',
  };
  
  // Intentar con diferentes estrategias
  let lastError: Error | null = null;
  
  // Estrategia 1: Directo con headers europeos
  try {
    const response = await fetch(url, { headers });
    
    if (response.ok) {
      const data = await response.json();
      if (data.retCode === 0) {
        const balance = extractBybitBalance(data);
        console.log(`✅ Bybit ${accountType} balance fetched successfully: ${balance}`);
        return balance;
      }
      throw new Error(`Bybit API error: ${data.retMsg}`);
    }
    
    if (response.status !== 403) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    console.warn(`⚠️ Direct request blocked (403), trying alternative method...`);
  } catch (error) {
    lastError = error as Error;
    console.warn(`⚠️ Direct request failed:`, error);
  }
  
  // Estrategia 2: Usar CloudFlare Workers como proxy (si está configurado)
  const cfWorkerUrl = Deno.env.get('CLOUDFLARE_WORKER_URL');
  const cfWorkerToken = Deno.env.get('CLOUDFLARE_PROXY_TOKEN');
  
  if (cfWorkerUrl && cfWorkerToken) {
    try {
      console.log(`🔄 Trying CloudFlare Worker proxy...`);
      const response = await fetch(cfWorkerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfWorkerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exchange: 'bybit',
          action: 'getBalance',
          apiKey,
          apiSecret,
          params: { accountTypes: [accountType] }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`✅ Balance fetched via CloudFlare Worker: ${data.balance}`);
          return data.balance;
        }
      }
    } catch (error) {
      console.warn(`⚠️ CloudFlare Worker failed:`, error);
    }
  }
  
  // Si todo falla, lanzar el último error
  throw lastError || new Error('All proxy methods failed');
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

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    console.log(`✅ User authenticated: ${user.id}`);
    
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
        status: errorMessage === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
