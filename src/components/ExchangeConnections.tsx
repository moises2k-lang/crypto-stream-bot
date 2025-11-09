import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ExchangeConnectionsProps {
  isConnected: boolean;
  onConnectionChange: (connected: boolean) => void;
}

export const ExchangeConnections = ({ isConnected, onConnectionChange }: ExchangeConnectionsProps) => {
  const [activeTab, setActiveTab] = useState("Binance");
  const [connections, setConnections] = useState({
    binance: false,
    bybit: false,
    telegram: false,
  });
  const [connectionDetails, setConnectionDetails] = useState<{
    [key: string]: { apiKeyPreview?: string };
  }>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [telegramConnecting, setTelegramConnecting] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, []);

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
        binance: exchangeData?.some(conn => conn.exchange_name === 'Binance' && conn.is_connected) || false,
        bybit: exchangeData?.some(conn => conn.exchange_name === 'Bybit' && conn.is_connected) || false,
        telegram: !!telegramData,
      };

      // Store connection details with API key previews
      const details: { [key: string]: { apiKeyPreview?: string } } = {};
      exchangeData?.forEach(conn => {
        const exchangeKey = conn.exchange_name.toLowerCase();
        if (conn.api_key_preview) {
          details[exchangeKey] = { apiKeyPreview: conn.api_key_preview };
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

  const handleConnect = (exchange: string) => {
    setActiveTab(exchange);
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
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error("Por favor ingresa API Key y Secret");
      return;
    }

    if (apiKey.trim().length < 10 || apiSecret.trim().length < 10) {
      toast.error("API Key y Secret deben tener al menos 10 caracteres");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('save-exchange-keys', {
        body: {
          exchange: activeTab,
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
        },
      });

      if (error) throw error;

      toast.success(`${activeTab} conectado exitosamente`);
      setDialogOpen(false);
      setApiKey("");
      setApiSecret("");
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
      const { error } = await supabase.functions.invoke('disconnect-exchange', {
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Exchanges</CardTitle>
            {isConnected && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            )}
          </div>
          <CardDescription>
            Conecta tus cuentas de trading
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
                Conecta tu cuenta de Binance para trading automático
              </p>
              {!connections.binance ? (
                <Button 
                  onClick={() => handleConnect("Binance")}
                  className="w-full"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Conectar
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Conectado</span>
                        {connectionDetails.binance?.apiKeyPreview && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {connectionDetails.binance.apiKeyPreview}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDisconnect("Binance")}
                    >
                      Desconectar
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="Bybit" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conecta tu cuenta de Bybit para trading automático
              </p>
              {!connections.bybit ? (
                <Button 
                  onClick={() => handleConnect("Bybit")}
                  className="w-full"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Conectar
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Conectado</span>
                        {connectionDetails.bybit?.apiKeyPreview && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {connectionDetails.bybit.apiKeyPreview}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDisconnect("Bybit")}
                    >
                      Desconectar
                    </Button>
                  </div>
                </div>
              )}
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
        <CardContent>
          <Button 
            onClick={handleTelegramConnect}
            className="w-full"
            disabled={connections.telegram || telegramConnecting}
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar {activeTab}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
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
                href={activeTab === "Binance" 
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
    </div>
  );
};