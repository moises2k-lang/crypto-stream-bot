import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link2, CheckCircle2, Send, Settings, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const ExchangeIcons = () => {
  const [connections, setConnections] = useState({
    binance: false,
    bybit: false,
    telegram: false,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeExchange, setActiveExchange] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [telegramConnecting, setTelegramConnecting] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<{
    configured: boolean;
    loading: boolean;
    setting: boolean;
  }>({ configured: false, loading: true, setting: false });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminRole();
    fetchConnections();
    checkWebhookStatus();
  }, []);

  const checkAdminRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      setIsAdmin(!!roleData);
    } catch (error) {
      setIsAdmin(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: exchangeData } = await supabase
        .from('exchange_connections')
        .select('*')
        .eq('user_id', user.id);

      const { data: telegramData } = await supabase
        .from('telegram_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      setConnections({
        binance: exchangeData?.some(conn => conn.exchange_name === 'Binance' && conn.is_connected) || false,
        bybit: exchangeData?.some(conn => conn.exchange_name === 'Bybit' && conn.is_connected) || false,
        telegram: !!telegramData,
      });
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };

  const checkWebhookStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-telegram-webhook');
      if (error) throw error;
      setWebhookStatus({
        configured: data.configured || false,
        loading: false,
        setting: false,
      });
    } catch (error) {
      setWebhookStatus({ configured: false, loading: false, setting: false });
    }
  };

  const handleSetupWebhook = async () => {
    setWebhookStatus(prev => ({ ...prev, setting: true }));
    try {
      const { data, error } = await supabase.functions.invoke('setup-telegram-webhook');
      if (error) throw error;
      if (data.success) {
        toast.success("Webhook configurado exitosamente");
        await checkWebhookStatus();
      } else {
        throw new Error(data.error || "Error al configurar webhook");
      }
    } catch (error: any) {
      toast.error(error.message || "Error al configurar webhook");
      setWebhookStatus(prev => ({ ...prev, setting: false }));
    }
  };

  const handleConnect = (exchange: string) => {
    setActiveExchange(exchange);
    setDialogOpen(true);
  };

  const handleTelegramConnect = async () => {
    setTelegramConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-telegram-link');
      if (error) throw error;
      if (data?.link) {
        window.open(data.link, '_blank');
        toast.success("Abre Telegram e inicia conversación con el bot", {
          description: "Presiona /start para conectar tu cuenta"
        });
        setTimeout(() => fetchConnections(), 3000);
      }
    } catch (e) {
      toast.error("Error al conectar con Telegram");
    } finally {
      setTelegramConnecting(false);
    }
  };

  const handleSaveKeys = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error("Por favor ingresa API Key y Secret");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('save-exchange-keys', {
        body: {
          exchange: activeExchange,
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
        },
      });

      if (error) throw error;

      toast.success(`${activeExchange} conectado exitosamente`);
      setDialogOpen(false);
      setApiKey("");
      setApiSecret("");
      await fetchConnections();
    } catch (error: any) {
      toast.error(error.message || "Error al conectar exchange");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (exchange: string) => {
    if (!confirm(`¿Estás seguro de desconectar ${exchange}?`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Tu sesión no está activa. Inicia sesión e inténtalo de nuevo.");
        return;
      }

      const { error } = await supabase.functions.invoke('disconnect-exchange', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { exchange },
      });

      if (error) throw error;
      toast.success(`${exchange} desconectado`);
      await fetchConnections();
    } catch (error: any) {
      toast.error(error.message || "Error al desconectar");
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 mr-2">
        <span className="text-sm text-muted-foreground font-medium hidden sm:inline">Conexiones:</span>
        <div className="flex items-center gap-1">{/* Binance Icon */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`relative gap-2 h-9 ${connections.binance ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-foreground'}`}
              title="Binance"
            >
              <span className="text-xs font-medium">Binance</span>
              <svg className="h-4 w-4" viewBox="0 0 126.61 126.61" fill="currentColor">
                <path d="M38.73 53.2l24.59-24.58 24.6 24.6 14.3-14.31L63.32 0 24.43 38.88l14.3 14.31zm-14.3 10.12L10.11 77.63l14.31 14.31 14.31-14.31-14.3-14.31zM63.31 126.61l38.89-38.89-14.3-14.3-24.6 24.59-24.59-24.6-14.31 14.32 38.91 38.88zm24.6-63.29l14.29-14.31L116.5 63.32 102.2 77.63 87.9 63.32z"/>
                <path d="M77.83 63.3L63.32 48.78 52.59 59.51l-1.24 1.23-2.54 2.54 14.51 14.5 14.51-14.47z"/>
              </svg>
              {connections.binance && (
                <CheckCircle2 className="h-3 w-3 text-yellow-500 absolute -top-0.5 -right-0.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-background z-50">
            {connections.binance ? (
              <DropdownMenuItem onClick={() => handleDisconnect("Binance")}>
                Desconectar Binance
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => handleConnect("Binance")}>
                <Link2 className="mr-2 h-4 w-4" />
                Conectar Binance
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bybit Icon */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`relative gap-2 h-9 ${connections.bybit ? 'text-orange-500 hover:text-orange-600' : 'text-muted-foreground hover:text-foreground'}`}
              title="Bybit"
            >
              <span className="text-xs font-medium">Bybit</span>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.5 0L0 6.5v11L11.5 24 23 17.5v-11L11.5 0zm7.47 15.89l-7.47 4.29-7.47-4.29V8.11l7.47-4.29 7.47 4.29v7.78z"/>
              </svg>
              {connections.bybit && (
                <CheckCircle2 className="h-3 w-3 text-orange-500 absolute -top-0.5 -right-0.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-background z-50">
            {connections.bybit ? (
              <DropdownMenuItem onClick={() => handleDisconnect("Bybit")}>
                Desconectar Bybit
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => handleConnect("Bybit")}>
                <Link2 className="mr-2 h-4 w-4" />
                Conectar Bybit
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Telegram Icon */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`relative gap-2 h-9 ${connections.telegram ? 'text-blue-500 hover:text-blue-600' : 'text-muted-foreground hover:text-foreground'}`}
              title="Telegram"
            >
              <span className="text-xs font-medium">Telegram</span>
              <Send className="h-4 w-4" />
              {connections.telegram && (
                <CheckCircle2 className="h-3 w-3 text-blue-500 absolute -top-0.5 -right-0.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-background z-50">
            {isAdmin && !webhookStatus.configured && (
              <DropdownMenuItem onClick={handleSetupWebhook} disabled={webhookStatus.setting}>
                <Settings className="mr-2 h-4 w-4" />
                {webhookStatus.setting ? "Configurando..." : "Configurar Webhook"}
              </DropdownMenuItem>
            )}
            {!connections.telegram && (
              <DropdownMenuItem 
                onClick={handleTelegramConnect}
                disabled={telegramConnecting || (!webhookStatus.configured && isAdmin)}
              >
                <Send className="mr-2 h-4 w-4" />
                {telegramConnecting ? "Conectando..." : "Conectar Telegram"}
              </DropdownMenuItem>
            )}
            {connections.telegram && (
              <DropdownMenuItem disabled>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Conectado
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* Dialog para conectar exchanges */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-background z-50">
          <DialogHeader>
            <DialogTitle>Conectar {activeExchange}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="text-sm font-semibold">Instrucciones:</h4>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Ve a la página de API de {activeExchange}</li>
                <li>Crea una nueva API Key</li>
                <li>Habilita permisos de <strong>Trading (lectura y ejecución)</strong></li>
                <li className="text-destructive font-medium">⚠️ NO habilites permisos de Withdrawal (retiro)</li>
                <li>Copia la API Key y Secret aquí</li>
              </ol>
              <a 
                href={
                  activeExchange === "Binance" 
                    ? "https://www.binance.com/en/my/settings/api-management" 
                    : "https://www.bybit.com/app/user/api-management"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Ir a {activeExchange} API Management →
              </a>
            </div>

            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Ingresa tu API Key"
                className="font-mono text-sm"
              />
            </div>
            
            <div>
              <Label htmlFor="apiSecret">API Secret</Label>
              <Input
                id="apiSecret"
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Ingresa tu API Secret"
                className="font-mono text-sm"
              />
            </div>
            
            <Button 
              onClick={handleSaveKeys}
              className="w-full"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar Credenciales"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};