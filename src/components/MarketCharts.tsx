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

const SYMBOLS = ['XMRUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
const MARKET_NAMES = ['XMR/USDT', 'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
const COLORS = ['hsl(var(--chart-3))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const MarketCharts = () => {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchMarketData = async () => {
    try {
      // Fetch all market data from Binance API
      const marketPromises = SYMBOLS.map(async (symbol) => {
        try {
          // Use KuCoin API for XMR, Binance for others
          if (symbol === 'XMRUSDT') {
            // Get 24h ticker data from KuCoin
            const tickerResponse = await fetch(
              `https://api.kucoin.com/api/v1/market/stats?symbol=XMR-USDT`
            );
            
            if (!tickerResponse.ok) {
              throw new Error(`Failed to fetch ticker for ${symbol}`);
            }
            
            const tickerData = await tickerResponse.json();
            const ticker = tickerData.data;
            
            // Get kline data from KuCoin (1hour intervals, last 24 hours)
            const klineResponse = await fetch(
              `https://api.kucoin.com/api/v1/market/candles?type=1hour&symbol=XMR-USDT&startAt=${Math.floor(Date.now() / 1000) - 86400}&endAt=${Math.floor(Date.now() / 1000)}`
            );
            
            if (!klineResponse.ok) {
              throw new Error(`Failed to fetch klines for ${symbol}`);
            }
            
            const klineData = await klineResponse.json();
            
            return {
              symbol,
              price: parseFloat(ticker.last),
              change: parseFloat(ticker.changeRate) * 100, // KuCoin returns decimal, convert to percentage
              chartData: klineData.data.reverse().map((candle: any) => ({
                time: new Date(parseInt(candle[0]) * 1000).getHours() + ':00',
                price: parseFloat(candle[4]), // Close price
              })),
            };
          } else {
            // Get 24h ticker data from Binance
            const tickerResponse = await fetch(
              `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`
            );
            
            if (!tickerResponse.ok) {
              throw new Error(`Failed to fetch ticker for ${symbol}`);
            }
            
            const tickerData = await tickerResponse.json();
            
            // Get kline/candlestick data for chart (1 hour intervals, last 24 hours)
            const klineResponse = await fetch(
              `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`
            );
            
            if (!klineResponse.ok) {
              throw new Error(`Failed to fetch klines for ${symbol}`);
            }
            
            const klineData = await klineResponse.json();
            
            return {
              symbol,
              price: parseFloat(tickerData.lastPrice),
              change: parseFloat(tickerData.priceChangePercent),
              chartData: klineData.map((candle: any) => ({
                time: new Date(candle[0]).getHours() + ':00',
                price: parseFloat(candle[4]), // Close price
              })),
            };
          }
        } catch (error) {
          console.error(`Error fetching data for ${symbol}:`, error);
          return {
            symbol,
            price: 0,
            change: 0,
            chartData: [],
          };
        }
      });

      const marketDataArray = await Promise.all(marketPromises);

      const newMarkets: MarketData[] = marketDataArray.map((data, index) => ({
        name: MARKET_NAMES[index],
        coinId: SYMBOLS[index],
        price: data.price.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: data.price < 1 ? 6 : 2 
        }),
        change: `${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)}%`,
        data: data.chartData,
        color: COLORS[index],
      }));

      setMarkets(newMarkets);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching market data:', error);
      toast({
        title: "Error",
        description: "No se pudieron obtener datos de mercado. Por favor, intenta de nuevo más tarde.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    
    // Update every 30 seconds with Binance API (no strict rate limits)
    const interval = setInterval(fetchMarketData, 30000);
    
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