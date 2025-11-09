export const es = {
  // Header
  header: {
    title: "TradePro",
    subtitle: "Plataforma de Trading Automatizado",
    myAccount: "Mi Cuenta",
    dashboard: "Dashboard",
    security: "Seguridad",
    adminPanel: "Panel de Admin",
    logout: "Cerrar Sesión",
    menu: "Menú",
    user: "Usuario",
    admin: "Administrador",
  },
  
  // Stats Grid
  stats: {
    totalBalance: "Balance Total",
    todayPnL: "P&L Hoy",
    winRate: "Tasa de Éxito",
  },
  
  // Market Charts
  markets: {
    title: "Principales Mercados",
    subtitle: "Gráficos en tiempo real",
    volume24h: "Volumen 24h",
    high24h: "Máx 24h",
    low24h: "Mín 24h",
    price: "Precio",
    timeframes: {
      "24h": "24 Horas",
      "7d": "7 Días",
      "1M": "1 Mes",
      "1Y": "1 Año",
    },
  },
  
  // Signals Panel
  signals: {
    title: "Operaciones Activas",
    subtitle: "Posiciones abiertas actualmente",
    active: "activas",
    noSignals: "No hay operaciones activas",
    entry: "Entrada",
    target: "Objetivo",
    stopLoss: "Stop Loss",
    close: "Cerrar",
    telegram: "Telegram",
    notifications: {
      on: "Notif. ON",
      off: "Notif. OFF",
    },
    status: {
      active: "Activa",
    },
    messages: {
      closedSuccess: "Posición cerrada",
      closedError: "Error al cerrar posición",
      sendingToTelegram: "Enviando señal a Telegram...",
      sentToTelegram: "Señal enviada a Telegram exitosamente",
      errorSendingToTelegram: "Error al enviar señal a Telegram",
      newSignal: "Nueva señal",
      notificationsEnabled: "Notificaciones activadas",
      notificationsDenied: "Permisos de notificación denegados",
      notificationsDisabled: "Notificaciones desactivadas",
      notSupported: "Tu navegador no soporta notificaciones",
    },
  },
  
  // Notifications History
  notifications: {
    title: "Historial de Notificaciones",
    subtitle: "Revisa todas tus alertas pasadas",
    new: "nuevas",
    markAll: "Marcar todas",
    clear: "Limpiar",
    noNotifications: "No hay notificaciones",
    markedAsRead: "Todas las notificaciones marcadas como leídas",
    deleted: "Notificación eliminada",
    cleared: "Historial limpiado",
    errorMarkingAsRead: "Error al marcar como leída",
    errorDeleting: "Error al eliminar notificación",
    errorClearing: "Error al limpiar historial",
  },
  
  // Trades History
  trades: {
    title: "Historial de Operaciones",
    subtitle: "Últimas operaciones cerradas",
    noTrades: "No hay historial de operaciones",
    pair: "Par",
    type: "Tipo",
    entry: "Entrada",
    exit: "Salida",
    profit: "Ganancia",
    status: "Estado",
    statuses: {
      win: "Ganancia",
      loss: "Pérdida",
    },
  },
  
  // Exchange Connections
  exchange: {
    title: "Conexiones de Exchange",
    subtitle: "Gestiona tus cuentas de trading",
    binance: "Binance",
    connect: "Conectar Exchange",
    connected: "Conectado",
    disconnect: "Desconectar",
    apiKey: "API Key",
    apiSecret: "API Secret (Privado)",
    preview: "Vista previa",
    save: "Guardar",
    cancel: "Cancelar",
    telegram: {
      title: "Telegram",
      subtitle: "Recibe notificaciones de señales",
      connect: "Conectar Telegram",
      connected: "Telegram conectado",
      disconnect: "Desconectar",
      username: "Usuario",
      webhook: {
        notConfigured: "Webhook no configurado",
        configuring: "Configurando...",
        configure: "Configurar",
        checking: "Verificando webhook...",
      },
    },
    messages: {
      connected: "Exchange conectado exitosamente",
      disconnected: "Exchange desconectado",
      error: "Error al conectar exchange",
      errorDisconnecting: "Error al desconectar exchange",
      fillAllFields: "Por favor completa todos los campos",
      telegramConnected: "Telegram conectado exitosamente",
      telegramDisconnected: "Telegram desconectado",
      errorTelegram: "Error al procesar conexión de Telegram",
    },
  },
  
  // Security Page
  security: {
    title: "Configuración de Seguridad",
    mfa: {
      title: "Autenticación de Dos Factores (2FA)",
      subtitle: "Añade una capa extra de seguridad a tu cuenta",
      enabled: "2FA Activado",
      disabled: "2FA Desactivado",
      enable: "Activar 2FA",
      disable: "Desactivar 2FA",
      scan: "Escanea este código QR con Google Authenticator",
      verify: "Verificar código",
      code: "Código de 6 dígitos",
      cancel: "Cancelar",
      messages: {
        enabled: "2FA activado exitosamente",
        disabled: "2FA desactivado",
        invalidCode: "Código inválido",
        error: "Error al configurar 2FA",
        errorDisabling: "Error al desactivar 2FA",
      },
    },
    loginHistory: {
      title: "Historial de Accesos",
      subtitle: "Revisa la actividad reciente de tu cuenta",
      noHistory: "No hay historial de accesos",
      successful: "Acceso exitoso",
      failed: "Intento fallido",
      from: "desde",
    },
  },
  
  // Tabs
  tabs: {
    signals: "Operaciones Activas",
    notifications: "Notificaciones",
  },
  
  // Common
  common: {
    loading: "Cargando...",
    error: "Error",
    success: "Éxito",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    close: "Cerrar",
    confirm: "Confirmar",
  },
};
