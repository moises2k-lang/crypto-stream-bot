import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SlotState {
  id?: string;
  bot_id: string;
  slot_id: number;
  entry_price: number;
  tp_price: number;
  size_usdt: number;
  qty: number;
  buy_order_id: string;
  tp_order_id: string;
  status: 'waiting' | 'buy_open' | 'bought' | 'closed';
  filled_qty: number;
  last_update_ts: Date;
}

async function logMessage(supabase: any, botId: string, level: string, message: string, details?: any) {
  await supabase.from('bot_logs').insert({
    bot_id: botId,
    log_level: level,
    message,
    details: details || null
  });
  console.log(`[${level.toUpperCase()}] ${message}`, details || '');
}

function roundPrice(price: number, precision: number = 2): number {
  return Math.round(price * Math.pow(10, precision)) / Math.pow(10, precision);
}

function roundAmount(amount: number, precision: number = 4): number {
  return Math.round(amount * Math.pow(10, precision)) / Math.pow(10, precision);
}

async function fetchATR(
  workerUrl: string,
  token: string,
  apiKey: string,
  apiSecret: string,
  symbol: string,
  timeframe: string,
  period: number
): Promise<number | null> {
  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        exchange: 'bybit',
        action: 'getOHLCV',
        apiKey,
        apiSecret,
        params: { symbol, timeframe, limit: period + 2 }
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data.ohlcv || data.ohlcv.length < period + 1) return null;

    const ohlcv = data.ohlcv;
    const trs: number[] = [];
    
    for (let i = 1; i < ohlcv.length; i++) {
      const high = ohlcv[i][2];
      const low = ohlcv[i][3];
      const prevClose = ohlcv[i - 1][4];
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trs.push(tr);
    }

    if (trs.length < period) return null;
    const atr = trs.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
    return atr;
  } catch (e) {
    console.error('Error fetching ATR:', e);
    return null;
  }
}

function computeEntryLevels(
  refPrice: number,
  method: string,
  numSlots: number,
  atrValue: number | null,
  levelAtrMults: number[] | null,
  levelPcts: number[] | null
): number[] {
  const targets: number[] = [];
  
  if (method === 'atr' && atrValue !== null) {
    const mults = levelAtrMults || Array.from({ length: numSlots }, (_, i) => i);
    for (let i = 0; i < numSlots; i++) {
      const price = refPrice - (atrValue * mults[i]);
      targets.push(roundPrice(price, 2));
    }
  } else if (method === 'percent' && levelPcts) {
    for (let i = 0; i < numSlots; i++) {
      const price = refPrice * (1 + levelPcts[i]);
      targets.push(roundPrice(price, 2));
    }
  } else {
    // Fallback
    for (let i = 0; i < numSlots; i++) {
      const pct = -0.01 * i;
      const price = refPrice * (1 + pct);
      targets.push(roundPrice(price, 2));
    }
  }

  return targets.sort((a, b) => b - a);
}

function computeTP(
  entryPrice: number,
  method: string,
  atrValue: number | null,
  tpAtrMult: number | null,
  tpPct: number | null,
  tpFixed: number | null
): number {
  if (method === 'atr_above_entry' && atrValue !== null && tpAtrMult !== null) {
    return roundPrice(entryPrice + atrValue * tpAtrMult, 2);
  }
  if (method === 'percent_of_entry' && tpPct !== null) {
    return roundPrice(entryPrice * (1 + tpPct), 2);
  }
  if (method === 'fixed' && tpFixed !== null && tpFixed > 0) {
    return roundPrice(tpFixed, 2);
  }
  return roundPrice(entryPrice * 1.005, 2);
}

async function placeBuyOrder(
  workerUrl: string,
  token: string,
  apiKey: string,
  apiSecret: string,
  symbol: string,
  qty: number,
  price: number,
  dryRun: boolean
): Promise<string> {
  if (dryRun) {
    return `DRY-BUY-${Date.now()}`;
  }

  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      exchange: 'bybit',
      action: 'createOrder',
      apiKey,
      apiSecret,
      params: {
        symbol,
        type: 'limit',
        side: 'buy',
        amount: qty,
        price,
        reduceOnly: false,
        timeInForce: 'PostOnly'
      }
    }),
  });

  const data = await response.json();
  return data.order?.id || '';
}

