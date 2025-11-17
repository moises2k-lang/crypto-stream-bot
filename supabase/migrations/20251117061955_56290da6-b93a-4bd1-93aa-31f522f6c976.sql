-- Drop old unique constraints if they exist
ALTER TABLE public.exchange_credentials DROP CONSTRAINT IF EXISTS exchange_credentials_user_exchange_unique;
ALTER TABLE public.exchange_credentials DROP CONSTRAINT IF EXISTS exchange_credentials_user_id_exchange_name_key;

-- Drop old constraint on exchange_connections if it exists
ALTER TABLE public.exchange_connections DROP CONSTRAINT IF EXISTS exchange_connections_user_exchange_unique;
ALTER TABLE public.exchange_connections DROP CONSTRAINT IF EXISTS exchange_connections_user_id_exchange_name_key;

-- Add new unique constraint with account_type for exchange_credentials
ALTER TABLE public.exchange_credentials 
ADD CONSTRAINT exchange_credentials_user_exchange_account_unique 
UNIQUE (user_id, exchange_name, account_type);

-- Add new unique constraint with account_type for exchange_connections
ALTER TABLE public.exchange_connections 
ADD CONSTRAINT exchange_connections_user_exchange_account_unique 
UNIQUE (user_id, exchange_name, account_type);