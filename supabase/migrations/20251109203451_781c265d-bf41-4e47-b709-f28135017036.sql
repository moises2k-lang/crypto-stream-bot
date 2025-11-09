-- Add unique constraint required for upsert on telegram_connections
ALTER TABLE public.telegram_connections
ADD CONSTRAINT telegram_connections_user_id_key UNIQUE (user_id);