import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Square, TrendingUp, TrendingDown, Send, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "@/hooks/useNotifications";

interface Signal {
  id: string;
  pair: string;
  type: string;
  entry: string;
  target: string;
  stop_loss: string;
  status: string;
  created_at: string;
}

export const SignalsPanel = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const { permission, isSupported, requestPermission, showNotification } = useNotifications();

  useEffect(() => {
    fetchSignals();
    subscribeToSignals();
    
    // Check if notifications are enabled
    const notifEnabled = localStorage.getItem('tradingNotificationsEnabled') === 'true';
    setNotificationsEnabled(notifEnabled && permission === 'granted');
  }, [permission]);

  const fetchSignals = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('signals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (data) {
      setSignals(data);
    }
  };

  const subscribeToSignals = () => {
    const channel = supabase
      .channel('signals-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'signals',
        },
        async (payload) => {
          console.log('New signal received:', payload);
          const newSignal = payload.new as Signal;
          
          // Update signals list
          setSignals((prev) => [newSignal, ...prev]);
          
          // Save notification to history
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const notificationType = newSignal.type === 'LONG' ? 'signal_long' : 'signal_short';
            await supabase.from('notifications').insert({
              user_id: user.id,
              title: `Nueva Señal de Trading: ${newSignal.pair}`,
              message: `${newSignal.type} - Entrada: $${newSignal.entry} | Target: $${newSignal.target}`,
              type: notificationType,
              signal_id: newSignal.id,
              read: false,
            });
          }
          
          // Show browser notification if enabled
          if (notificationsEnabled && permission === 'granted') {
            showNotification(
              `Nueva Señal de Trading: ${newSignal.pair}`,
              {
                body: `${newSignal.type} - Entrada: $${newSignal.entry} | Target: $${newSignal.target}`,
                tag: newSignal.id,
                requireInteraction: false,
              }
            );
          }
          
          // Also show toast
          toast.success(`Nueva señal: ${newSignal.pair} ${newSignal.type}`);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const toggleNotifications = async () => {
    if (!isSupported) {
      toast.error('Tu navegador no soporta notificaciones');
      return;
    }

    if (!notificationsEnabled) {
      // Request permission
      const granted = await requestPermission();
      if (granted) {
        setNotificationsEnabled(true);
        localStorage.setItem('tradingNotificationsEnabled', 'true');
      }
    } else {
      // Disable notifications
      setNotificationsEnabled(false);
      localStorage.setItem('tradingNotificationsEnabled', 'false');
      toast.info('Notificaciones desactivadas');
    }
  };

  const handleClose = async (signalId: string) => {
    const { error } = await supabase
      .from('signals')
      .update({ status: 'closed' })
      .eq('id', signalId);

    if (error) {
      toast.error("Error al cerrar posición");
    } else {
      toast.success("Posición cerrada");
      fetchSignals();
    }
  };

  const handleSendToTelegram = async (signal: Signal) => {
    try {
      toast.loading('Enviando señal a Telegram...');
      
      const { data, error } = await supabase.functions.invoke('send-telegram-signal', {
        body: {
          pair: signal.pair,
          type: signal.type,
          entry: signal.entry,
          target: signal.target,
          stop: signal.stop_loss,
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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={notificationsEnabled ? "default" : "outline"}
              onClick={toggleNotifications}
              className="gap-2"
            >
              {notificationsEnabled ? (
                <>
                  <Bell className="h-4 w-4" />
                  Notif. ON
                </>
              ) : (
                <>
                  <BellOff className="h-4 w-4" />
                  Notif. OFF
                </>
              )}
            </Button>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {signals.length} activas
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay operaciones activas
          </p>
        ) : (
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
                      <p className="text-xs text-muted-foreground">
                        {new Date(signal.created_at).toLocaleTimeString('es-ES', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline"
                    className="bg-success/10 text-success border-success/20"
                  >
                    Activa
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
                    <p className="text-sm font-medium text-danger">${signal.stop_loss}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleClose(signal.id)}
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
        )}
      </CardContent>
    </Card>
  );
};
