import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

const trades = [
  {
    id: 1,
    pair: "BTC/USDT",
    type: "LONG",
    entry: "42,100",
    exit: "43,250",
    profit: "+273.50",
    percentage: "+2.73%",
    status: "ganancia",
    date: "Hoy 09:15"
  },
  {
    id: 2,
    pair: "ETH/USDT",
    type: "SHORT",
    entry: "2,320",
    exit: "2,280",
    profit: "+40.00",
    percentage: "+1.72%",
    status: "ganancia",
    date: "Hoy 08:30"
  },
  {
    id: 3,
    pair: "ADA/USDT",
    type: "LONG",
    entry: "0.485",
    exit: "0.472",
    profit: "-26.00",
    percentage: "-2.68%",
    status: "perdida",
    date: "Ayer 16:45"
  },
];

export const TradesHistory = () => {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Historial de Operaciones</CardTitle>
        <CardDescription className="text-muted-foreground">
          Tus últimas operaciones ejecutadas
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                    <p className="text-xs text-muted-foreground">{trade.date}</p>
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
      </CardContent>
    </Card>
  );
};
