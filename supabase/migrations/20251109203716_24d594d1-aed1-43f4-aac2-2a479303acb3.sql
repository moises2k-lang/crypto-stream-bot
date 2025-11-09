-- Add missing UPDATE and DELETE RLS policies for trades table
CREATE POLICY "Users can update own trades" 
ON public.trades 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades" 
ON public.trades 
FOR DELETE 
USING (auth.uid() = user_id);