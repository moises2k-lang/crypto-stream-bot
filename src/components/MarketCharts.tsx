import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useToast } from "@/hooks/use-toast";
import { ArrowUpIcon, ArrowDownIcon, TrendingUp, Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MarketData {
  name: string;
  coinId: string;
  price: string;
  change: string;
  data: { time: string; price: number }[];
  color: string;
  volume: string;
  high24h: string;
  low24h: string;
  marketCap: string;
}

const SYMBOLS = ['XMRUSDT', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
const MARKET_NAMES = ['XMR/USDT', 'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
const COLORS = ['hsl(var(--chart-3))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

type TimeframePeriod = '24h' | '7d' | '1M' | '1Y';

interface TimeframeConfig {
  label: string;
  interval: string;
  limit: number;
  binanceInterval: string;
}

const TIMEFRAME_CONFIGS: Record<TimeframePeriod, TimeframeConfig> = {
  '24h': { label: '24 Horas', interval: '1h', limit: 24, binanceInterval: '1h' },
  '7d': { label: '7 Días', interval: '4h', limit: 42, binanceInterval: '4h' },
  '1M': { label: '1 Mes', interval: '1d', limit: 30, binanceInterval: '1d' },
  '1Y': { label: '1 Año', interval: '1w', limit: 52, binanceInterval: '1w' },
};

export const MarketCharts = () => {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<TimeframePeriod>('24h');
  const { toast } = useToast();

  const fetchMarketData = async (selectedTimeframe: TimeframePeriod = timeframe) => {
    const config = TIMEFRAME_CONFIGS[selectedTimeframe];
    try {
      // Fetch all market data from Binance API
      const marketPromises = SYMBOLS.map(async (symbol) => {
        try {
          // Use Binance Futures API for XMR, Binance Spot for others
          if (symbol === 'XMRUSDT') {
            // Get 24h ticker data from Binance Futures
            const tickerResponse = await fetch(
              `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`
            );
            
            if (!tickerResponse.ok) {
              throw new Error(`Failed to fetch ticker for ${symbol}`);
            }
            
            const tickerData = await tickerResponse.json();
            
            // Get kline data from Binance Futures
            const klineResponse = await fetch(
              `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${config.binanceInterval}&limit=${config.limit}`
            );
            
            if (!klineResponse.ok) {
              throw new Error(`Failed to fetch klines for ${symbol}`);
            }
            
            const klineData = await klineResponse.json();
            
            return {
              symbol,
              price: parseFloat(tickerData.lastPrice),
              change: parseFloat(tickerData.priceChangePercent),
              volume: parseFloat(tickerData.volume),
              high24h: parseFloat(tickerData.highPrice),
              low24h: parseFloat(tickerData.lowPrice),
              chartData: klineData.map((candle: any) => {
                const date = new Date(candle[0]);
                let timeLabel = '';
                
                if (selectedTimeframe === '24h') {
                  timeLabel = `${date.getHours().toString().padStart(2, '0')}:00`;
                } else if (selectedTimeframe === '7d') {
                  timeLabel = `${date.getDate()}/${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}h`;
                } else if (selectedTimeframe === '1M') {
                  timeLabel = `${date.getDate()}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                } else {
                  timeLabel = `${date.getDate()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
                }
                
                return {
                  time: timeLabel,
                  price: parseFloat(candle[4]), // Close price
                };
              }),
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
            
            // Get kline/candlestick data for chart
            const klineResponse = await fetch(
              `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${config.binanceInterval}&limit=${config.limit}`
            );
            
            if (!klineResponse.ok) {
              throw new Error(`Failed to fetch klines for ${symbol}`);
            }
            
            const klineData = await klineResponse.json();
            
            return {
              symbol,
              price: parseFloat(tickerData.lastPrice),
              change: parseFloat(tickerData.priceChangePercent),
              volume: parseFloat(tickerData.volume),
              high24h: parseFloat(tickerData.highPrice),
              low24h: parseFloat(tickerData.lowPrice),
              chartData: klineData.map((candle: any) => {
                const date = new Date(candle[0]);
                let timeLabel = '';
                
                if (selectedTimeframe === '24h') {
                  timeLabel = `${date.getHours().toString().padStart(2, '0')}:00`;
                } else if (selectedTimeframe === '7d') {
                  timeLabel = `${date.getDate()}/${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}h`;
                } else if (selectedTimeframe === '1M') {
                  timeLabel = `${date.getDate()}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                } else {
                  timeLabel = `${date.getDate()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
                }
                
                return {
                  time: timeLabel,
                  price: parseFloat(candle[4]), // Close price
                };
              }),
            };
          }
        } catch (error) {
          console.error(`Error fetching data for ${symbol}:`, error);
          return {
            symbol,
            price: 0,
            change: 0,
            volume: 0,
            high24h: 0,
            low24h: 0,
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
        volume: (data.volume / 1000000).toFixed(2) + 'M',
        high24h: data.high24h.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: data.high24h < 1 ? 6 : 2 
        }),
        low24h: data.low24h.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: data.low24h < 1 ? 6 : 2 
        }),
        marketCap: '$' + (data.price * data.volume / 1000000).toFixed(2) + 'M',
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
    fetchMarketData(timeframe);
    
    // Update every 30 seconds
    const interval = setInterval(() => fetchMarketData(timeframe), 30000);
    
    return () => clearInterval(interval);
  }, [timeframe]);

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Principales Mercados
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Gráficos en tiempo real - {TIMEFRAME_CONFIGS[timeframe].label}
            </CardDescription>
          </div>
          <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as TimeframePeriod)} className="w-auto">
            <TabsList className="bg-muted">
              <TabsTrigger value="24h" className="text-xs">24 Horas</TabsTrigger>
              <TabsTrigger value="7d" className="text-xs">7 Días</TabsTrigger>
              <TabsTrigger value="1M" className="text-xs">1 Mes</TabsTrigger>
              <TabsTrigger value="1Y" className="text-xs">1 Año</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {markets.map((market) => {
            const isPositive = market.change.startsWith('+');
            
            return (
              <div 
                key={market.name}
                className="bg-background border border-border rounded-xl p-5 hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-bold text-lg text-foreground">{market.name}</h3>
                    </div>
                    <p className="text-3xl font-bold text-foreground mb-2">${market.price}</p>
                    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
                      isPositive 
                        ? 'bg-success/10 text-success' 
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {isPositive ? (
                        <ArrowUpIcon className="h-4 w-4" />
                      ) : (
                        <ArrowDownIcon className="h-4 w-4" />
                      )}
                      {market.change}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Volumen 24h</p>
                    <p className="text-sm font-semibold text-foreground">${market.volume}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Máx 24h</p>
                    <p className="text-sm font-semibold text-success">${market.high24h}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mín 24h</p>
                    <p className="text-sm font-semibold text-destructive">${market.low24h}</p>
                  </div>
                </div>

                
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart 
                    data={market.data}
                    margin={{ top: 5, right: 5, left: 5, bottom: 25 }}
                  >
                    <defs>
                      <linearGradient id={`gradient-${market.coinId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={market.color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={market.color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="hsl(var(--border))" 
                      opacity={0.3}
                    />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      domain={['dataMin - 50', 'dataMax + 50']}
                      tickFormatter={(value) => `$${value.toFixed(0)}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        color: 'hsl(var(--popover-foreground))',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                      formatter={(value: any) => [`$${value.toFixed(2)}`, 'Precio']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke={market.color}
                      strokeWidth={3}
                      fill={`url(#gradient-${market.coinId})`}
                      dot={false}
                      activeDot={{ r: 6, fill: market.color }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};