-- Create table for user Telegram connections
CREATE TABLE public.telegram_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  chat_id text NOT NULL,
  username text,
  first_name text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own telegram connection"
ON public.telegram_connections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own telegram connection"
ON public.telegram_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own telegram connection"
ON public.telegram_connections
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own telegram connection"
ON public.telegram_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_telegram_connections_updated_at
BEFORE UPDATE ON public.telegram_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();