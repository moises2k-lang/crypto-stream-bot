import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity, DollarSign } from "lucide-react";

const stats = [
  {
    label: "Total Balance",
    value: "$12,845.32",
    change: "+12.5%",
    trend: "up" as const,
    icon: DollarSign,
  },
  {
    label: "Today's P&L",
    value: "+$234.56",
    change: "+5.2%",
    trend: "up" as const,
    icon: TrendingUp,
  },
  {
    label: "Active Signals",
    value: "7",
    change: "3 pending",
    trend: "neutral" as const,
    icon: Activity,
  },
  {
    label: "Win Rate",
    value: "68.4%",
    change: "+2.1%",
    trend: "up" as const,
    icon: TrendingUp,
  },
];

export const StatsGrid = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
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
