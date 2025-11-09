import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

  const handleConnect = async (exchange: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }

    // For Telegram, show instructions
    if (exchange === "Telegram") {
      toast.info("Proximamente: Conexión con Telegram Bot", {
        description: "Esta funcionalidad estará disponible pronto"
      });
      return;
    }

    // For exchanges, show API key requirement
    toast.info(`Conectar ${exchange}`, {
      description: "Proximamente: Ingresa tus API keys para conectar"
    });
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
              >
                <Link2 className="h-4 w-4 mr-2" />
                Conectar Binance
              </Button>
            </TabsContent>
            
            <TabsContent value="bybit" className="space-y-4">
              <Button 
                onClick={() => handleConnect("Bybit")}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Link2 className="h-4 w-4 mr-2" />
                Conectar Bybit
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
          >
            <Send className="h-4 w-4 mr-2" />
            Conectar Telegram
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
