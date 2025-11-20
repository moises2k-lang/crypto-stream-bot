import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, CheckCircle2, Send, AlertCircle, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ExchangeConnectionsProps {
  isConnected: boolean;
  onConnectionChange: (connected: boolean) => void;
}

export const ExchangeConnections = ({ isConnected, onConnectionChange }: ExchangeConnectionsProps) => {
  const [activeTab, setActiveTab] = useState("Binance");
  const [connections, setConnections] = useState({
    binance_demo: false,
    binance_real: false,
    bybit_demo: false,
    bybit_real: false,
    telegram: false,
  });
  const [connectionDetails, setConnectionDetails] = useState<{
    [key: string]: { apiKeyPreview?: string; accountType?: string };
  }>({});

  const [dialogOpen, setDialogOpen] = useState(false);
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
  const [isDemoAccount, setIsDemoAccount] = useState(false);
  const [demoBalance, setDemoBalance] = useState("10000");
  const [selectedAccountType, setSelectedAccountType] = useState<'demo' | 'real'>('real');

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
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check exchange connections
      const { data: exchangeData } = await supabase
        .from('exchange_connections')
        .select('*')
        .eq('user_id', user.id);

      // Check telegram connection
      const { data: telegramData } = await supabase
        .from('telegram_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      const newConnections = {
        binance_demo: exchangeData?.some(conn => conn.exchange_name === 'Binance' && conn.account_type === 'demo' && conn.is_connected) || false,
        binance_real: exchangeData?.some(conn => conn.exchange_name === 'Binance' && conn.account_type === 'real' && conn.is_connected) || false,
        bybit_demo: exchangeData?.some(conn => conn.exchange_name === 'Bybit' && conn.account_type === 'demo' && conn.is_connected) || false,
        bybit_real: exchangeData?.some(conn => conn.exchange_name === 'Bybit' && conn.account_type === 'real' && conn.is_connected) || false,
        telegram: !!telegramData,
      };

      // Store connection details with API key previews
      const details: { [key: string]: { apiKeyPreview?: string; accountType?: string } } = {};
      exchangeData?.forEach(conn => {
        const exchangeKey = `${conn.exchange_name.toLowerCase()}_${conn.account_type}`;
        if (conn.api_key_preview) {
          details[exchangeKey] = { 
            apiKeyPreview: conn.api_key_preview,
            accountType: conn.account_type 
          };
        }
      });

      setConnections(newConnections);
      setConnectionDetails(details);
      
      // Update parent component
      const hasAnyConnection = Object.values(newConnections).some(v => v);
      onConnectionChange(hasAnyConnection);
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };

  const handleConnect = (exchange: string, accountType: 'demo' | 'real') => {
    setActiveTab(exchange);
    setSelectedAccountType(accountType);
    setIsDemoAccount(accountType === 'demo');
    setDialogOpen(true);
    setApiKey("");
    setApiSecret("");
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
        
        // Poll for connection status
        setTimeout(() => {
          fetchConnections();
        }, 3000);
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al conectar con Telegram");
    } finally {
      setTelegramConnecting(false);
    }
  };

  const handleSaveKeys = async () => {
    if (!isDemoAccount && (!apiKey.trim() || !apiSecret.trim())) {
      toast.error("Por favor ingresa API Key y Secret");
      return;
    }

    if (!isDemoAccount && (apiKey.trim().length < 10 || apiSecret.trim().length < 10)) {
      toast.error("API Key y Secret deben tener al menos 10 caracteres");
      return;
    }

    if (isDemoAccount && !demoBalance.trim()) {
      toast.error("Por favor ingresa el saldo demo");
      return;
    }

    setSaving(true);
    try {
      let finalApiKey = apiKey;
      let finalApiSecret = apiSecret;

      // Si es cuenta demo, usar credenciales especiales
      if (isDemoAccount) {
        finalApiKey = `DEMO_${activeTab.toUpperCase()}_${Date.now()}`;
        finalApiSecret = `DEMO_SECRET_${Math.random().toString(36).substring(7)}`;
        
        // Guardar el saldo demo en user_stats
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const balance = parseFloat(demoBalance) || 10000;
          await supabase
            .from('user_stats')
            .upsert({
              user_id: user.id,
              total_balance: balance,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            });
        }
      }

      const finalAccountType = isDemoAccount ? 'demo' : selectedAccountType;

      const { error } = await supabase.functions.invoke('save-exchange-keys', {
        body: {
          exchange: activeTab,
          apiKey: finalApiKey.trim(),
          apiSecret: finalApiSecret.trim(),
          accountType: finalAccountType,
        },
      });

      if (error) throw error;

      toast.success(isDemoAccount 
        ? `✅ Cuenta demo de ${activeTab} creada con $${parseFloat(demoBalance).toLocaleString()} USDT` 
        : `${activeTab} conectado exitosamente`
      );
      setDialogOpen(false);
      setApiKey("");
      setApiSecret("");
      setIsDemoAccount(false);
      setDemoBalance("10000");
      await fetchConnections();
    } catch (error: any) {
      console.error('Error saving keys:', error);
      toast.error(error.message || "Error al conectar exchange");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (exchange: string) => {
    if (!confirm(`¿Estás seguro de desconectar ${exchange}?`)) return;

    try {
      // Garantiza que el token JWT se envíe en la petición
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
      console.error('Error disconnecting:', error);
      toast.error(error.message || "Error al desconectar");
    }
  };

  const checkWebhookStatus = async () => {
    setWebhookStatus(prev => ({ ...prev, loading: true }));
    try {
      const { data, error } = await supabase.functions.invoke('check-telegram-webhook');

      if (error) throw error;

      setWebhookStatus({
        configured: data.configured || false,
        loading: false,
        setting: false,
      });
    } catch (error) {
      console.error('Error checking webhook:', error);
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
      console.error('Error setting up webhook:', error);
      toast.error(error.message || "Error al configurar webhook");
      setWebhookStatus(prev => ({ ...prev, setting: false }));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Exchanges</CardTitle>
            {(connections.binance_demo || connections.binance_real || connections.bybit_demo || connections.bybit_real) && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            )}
          </div>
          <CardDescription>
            Conecta tus cuentas de trading (demo y/o real)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="Binance">Binance</TabsTrigger>
              <TabsTrigger value="Bybit">Bybit</TabsTrigger>
            </TabsList>
            
            <TabsContent value="Binance" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conecta tu cuenta de Binance para trading
              </p>
              
              {/* Cuenta Demo */}
              <div className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">🎮 Cuenta Demo</span>
                  {connections.binance_demo && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Conectada
                    </Badge>
                  )}
                </div>
                {!connections.binance_demo ? (
                  <Button 
                    onClick={() => handleConnect("Binance", "demo")}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Conectar Demo
                  </Button>
                ) : (
                  <div className="flex items-center justify-between">
                    {connectionDetails.binance_demo?.apiKeyPreview && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {connectionDetails.binance_demo.apiKeyPreview}
                      </span>
                    )}
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDisconnect("Binance")}
                    >
                      Desconectar
                    </Button>
                  </div>
                )}
              </div>

              {/* Cuenta Real */}
              <div className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">💰 Cuenta Real</span>
                  {connections.binance_real && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Conectada
                    </Badge>
                  )}
                </div>
                {!connections.binance_real ? (
                  <Button 
                    onClick={() => handleConnect("Binance", "real")}
                    size="sm"
                    className="w-full"
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Conectar Real
                  </Button>
                ) : (
                  <div className="flex items-center justify-between">
                    {connectionDetails.binance_real?.apiKeyPreview && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {connectionDetails.binance_real.apiKeyPreview}
                      </span>
                    )}
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDisconnect("Binance")}
                    >
                      Desconectar
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="Bybit" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conecta tu cuenta de Bybit para trading
              </p>
              
              {/* Cuenta Demo */}
              <div className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">🎮 Cuenta Demo</span>
                  {connections.bybit_demo && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Conectada
                    </Badge>
                  )}
                </div>
                {!connections.bybit_demo ? (
                  <Button 
                    onClick={() => handleConnect("Bybit", "demo")}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Conectar Demo
                  </Button>
                ) : (
                  <div className="flex items-center justify-between">
                    {connectionDetails.bybit_demo?.apiKeyPreview && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {connectionDetails.bybit_demo.apiKeyPreview}
                      </span>
                    )}
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDisconnect("Bybit")}
                    >
                      Desconectar
                    </Button>
                  </div>
                )}
              </div>

              {/* Cuenta Real */}
              <div className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">💰 Cuenta Real</span>
                  {connections.bybit_real && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Conectada
                    </Badge>
                  )}
                </div>
                {!connections.bybit_real ? (
                  <Button 
                    onClick={() => handleConnect("Bybit", "real")}
                    size="sm"
                    className="w-full"
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Conectar Real
                  </Button>
                ) : (
                  <div className="flex items-center justify-between">
                    {connectionDetails.bybit_real?.apiKeyPreview && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {connectionDetails.bybit_real.apiKeyPreview}
                      </span>
                    )}
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDisconnect("Bybit")}
                    >
                      Desconectar
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Telegram</CardTitle>
          <CardDescription>
            Recibe notificaciones de señales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Webhook Status - Solo visible para administradores */}
          {isAdmin && !webhookStatus.configured && !webhookStatus.loading && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium text-warning">Webhook no configurado</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSetupWebhook}
                disabled={webhookStatus.setting}
              >
                <Settings className="h-3 w-3 mr-1" />
                {webhookStatus.setting ? "Configurando..." : "Configurar"}
              </Button>
            </div>
          )}

          {/* Telegram Connection Button */}
          <Button 
            onClick={handleTelegramConnect}
            className="w-full"
            disabled={connections.telegram || telegramConnecting || (!webhookStatus.configured && isAdmin)}
          >
            {connections.telegram ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Conectado
              </>
            ) : telegramConnecting ? (
              "Conectando..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Conectar Telegram
              </>
            )}
          </Button>
          
          {isAdmin && !webhookStatus.configured && !webhookStatus.loading && (
            <p className="text-xs text-muted-foreground text-center">
              Configura el webhook antes de conectar Telegram
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar {activeTab}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Selector de modo Demo/Real solo para Bybit */}
            {activeTab === "Bybit" && (
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                <Label className="text-sm font-medium">Modo de conexión</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={!isDemoAccount ? "default" : "outline"}
                    onClick={() => {
                      setIsDemoAccount(false);
                      setSelectedAccountType('real');
                      setApiKey("");
                      setApiSecret("");
                    }}
                    className="w-full"
                    size="sm"
                  >
                    🔗 Real
                  </Button>
                  <Button
                    type="button"
                    variant={isDemoAccount ? "default" : "outline"}
                    onClick={() => {
                      setIsDemoAccount(true);
                      setSelectedAccountType('demo');
                      setApiKey("");
                      setApiSecret("");
                    }}
                    className="w-full"
                    size="sm"
                  >
                    🎮 Demo
                  </Button>
                </div>
              </div>
            )}

            {/* Contenido condicional según modo */}
            {isDemoAccount && activeTab === "Bybit" ? (
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-2">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>🎮</span> Cuenta Demo de Bybit
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Crea una cuenta de práctica con saldo simulado. Perfecto para probar la plataforma sin riesgo real.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="demoBalance">Saldo inicial (USDT)</Label>
                  <Input
                    id="demoBalance"
                    type="number"
                    min="1000"
                    max="1000000"
                    step="1000"
                    value={demoBalance}
                    onChange={(e) => setDemoBalance(e.target.value)}
                    placeholder="10000"
                    className="text-lg font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Saldo recomendado: 10,000 - 100,000 USDT
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Instrucciones */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="text-sm font-semibold">Instrucciones:</h4>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Ve a la página de API de {activeTab}</li>
                    <li>Crea una nueva API Key</li>
                    <li>Habilita permisos de <strong>Trading (lectura y ejecución)</strong></li>
                    <li className="text-destructive font-medium">⚠️ NO habilites permisos de Withdrawal (retiro)</li>
                    <li>Copia la API Key y Secret aquí</li>
                  </ol>
                  <a 
                    href={
                      activeTab === "Binance" 
                        ? "https://www.binance.com/en/my/settings/api-management" 
                        : "https://www.bybit.com/app/user/api-management"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Ir a {activeTab} API Management →
                  </a>
                </div>

                {/* Campos de entrada */}
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
              </>
            )}
            
            <Button 
              onClick={handleSaveKeys}
              className="w-full"
              disabled={saving}
            >
              {saving ? "Guardando..." : isDemoAccount ? "🎮 Crear Cuenta Demo" : "💾 Guardar Credenciales"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};