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
  
  // Crear cliente HTTP con proxy configurado
  const httpClient = Deno.createHttpClient({
    proxy: {
      url: proxyConfig.url,
      basicAuth: {
        username: proxyConfig.user,
        password: proxyConfig.password
      }
    }
  });

  try {
    const response = await fetch(url, {
      ...options,
      client: httpClient,
    });
    
    console.log(`✅ Proxy request successful: ${response.status}`);
    return response;
  } catch (error) {
    console.warn(`⚠️ Proxy request failed:`, error);
    throw error;
  } finally {
    httpClient.close();
  }
}

async function fetchBybitBalance(apiKey: string, apiSecret: string, accountType: string = 'UNIFIED'): Promise<number> {
  console.log(`🔍 Fetching Bybit ${accountType} balance via CloudFlare Worker...`);
  
  // SIEMPRE usar CloudFlare Worker como proxy
  const cfWorkerUrl = Deno.env.get('CLOUDFLARE_WORKER_URL');
  const cfWorkerToken = Deno.env.get('CLOUDFLARE_PROXY_TOKEN');
  
  if (!cfWorkerUrl || !cfWorkerToken) {
    throw new Error('CloudFlare Worker not configured. Add CLOUDFLARE_WORKER_URL and CLOUDFLARE_PROXY_TOKEN secrets.');
  }
  
  console.log(`☁️ Using CloudFlare Worker: ${cfWorkerUrl}`);
  
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
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CloudFlare Worker error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'CloudFlare Worker failed');
  }
  
  console.log(`✅ Balance fetched via CloudFlare Worker: ${data.balance}`);
  return data.balance;
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
  console.log('🔍 Fetching Binance balance via CloudFlare Worker...');
  
  // SIEMPRE usar CloudFlare Worker como proxy
  const cfWorkerUrl = Deno.env.get('CLOUDFLARE_WORKER_URL');
  const cfWorkerToken = Deno.env.get('CLOUDFLARE_PROXY_TOKEN');
  
  if (!cfWorkerUrl || !cfWorkerToken) {
    throw new Error('CloudFlare Worker not configured. Add CLOUDFLARE_WORKER_URL and CLOUDFLARE_PROXY_TOKEN secrets.');
  }
  
  console.log(`☁️ Using CloudFlare Worker: ${cfWorkerUrl}`);
  
  const response = await fetch(cfWorkerUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfWorkerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      exchange: 'binance',
      action: 'getBalance',
      apiKey,
      apiSecret,
      params: {}
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CloudFlare Worker error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'CloudFlare Worker failed');
  }
  
  console.log(`✅ Binance balance: ${data.balance}`);
  return data.balance;
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
