import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const StatsGrid = () => {
  const [stats, setStats] = useState({
    totalBalance: 0,
    todayPnl: 0,
    activeSignals: 0,
    winRate: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

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
        totalBalance: Number(userStats.total_balance),
        todayPnl: Number(userStats.today_pnl),
        activeSignals: signals?.length || 0,
        winRate: Number(userStats.win_rate)
      });
    }
  };

  const statsData = [
    {
      label: "Total Balance",
      value: `$${stats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: stats.todayPnl >= 0 ? `+${((stats.todayPnl / stats.totalBalance) * 100).toFixed(1)}%` : `${((stats.todayPnl / stats.totalBalance) * 100).toFixed(1)}%`,
      trend: stats.todayPnl >= 0 ? "up" as const : "down" as const,
      icon: DollarSign,
    },
    {
      label: "Today's P&L",
      value: stats.todayPnl >= 0 ? `+$${stats.todayPnl.toFixed(2)}` : `-$${Math.abs(stats.todayPnl).toFixed(2)}`,
      change: stats.todayPnl >= 0 ? `+${((stats.todayPnl / stats.totalBalance) * 100).toFixed(1)}%` : `${((stats.todayPnl / stats.totalBalance) * 100).toFixed(1)}%`,
      trend: stats.todayPnl >= 0 ? "up" as const : "down" as const,
      icon: stats.todayPnl >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: "Active Signals",
      value: stats.activeSignals.toString(),
      change: `${stats.activeSignals} activas`,
      trend: "neutral" as const,
      icon: Activity,
    },
    {
      label: "Win Rate",
      value: `${stats.winRate.toFixed(1)}%`,
      change: stats.winRate >= 60 ? "Excelente" : stats.winRate >= 50 ? "Bueno" : "Mejorable",
      trend: stats.winRate >= 60 ? "up" as const : "neutral" as const,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statsData.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <Icon className={`h-4 w-4 ${
                  stat.trend === 'up' ? 'text-success' : 
                  stat.trend === 'neutral' ? 'text-primary' :
                  'text-danger'
                }`} />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
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
  );
};
