import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Trade {
  id: string;
  pair: string;
  type: string;
  entry: string;
  exit: string;
  profit: string;
  percentage: string;
  status: string;
  created_at: string;
}

export const TradesHistory = () => {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setTrades(data);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Historial de Operaciones</CardTitle>
        <CardDescription className="text-muted-foreground">
          Tus últimas operaciones ejecutadas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {trades.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay operaciones en el historial
          </p>
        ) : (
          <div className="space-y-3">
            {trades.map((trade) => (
              <div 
                key={trade.id}
                className="bg-background border border-border rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      trade.type === 'LONG' 
                        ? 'bg-success/10' 
                        : 'bg-danger/10'
                    }`}>
                      {trade.type === 'LONG' ? (
                        <TrendingUp className="h-4 w-4 text-success" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-danger" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{trade.pair}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(trade.created_at).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline"
                    className={
                      trade.status === 'ganancia' 
                        ? 'bg-success/10 text-success border-success/20'
                        : 'bg-danger/10 text-danger border-danger/20'
                    }
                  >
                    {trade.status === 'ganancia' ? 'Ganancia' : 'Pérdida'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Entrada</p>
                    <p className="text-sm font-medium text-foreground">${trade.entry}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Salida</p>
                    <p className="text-sm font-medium text-foreground">${trade.exit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">P&L</p>
                    <p className={`text-sm font-bold ${
                      trade.status === 'ganancia' ? 'text-success' : 'text-danger'
                    }`}>
                      {trade.profit} ({trade.percentage})
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
