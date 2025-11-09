export const en = {
  // Header
  header: {
    title: "TradePro",
    subtitle: "Automated Trading Platform",
    myAccount: "My Account",
    dashboard: "Dashboard",
    security: "Security",
    adminPanel: "Admin Panel",
    logout: "Logout",
    menu: "Menu",
    user: "User",
    admin: "Administrator",
  },
  
  // Stats Grid
  stats: {
    totalBalance: "Total Balance",
    todayPnL: "Today's P&L",
    winRate: "Win Rate",
  },
  
  // Market Charts
  markets: {
    title: "Top Markets",
    subtitle: "Real-time charts",
    volume24h: "24h Volume",
    high24h: "24h High",
    low24h: "24h Low",
    price: "Price",
    timeframes: {
      "24h": "24 Hours",
      "7d": "7 Days",
      "1M": "1 Month",
      "1Y": "1 Year",
    },
  },
  
  // Signals Panel
  signals: {
    title: "Active Trades",
    subtitle: "Currently open positions",
    active: "active",
    noSignals: "No active trades",
    entry: "Entry",
    target: "Target",
    stopLoss: "Stop Loss",
    close: "Close",
    telegram: "Telegram",
    notifications: {
      on: "Notif. ON",
      off: "Notif. OFF",
    },
    status: {
      active: "Active",
    },
    messages: {
      closedSuccess: "Position closed",
      closedError: "Error closing position",
      sendingToTelegram: "Sending signal to Telegram...",
      sentToTelegram: "Signal sent to Telegram successfully",
      errorSendingToTelegram: "Error sending signal to Telegram",
      newSignal: "New signal",
      notificationsEnabled: "Notifications enabled",
      notificationsDenied: "Notification permissions denied",
      notificationsDisabled: "Notifications disabled",
      notSupported: "Your browser doesn't support notifications",
    },
  },
  
  // Notifications History
  notifications: {
    title: "Notifications History",
    subtitle: "Review all your past alerts",
    new: "new",
    markAll: "Mark all",
    clear: "Clear",
    noNotifications: "No notifications",
    markedAsRead: "All notifications marked as read",
    deleted: "Notification deleted",
    cleared: "History cleared",
    errorMarkingAsRead: "Error marking as read",
    errorDeleting: "Error deleting notification",
    errorClearing: "Error clearing history",
  },
  
  // Trades History
  trades: {
    title: "Trade History",
    subtitle: "Recent closed trades",
    noTrades: "No trade history",
    pair: "Pair",
    type: "Type",
    entry: "Entry",
    exit: "Exit",
    profit: "Profit",
    status: "Status",
    statuses: {
      win: "Win",
      loss: "Loss",
    },
  },
  
  // Exchange Connections
  exchange: {
    title: "Exchange Connections",
    subtitle: "Manage your trading accounts",
    binance: "Binance",
    connect: "Connect Exchange",
    connected: "Connected",
    disconnect: "Disconnect",
    apiKey: "API Key",
    apiSecret: "API Secret (Private)",
    preview: "Preview",
    save: "Save",
    cancel: "Cancel",
    telegram: {
      title: "Telegram",
      subtitle: "Receive signal notifications",
      connect: "Connect Telegram",
      connected: "Telegram connected",
      disconnect: "Disconnect",
      username: "Username",
      webhook: {
        notConfigured: "Webhook not configured",
        configuring: "Configuring...",
        configure: "Configure",
        checking: "Checking webhook...",
      },
    },
    messages: {
      connected: "Exchange connected successfully",
      disconnected: "Exchange disconnected",
      error: "Error connecting exchange",
      errorDisconnecting: "Error disconnecting exchange",
      fillAllFields: "Please fill all fields",
      telegramConnected: "Telegram connected successfully",
      telegramDisconnected: "Telegram disconnected",
      errorTelegram: "Error processing Telegram connection",
    },
  },
  
  // Security Page
  security: {
    title: "Security Settings",
    mfa: {
      title: "Two-Factor Authentication (2FA)",
      subtitle: "Add an extra layer of security to your account",
      enabled: "2FA Enabled",
      disabled: "2FA Disabled",
      enable: "Enable 2FA",
      disable: "Disable 2FA",
      scan: "Scan this QR code with Google Authenticator",
      verify: "Verify code",
      code: "6-digit code",
      cancel: "Cancel",
      messages: {
        enabled: "2FA enabled successfully",
        disabled: "2FA disabled",
        invalidCode: "Invalid code",
        error: "Error setting up 2FA",
        errorDisabling: "Error disabling 2FA",
      },
    },
    loginHistory: {
      title: "Login History",
      subtitle: "Review your recent account activity",
      noHistory: "No login history",
      successful: "Successful login",
      failed: "Failed attempt",
      from: "from",
    },
  },
  
  // Tabs
  tabs: {
    signals: "Active Trades",
    notifications: "Notifications",
  },
  
  // Common
  common: {
    loading: "Loading...",
    error: "Error",
    success: "Success",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    confirm: "Confirm",
  },
};
