-- Add missing DELETE RLS policy for user_stats table
CREATE POLICY "Users can delete own stats" 
ON public.user_stats 
FOR DELETE 
USING (auth.uid() = user_id);