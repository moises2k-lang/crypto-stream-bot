-- Create login_history table
CREATE TABLE IF NOT EXISTS public.login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  device_info TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own login history"
ON public.login_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all login history
CREATE POLICY "Admins can view all login history"
ON public.login_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create index for better performance
CREATE INDEX idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX idx_login_history_login_at ON public.login_history(login_at DESC);