import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const generateMockData = (basePrice: number) => {
  return Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    price: basePrice + (Math.random() - 0.5) * basePrice * 0.05,
  }));
};

const markets = [
  { name: 'BTC/USDT', price: '43,250', change: '+2.45%', data: generateMockData(43250), color: 'hsl(var(--chart-1))' },
  { name: 'ETH/USDT', price: '2,280', change: '-1.23%', data: generateMockData(2280), color: 'hsl(var(--chart-2))' },
  { name: 'SOL/USDT', price: '98.50', change: '+5.67%', data: generateMockData(98.5), color: 'hsl(var(--chart-4))' },
  { name: 'BNB/USDT', price: '312.40', change: '+1.89%', data: generateMockData(312.4), color: 'hsl(var(--chart-5))' },
];

export const MarketCharts = () => {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Principales Mercados</CardTitle>
        <CardDescription className="text-muted-foreground">
          Gráficos en tiempo real de las últimas 24 horas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {markets.map((market) => {
            const isPositive = market.change.startsWith('+');
            return (
              <div 
                key={market.name}
                className="bg-background border border-border rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{market.name}</h3>
                    <p className="text-2xl font-bold text-foreground">${market.price}</p>
                  </div>
                  <div className={`text-sm font-medium ${
                    isPositive ? 'text-success' : 'text-danger'
                  }`}>
                    {market.change}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={market.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      hide
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke={market.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};