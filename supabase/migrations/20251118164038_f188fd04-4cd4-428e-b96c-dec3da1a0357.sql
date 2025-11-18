-- Create table for trading bots configuration
CREATE TABLE public.trading_bots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT 'XMR/USDT:USDT',
  exchange_name TEXT NOT NULL DEFAULT 'Bybit',
  account_type TEXT NOT NULL DEFAULT 'demo',
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_testnet BOOLEAN NOT NULL DEFAULT true,
  
  -- Bot configuration
  num_slots INTEGER NOT NULL DEFAULT 6,
  leverage INTEGER,
  total_alloc_pct DECIMAL NOT NULL DEFAULT 0.6,
  base_capital_mode TEXT NOT NULL DEFAULT 'initial',
  
  -- Levels calculation
  levels_method TEXT NOT NULL DEFAULT 'atr',
  atr_timeframe TEXT NOT NULL DEFAULT '5m',
  atr_period INTEGER NOT NULL DEFAULT 14,
  level_atr_mults DECIMAL[] DEFAULT ARRAY[0,1,2,3,4,5],
  level_pcts DECIMAL[] DEFAULT ARRAY[0,-0.03,-0.06,-0.12,-0.25,-0.5],
  
  -- Take profit calculation
  tp_method TEXT NOT NULL DEFAULT 'atr_above_entry',
  tp_atr_mult DECIMAL DEFAULT 0.5,
  tp_pct DECIMAL DEFAULT 0.005,
  tp_fixed DECIMAL DEFAULT 0,
  
  -- Recentering
  recenter_threshold_pct DECIMAL NOT NULL DEFAULT 0.001,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_run_at TIMESTAMP WITH TIME ZONE
);

-- Create table for bot slots state
CREATE TABLE public.bot_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.trading_bots(id) ON DELETE CASCADE,
  slot_id INTEGER NOT NULL,
  entry_price DECIMAL NOT NULL,
  tp_price DECIMAL NOT NULL,
  size_usdt DECIMAL NOT NULL DEFAULT 0,
  qty DECIMAL NOT NULL DEFAULT 0,
  buy_order_id TEXT,
  tp_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  filled_qty DECIMAL NOT NULL DEFAULT 0,
  last_update_ts TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bot_id, slot_id)
);

-- Create table for bot execution logs
CREATE TABLE public.bot_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.trading_bots(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  log_level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  details JSONB
);

-- Enable RLS
ALTER TABLE public.trading_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trading_bots
CREATE POLICY "Users can view their own bots"
  ON public.trading_bots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bots"
  ON public.trading_bots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bots"
  ON public.trading_bots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bots"
  ON public.trading_bots FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for bot_slots
CREATE POLICY "Users can view their own bot slots"
  ON public.bot_slots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.trading_bots
    WHERE trading_bots.id = bot_slots.bot_id
    AND trading_bots.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their own bot slots"
  ON public.bot_slots FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.trading_bots
    WHERE trading_bots.id = bot_slots.bot_id
    AND trading_bots.user_id = auth.uid()
  ));

-- RLS Policies for bot_logs
CREATE POLICY "Users can view their own bot logs"
  ON public.bot_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.trading_bots
    WHERE trading_bots.id = bot_logs.bot_id
    AND trading_bots.user_id = auth.uid()
  ));

CREATE POLICY "Service can insert bot logs"
  ON public.bot_logs FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_trading_bots_updated_at
  BEFORE UPDATE ON public.trading_bots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();