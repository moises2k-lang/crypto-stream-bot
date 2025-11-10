-- Create free_trials table to track user trials
CREATE TABLE IF NOT EXISTS public.free_trials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT false,
  has_used_trial BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.free_trials ENABLE ROW LEVEL SECURITY;

-- Policies for free_trials
CREATE POLICY "Users can view their own trial"
  ON public.free_trials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trial"
  ON public.free_trials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trial"
  ON public.free_trials
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_free_trials_updated_at
  BEFORE UPDATE ON public.free_trials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically create trial for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.free_trials (user_id, has_used_trial, is_active)
  VALUES (NEW.id, false, false);
  RETURN NEW;
END;
$$;

-- Trigger to create trial when user signs up
CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_trial();