import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Activity, DollarSign, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export const StatsGrid = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalBalance: 0,
    todayPnl: 0,
    activeSignals: 0,
    winRate: 0
  });
  const [logs, setLogs] = useState<{ exchange: string; logs: string[] }[]>([]);
  const [syncing, setSyncing] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchStats();
  }, []);

  const syncExchange = async (exchangeName: 'Binance' | 'Bybit') => {
    setSyncing(prev => ({ ...prev, [exchangeName]: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-exchange-balance-single', {
        body: { exchangeName }
      });

      if (error) {
        toast.error(`Error al sincronizar ${exchangeName}: ${error.message}`);
        return;
      }

      if (data?.logs) {
        setLogs(prev => {
          const filtered = prev.filter(l => l.exchange !== exchangeName);
          return [...filtered, { exchange: exchangeName, logs: data.logs }];
        });
      }

      if (data?.success) {
        toast.success(`${exchangeName} sincronizado: $${data.balance.toFixed(2)}`);
      } else {
        toast.warning(`${exchangeName}: ${data?.error || 'No se pudo obtener el balance'}`);
      }

      // Refresh stats after sync
      await fetchStats();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
      console.error('Sync error:', error);
    } finally {
      setSyncing(prev => ({ ...prev, [exchangeName]: false }));
    }
  };

  const fetchStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch user stats
    const { data: userStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Fetch active signals count
    const { data: signals } = await supabase
      .from('signals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (userStats) {
      setStats({
        totalBalance: Number(userStats.total_balance) || 0,
        todayPnl: Number(userStats.today_pnl) || 0,
        activeSignals: signals?.length || 0,
        winRate: Number(userStats.win_rate) || 0
      });
    } else {
      // Si no hay stats, crear entrada inicial
      const { error } = await supabase
        .from('user_stats')
        .insert({
          user_id: user.id,
          total_balance: 0,
          today_pnl: 0,
          win_rate: 0
        });
      
      if (error) console.error('Error creating user_stats:', error);
    }
  };

  const changePct = stats.totalBalance > 0 
    ? ((stats.todayPnl / stats.totalBalance) * 100).toFixed(1)
    : '0.0';

  const statsData = [
    {
      label: t('stats.totalBalance'),
      value: `$${stats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: stats.todayPnl >= 0 ? `+${changePct}%` : `-${changePct}%`,
      trend: stats.todayPnl >= 0 ? "up" as const : "down" as const,
      icon: DollarSign,
    },
    {
      label: t('stats.todayPnL'),
      value: stats.todayPnl >= 0 ? `+$${stats.todayPnl.toFixed(2)}` : `-$${Math.abs(stats.todayPnl).toFixed(2)}`,
      change: stats.todayPnl >= 0 ? `+${changePct}%` : `-${changePct}%`,
      trend: stats.todayPnl >= 0 ? "up" as const : "down" as const,
      icon: stats.todayPnl >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: t('signals.title'),
      value: stats.activeSignals.toString(),
      change: `${stats.activeSignals} ${t('signals.active')}`,
      trend: "neutral" as const,
      icon: Activity,
    },
    {
      label: t('stats.winRate'),
      value: `${stats.winRate.toFixed(1)}%`,
      change: stats.winRate >= 60 ? "Excelente" : stats.winRate >= 50 ? "Bueno" : "Mejorable",
      trend: stats.winRate >= 60 ? "up" as const : "neutral" as const,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={() => syncExchange('Binance')}
          disabled={syncing.Binance}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing.Binance ? 'animate-spin' : ''}`} />
          Sincronizar Binance
        </Button>
        <Button
          onClick={() => syncExchange('Bybit')}
          disabled={syncing.Bybit}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing.Bybit ? 'animate-spin' : ''}`} />
          Sincronizar Bybit
        </Button>
      </div>

      {logs.length > 0 && (
        <div className="space-y-2">
          {logs.map((logEntry) => (
            <Card key={logEntry.exchange} className="bg-muted/50">
              <CardContent className="p-3">
                <h4 className="text-sm font-semibold mb-2">{logEntry.exchange} Logs:</h4>
                <div className="space-y-1 text-xs font-mono">
                  {logEntry.logs.map((log, idx) => (
                    <div 
                      key={idx} 
                      className={`${
                        log.startsWith('✓') ? 'text-success' : 
                        log.startsWith('✗') ? 'text-danger' :
                        log.startsWith('⚠') ? 'text-warning' :
                        'text-muted-foreground'
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {statsData.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="bg-card border-border">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs md:text-sm text-muted-foreground truncate pr-2">{stat.label}</span>
                  <Icon className={`h-4 w-4 flex-shrink-0 ${
                    stat.trend === 'up' ? 'text-success' : 
                    stat.trend === 'neutral' ? 'text-primary' :
                    'text-danger'
                  }`} />
                </div>
                <div className="space-y-1">
                  <p className="text-xl md:text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className={`text-xs ${
                    stat.trend === 'up' ? 'text-success' : 
                    stat.trend === 'neutral' ? 'text-muted-foreground' :
                    'text-danger'
                  }`}>
                    {stat.change}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
