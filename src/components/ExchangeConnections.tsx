import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [activeTab, setActiveTab] = useState("binance");
  const [connections, setConnections] = useState<{[key: string]: boolean}>({
    binance: false,
    bybit: false,
    telegram: false
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('user_id', user.id);

    if (data) {
      const connectionsMap: {[key: string]: boolean} = {};
      data.forEach(conn => {
        connectionsMap[conn.exchange_name.toLowerCase()] = conn.is_connected;
      });
      setConnections(connectionsMap);
      
      const anyConnected = Object.values(connectionsMap).some(v => v);
      onConnectionChange(anyConnected);
    }
  };

  const handleConnect = (exchange: string) => {
    if (exchange === "Telegram") {
      toast.info("Próximamente: Conexión con Telegram Bot", {
        description: "Te avisaremos cuando esté disponible"
      });
      return;
    }
    setSelectedExchange(exchange);
    setDialogOpen(true);
  };

  const handleSaveKeys = async () => {
    if (!selectedExchange) return;
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error("API Key y Secret son obligatorias");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Debes iniciar sesión");
        return;
      }

      const { error } = await supabase.functions.invoke('save-exchange-keys', {
        body: { exchange: selectedExchange, apiKey, apiSecret }
      });

      if (error) throw error;

      toast.success(`Conectado a ${selectedExchange}`);
      setDialogOpen(false);
      setApiKey("");
      setApiSecret("");
      setSelectedExchange(null);
      await fetchConnections();
    } catch (e) {
      toast.error("No se pudo guardar las credenciales");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">Exchanges</CardTitle>
            {isConnected && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            )}
          </div>
          <CardDescription className="text-muted-foreground">
            Conecta tus cuentas de trading
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-secondary">
              <TabsTrigger value="binance">Binance</TabsTrigger>
              <TabsTrigger value="bybit">Bybit</TabsTrigger>
            </TabsList>
            
            <TabsContent value="binance" className="space-y-4">
              <Button 
                onClick={() => handleConnect("Binance")}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={connections.binance}
              >
                {connections.binance ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Conectado
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Conectar Binance
                  </>
                )}
              </Button>
            </TabsContent>
            
            <TabsContent value="bybit" className="space-y-4">
              <Button 
                onClick={() => handleConnect("Bybit")}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={connections.bybit}
              >
                {connections.bybit ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Conectado
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Conectar Bybit
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Telegram</CardTitle>
          <CardDescription className="text-muted-foreground">
            Recibe notificaciones de señales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => handleConnect("Telegram")}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={connections.telegram}
          >
            {connections.telegram ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Conectado
              </>
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
        <DialogContent className="bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle>Conectar {selectedExchange}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Ingresa tus credenciales del exchange. Nunca almacenamos las claves en texto plano.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input id="apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Tu API Key" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiSecret">API Secret</Label>
              <Input id="apiSecret" type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveKeys} disabled={saving}>
              {saving ? 'Conectando...' : 'Conectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
