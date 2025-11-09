-- Limpiar conexiones fantasma que no tienen credenciales reales
DELETE FROM exchange_connections 
WHERE user_id = '3794d1c5-3caa-4479-92d4-ff631b1bac84' 
AND exchange_name IN ('Binance', 'Bybit', 'Telegram');

-- Agregar columna para mostrar preview de la API key
ALTER TABLE exchange_connections 
ADD COLUMN IF NOT EXISTS api_key_preview TEXT;

-- Agregar índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_exchange_connections_user_exchange 
ON exchange_connections(user_id, exchange_name);