async function placeTPOrder(
  workerUrl: string,
  token: string,
  apiKey: string,
  apiSecret: string,
  symbol: string,
  qty: number,
  price: number,
  dryRun: boolean
): Promise<string> {
  if (dryRun) {
    return `DRY-TP-${Date.now()}`;
  }

  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      exchange: 'bybit',
      action: 'createOrder',
      apiKey,
      apiSecret,
      params: {
        symbol,
        type: 'limit',
        side: 'sell',
        amount: qty,
        price,
        reduceOnly: true
      }
    }),
  });

  const data = await response.json();
  return data.order?.id || '';
}

async function cancelOrder(
  workerUrl: string,
  token: string,
  apiKey: string,
  apiSecret: string,
  symbol: string,
  orderId: string,
  dryRun: boolean
) {
  if (dryRun || !orderId) return;
  
  try {
    await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        exchange: 'bybit',
        action: 'cancelOrder',
        apiKey,
        apiSecret,
        params: { symbol, orderId }
      }),
    });
  } catch (e) {
    console.error('Error canceling order:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { botId } = await req.json();

    // Fetch bot configuration
    const { data: bot, error: botError } = await supabase
      .from('trading_bots')
      .select('*')
      .eq('id', botId)
      .eq('user_id', user.id)
      .single();

    if (botError || !bot) {
      console.error('Bot not found or inaccessible', botError);
      return new Response(
        JSON.stringify({ success: false, message: 'Bot not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!bot.is_active) {
      await logMessage(supabase, botId, 'info', 'Bot is inactive, skipping run');
      return new Response(
        JSON.stringify({ success: false, message: 'Bot is not active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await logMessage(supabase, botId, 'info', `Starting bot run for ${bot.name}`);

    // Get exchange credentials
    await logMessage(supabase, botId, 'info', `Looking for credentials: exchange=${bot.exchange_name}, account_type=${bot.account_type}`);
    
    const { data: creds, error: credsError } = await supabase
      .from('exchange_credentials')
      .select('*')
      .eq('user_id', user.id)
      .eq('exchange_name', bot.exchange_name)
      .eq('account_type', bot.account_type)
      .maybeSingle();

    if (!creds) {
      const errorMsg = `No exchange credentials configured for ${bot.exchange_name} (${bot.account_type}). Please connect your exchange in the settings.`;
      await logMessage(supabase, botId, 'error', errorMsg, { credsError });
      throw new Error(errorMsg);
    }

    const workerUrl = Deno.env.get('CLOUDFLARE_WORKER_URL')!;
    const proxyToken = Deno.env.get('CLOUDFLARE_PROXY_TOKEN')!;
    const encryptionKey = Deno.env.get('EXCHANGE_ENCRYPTION_KEY')!;

    // Decrypt credentials (simplified - in production use proper decryption)
    const apiKey = creds.api_key_ciphertext;
    const apiSecret = creds.api_secret_ciphertext;

    // Get current price
    const tickerResponse = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proxyToken}`,
      },
      body: JSON.stringify({
        exchange: 'bybit',
        action: 'getTicker',
        apiKey,
        apiSecret,
        params: { symbol: bot.symbol }
      }),
    });

    const tickerData = await tickerResponse.json();
    const refPrice = tickerData.ticker?.last || tickerData.ticker?.close || 0;

    if (refPrice <= 0) {
      await logMessage(supabase, botId, 'warn', 'Reference price not available');
      return new Response(
        JSON.stringify({ success: false, message: 'Price not available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await logMessage(supabase, botId, 'info', `Current price: ${refPrice}`);

    // Get capital
    const balanceResponse = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proxyToken}`,
      },
      body: JSON.stringify({
        exchange: 'bybit',
        action: 'getBalance',
        apiKey,
        apiSecret,
        params: { accountTypes: ['UNIFIED', 'SPOT', 'CONTRACT', 'FUNDING'] }
      }),
    });

    const balanceData = await balanceResponse.json();
    const baseCapital = balanceData.balance?.USDT || 10000;

    // Calculate ATR if needed
    let atrValue: number | null = null;
    if (bot.levels_method === 'atr' || bot.tp_method === 'atr_above_entry') {
      atrValue = await fetchATR(
        workerUrl,
        proxyToken,
        apiKey,
        apiSecret,
        bot.symbol,
        bot.atr_timeframe,
        bot.atr_period
      );
      
      if (atrValue) {
        await logMessage(supabase, botId, 'info', `ATR calculated: ${atrValue}`);
      }
    }

    // Compute entry levels
    const targets = computeEntryLevels(
      refPrice,
      bot.levels_method,
      bot.num_slots,
      atrValue,
      bot.level_atr_mults,
      bot.level_pcts
    );

    await logMessage(supabase, botId, 'info', `Entry levels: ${targets.join(', ')}`);

    // Calculate size per slot
    const allocTotal = bot.total_alloc_pct * baseCapital;
    const sizePerSlotUsdt = allocTotal / bot.num_slots;

    // Get existing slots
    const { data: existingSlots } = await supabase
      .from('bot_slots')
      .select('*')
      .eq('bot_id', botId);

    const slotsMap = new Map<number, any>();
    existingSlots?.forEach(slot => slotsMap.set(slot.slot_id, slot));

    const dryRun = !bot.is_testnet; // For now, treat non-testnet as dry run

    // Process each slot
    for (let idx = 1; idx <= bot.num_slots; idx++) {
      const targetEntry = targets[idx - 1];
      let slot = slotsMap.get(idx);

      if (!slot) {
        // Create new slot
        const qty = roundAmount(sizePerSlotUsdt / targetEntry, 4);
        const tp = computeTP(
          targetEntry,
          bot.tp_method,
          atrValue,
          bot.tp_atr_mult,
          bot.tp_pct,
          bot.tp_fixed
        );

        slot = {
          bot_id: botId,
          slot_id: idx,
          entry_price: targetEntry,
          tp_price: tp,
          size_usdt: sizePerSlotUsdt,
          qty,
          buy_order_id: '',
          tp_order_id: '',
          status: 'waiting',
          filled_qty: 0,
          last_update_ts: new Date()
        };

        await supabase.from('bot_slots').insert(slot);
        slotsMap.set(idx, slot);
      }

      // Recenter if needed
      if (['waiting', 'closed'].includes(slot.status) && slot.buy_order_id) {
        const delta = Math.abs(targetEntry - slot.entry_price) / Math.max(1e-9, slot.entry_price);
        if (delta >= bot.recenter_threshold_pct) {
          await cancelOrder(workerUrl, proxyToken, apiKey, apiSecret, bot.symbol, slot.buy_order_id, dryRun);
          await supabase
            .from('bot_slots')
            .update({ buy_order_id: '', status: 'waiting' })
            .eq('id', slot.id);
          slot.buy_order_id = '';
          slot.status = 'waiting';
        }
      }

      // Update entry/qty/tp
      if (['waiting', 'closed'].includes(slot.status)) {
        const qty = roundAmount(sizePerSlotUsdt / targetEntry, 4);
        const tp = computeTP(
          targetEntry,
          bot.tp_method,
          atrValue,
          bot.tp_atr_mult,
          bot.tp_pct,
          bot.tp_fixed
        );

        await supabase
          .from('bot_slots')
          .update({
            entry_price: targetEntry,
            qty,
            tp_price: tp
          })
          .eq('id', slot.id);

        // Place buy order if needed
        if (!slot.buy_order_id) {
          const orderId = await placeBuyOrder(
            workerUrl,
            proxyToken,
            apiKey,
            apiSecret,
            bot.symbol,
            qty,
            targetEntry,
            dryRun
          );

          await supabase
            .from('bot_slots')
            .update({ buy_order_id: orderId, status: 'buy_open' })
            .eq('id', slot.id);

          await logMessage(supabase, botId, 'info', `Placed BUY order for slot ${idx}: ${qty} @ ${targetEntry}`);
        }
      }
    }

    // Update last run timestamp
    await supabase
      .from('trading_bots')
      .update({ last_run_at: new Date() })
      .eq('id', botId);

    await logMessage(supabase, botId, 'info', 'Bot run completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Bot executed successfully',
        refPrice,
        targets,
        sizePerSlot: sizePerSlotUsdt
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in run-trading-bot:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
