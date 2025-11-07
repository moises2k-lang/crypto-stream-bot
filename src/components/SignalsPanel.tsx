import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Square, TrendingUp, TrendingDown, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const signals = [
  {
    id: 1,
    pair: "BTC/USDT",
    type: "LONG",
    entry: "43,250",
    target: "44,500",
    stop: "42,800",
    status: "active",
    time: "10:23 AM"
  },
  {
    id: 3,
    pair: "SOL/USDT",
    type: "LONG",
    entry: "98.50",
    target: "102.00",
    stop: "96.00",
    status: "active",
    time: "09:45 AM"
  },
];

export const SignalsPanel = () => {
  const handleExecute = (signal: any) => {
    toast.success(`Ejecutando señal ${signal.type} en ${signal.pair}`);
  };

  const handleSendToTelegram = async (signal: any) => {
    try {
      toast.loading('Enviando señal a Telegram...');
      
      const { data, error } = await supabase.functions.invoke('send-telegram-signal', {
        body: {
          pair: signal.pair,
          type: signal.type,
          entry: signal.entry,
          target: signal.target,
          stop: signal.stop,
        },
      });

      if (error) throw error;

      toast.success('Señal enviada a Telegram exitosamente');
    } catch (error) {
      console.error('Error sending to Telegram:', error);
      toast.error('Error al enviar señal a Telegram');
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Operaciones Activas</CardTitle>
            <CardDescription className="text-muted-foreground">
              Posiciones abiertas actualmente
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {signals.length} activas
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {signals.map((signal) => (
            <div 
              key={signal.id}
              className="bg-background border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    signal.type === 'LONG' 
                      ? 'bg-success/10' 
                      : 'bg-danger/10'
                  }`}>
                    {signal.type === 'LONG' ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-danger" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{signal.pair}</p>
                    <p className="text-xs text-muted-foreground">{signal.time}</p>
                  </div>
                </div>
                <Badge 
                  variant="outline"
                  className={
                    signal.status === 'active' 
                      ? 'bg-success/10 text-success border-success/20'
                      : 'bg-muted text-muted-foreground border-border'
                  }
                >
                  {signal.status === 'active' ? 'Activa' : 'Pendiente'}
                </Badge>
              </div>
              
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Entrada</p>
                  <p className="text-sm font-medium text-foreground">${signal.entry}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Objetivo</p>
                  <p className="text-sm font-medium text-success">${signal.target}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stop Loss</p>
                  <p className="text-sm font-medium text-danger">${signal.stop}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => toast.info("Cerrando posición...")}
                  className="flex-1 border-danger/50 text-danger hover:bg-danger/10"
                >
                  <Square className="h-3 w-3 mr-1" />
                  Cerrar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleSendToTelegram(signal)}
                  className="border-primary/50 text-primary hover:bg-primary/10"
                >
                  <Send className="h-3 w-3 mr-1" />
                  Telegram
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
