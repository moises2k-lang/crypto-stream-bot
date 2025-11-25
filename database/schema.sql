-- ================================================
-- COMPLETE DATABASE SCHEMA FOR HOSTINGER
-- PostgreSQL/MySQL Compatible
-- ================================================

-- Create ENUM type for app_role (PostgreSQL only, for MySQL use CHECK constraint)
-- For PostgreSQL:
CREATE TYPE app_role AS ENUM ('admin', 'user');

-- For MySQL, comment the above and uncomment this when creating tables:
-- role ENUM('admin', 'user') NOT NULL

-- ================================================
-- USERS AND AUTHENTICATION
-- ================================================

-- Profiles table (replaces auth.users from Supabase)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);

-- User roles table
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    role app_role NOT NULL, -- For MySQL: ENUM('admin', 'user')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- ================================================
-- EXCHANGE CONNECTIONS
-- ================================================

-- Exchange credentials (encrypted API keys)
CREATE TABLE exchange_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    exchange_name VARCHAR(50) NOT NULL,
    account_type VARCHAR(20) NOT NULL DEFAULT 'real',
    api_key_ciphertext TEXT NOT NULL,
    api_key_iv TEXT NOT NULL,
    api_secret_ciphertext TEXT NOT NULL,
    api_secret_iv TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, exchange_name, account_type)
);

CREATE INDEX idx_exchange_credentials_user_id ON exchange_credentials(user_id);

-- Exchange connections status
CREATE TABLE exchange_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    exchange_name VARCHAR(50) NOT NULL,
    account_type VARCHAR(20) NOT NULL DEFAULT 'real',
    is_connected BOOLEAN DEFAULT false,
    api_key_preview VARCHAR(100),
    connected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, exchange_name, account_type)
);

CREATE INDEX idx_exchange_connections_user_id ON exchange_connections(user_id);

-- ================================================
-- TRADING BOTS
-- ================================================

-- Trading bots configuration
CREATE TABLE trading_bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    exchange_name VARCHAR(50) NOT NULL DEFAULT 'Bybit',
    account_type VARCHAR(20) NOT NULL DEFAULT 'demo',
    symbol VARCHAR(50) NOT NULL DEFAULT 'XMR/USDT:USDT',
    is_active BOOLEAN DEFAULT false,
    is_testnet BOOLEAN DEFAULT true,
    leverage INTEGER,
    num_slots INTEGER NOT NULL DEFAULT 6,
    total_alloc_pct NUMERIC NOT NULL DEFAULT 0.6,
    base_capital_mode VARCHAR(20) NOT NULL DEFAULT 'initial',
    levels_method VARCHAR(20) NOT NULL DEFAULT 'atr',
    level_pcts NUMERIC[],
    level_atr_mults NUMERIC[],
    atr_period INTEGER NOT NULL DEFAULT 14,
    atr_timeframe VARCHAR(10) NOT NULL DEFAULT '5m',
    tp_method VARCHAR(20) NOT NULL DEFAULT 'atr_above_entry',
    tp_fixed NUMERIC DEFAULT 0,
    tp_pct NUMERIC DEFAULT 0.005,
    tp_atr_mult NUMERIC DEFAULT 0.5,
    recenter_threshold_pct NUMERIC NOT NULL DEFAULT 0.001,
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trading_bots_user_id ON trading_bots(user_id);
CREATE INDEX idx_trading_bots_is_active ON trading_bots(is_active);

-- Bot slots (positions)
CREATE TABLE bot_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
    slot_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    entry_price NUMERIC NOT NULL,
    tp_price NUMERIC NOT NULL,
    qty NUMERIC NOT NULL DEFAULT 0,
    filled_qty NUMERIC NOT NULL DEFAULT 0,
    size_usdt NUMERIC NOT NULL DEFAULT 0,
    buy_order_id VARCHAR(255),
    tp_order_id VARCHAR(255),
    last_update_ts TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bot_slots_bot_id ON bot_slots(bot_id);

-- Bot logs
CREATE TABLE bot_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
    log_level VARCHAR(20) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bot_logs_bot_id ON bot_logs(bot_id);
CREATE INDEX idx_bot_logs_timestamp ON bot_logs(timestamp);

-- ================================================
-- SIGNALS AND TRADES
-- ================================================

-- Trading signals
CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    pair VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL,
    entry VARCHAR(50) NOT NULL,
    target VARCHAR(50) NOT NULL,
    stop_loss VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_signals_user_id ON signals(user_id);

-- Trades history
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    pair VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL,
    entry VARCHAR(50) NOT NULL,
    exit VARCHAR(50) NOT NULL,
    profit VARCHAR(50) NOT NULL,
    percentage VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trades_user_id ON trades(user_id);

-- ================================================
-- NOTIFICATIONS AND TELEGRAM
-- ================================================

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    signal_id UUID REFERENCES signals(id) ON DELETE SET NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- Telegram connections
CREATE TABLE telegram_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    chat_id VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE INDEX idx_telegram_connections_user_id ON telegram_connections(user_id);

-- ================================================
-- USER STATS AND TRIALS
-- ================================================

-- User statistics
CREATE TABLE user_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE UNIQUE,
    total_balance NUMERIC DEFAULT 0,
    today_pnl NUMERIC DEFAULT 0,
    win_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);

-- Free trials
CREATE TABLE free_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE UNIQUE,
    has_used_trial BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT false,
    started_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_free_trials_user_id ON free_trials(user_id);

-- ================================================
-- SECURITY AND AUDIT
-- ================================================

-- Login history
CREATE TABLE login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    success BOOLEAN DEFAULT true,
    ip_address VARCHAR(45),
    user_agent TEXT,
    browser VARCHAR(100),
    os VARCHAR(100),
    device_info TEXT,
    country VARCHAR(100),
    city VARCHAR(100),
    login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_history_user_id ON login_history(user_id);
CREATE INDEX idx_login_history_login_at ON login_history(login_at);

-- WebAuthn credentials (biometric auth)
CREATE TABLE webauthn_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter BIGINT DEFAULT 0,
    device_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_webauthn_credentials_user_id ON webauthn_credentials(user_id);

-- ================================================
-- FUNCTIONS
-- ================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_credentials_updated_at BEFORE UPDATE ON exchange_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_connections_updated_at BEFORE UPDATE ON exchange_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trading_bots_updated_at BEFORE UPDATE ON trading_bots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_signals_updated_at BEFORE UPDATE ON signals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_telegram_connections_updated_at BEFORE UPDATE ON telegram_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_free_trials_updated_at BEFORE UPDATE ON free_trials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- INITIAL DATA
-- ================================================

-- Insert default admin user (password: Admin123!)
-- Password hash generated with password_hash('Admin123!', PASSWORD_BCRYPT)
INSERT INTO profiles (user_id, email, full_name, password_hash, is_active)
VALUES (
    gen_random_uuid(),
    'admin@example.com',
    'Administrator',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    true
);
