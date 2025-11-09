-- Add full_name column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN full_name text;