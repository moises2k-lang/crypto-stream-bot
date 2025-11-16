-- Add account_type column to exchange_connections
ALTER TABLE public.exchange_connections 
ADD COLUMN account_type TEXT NOT NULL DEFAULT 'real' CHECK (account_type IN ('demo', 'real'));

-- Add account_type column to exchange_credentials
ALTER TABLE public.exchange_credentials 
ADD COLUMN account_type TEXT NOT NULL DEFAULT 'real' CHECK (account_type IN ('demo', 'real'));

-- Drop old unique constraint if exists and create new one including account_type
ALTER TABLE public.exchange_connections DROP CONSTRAINT IF EXISTS exchange_connections_user_id_exchange_name_key;
ALTER TABLE public.exchange_connections 
ADD CONSTRAINT exchange_connections_user_exchange_type_key 
UNIQUE (user_id, exchange_name, account_type);

ALTER TABLE public.exchange_credentials DROP CONSTRAINT IF EXISTS exchange_credentials_user_id_exchange_name_key;
ALTER TABLE public.exchange_credentials 
ADD CONSTRAINT exchange_credentials_user_exchange_type_key 
UNIQUE (user_id, exchange_name, account_type);

-- Add comment to explain the columns
COMMENT ON COLUMN public.exchange_connections.account_type IS 'Type of account: demo or real';
COMMENT ON COLUMN public.exchange_credentials.account_type IS 'Type of account: demo or real';