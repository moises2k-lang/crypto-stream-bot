import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from "@/hooks/use-toast";

interface MarketData {
  name: string;
  coinId: string;
  price: string;
  change: string;
  data: { time: string; price: number }[];
  color: string;
}

const COIN_IDS = ['monero', 'bitcoin', 'ethereum', 'solana', 'binancecoin'];
const MARKET_NAMES = ['XMR/USDT', 'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
const COLORS = ['hsl(var(--chart-3))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const MarketCharts = () => {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchMarketData = async () => {
    try {
      // Fetch current prices and 24h change
      const priceResponse = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${COIN_IDS.join(',')}&vs_currencies=usd&include_24hr_change=true`
      );
      const priceData = await priceResponse.json();

      // Fetch 24h chart data for each coin (without interval parameter to avoid 401 error)
      const chartPromises = COIN_IDS.map(coinId =>
        fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1`)
          .then(res => res.json())
      );

      const chartDataArray = await Promise.all(chartPromises);

      const newMarkets: MarketData[] = COIN_IDS.map((coinId, index) => {
        const price = priceData[coinId]?.usd || 0;
        const change = priceData[coinId]?.usd_24h_change || 0;
        const chartData = chartDataArray[index]?.prices || [];

        const formattedData = chartData.map((point: [number, number]) => {
          const date = new Date(point[0]);
          return {
            time: `${date.getHours()}:00`,
            price: point[1],
          };
        });

        return {
          name: MARKET_NAMES[index],
          coinId,
          price: price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
          data: formattedData,
          color: COLORS[index],
        };
      });

      setMarkets(newMarkets);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching market data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del mercado",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    
    // Update every 60 seconds
    const interval = setInterval(fetchMarketData, 60000);
    
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Principales Mercados</CardTitle>
          <CardDescription className="text-muted-foreground">
            Cargando datos del mercado...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
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