import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatsGrid } from "@/components/StatsGrid";
import { ExchangeConnections } from "@/components/ExchangeConnections";
import { SignalsPanel } from "@/components/SignalsPanel";
import { TradesHistory } from "@/components/TradesHistory";
import { MarketCharts } from "@/components/MarketCharts";

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        <StatsGrid />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <MarketCharts />
            <SignalsPanel />
            <TradesHistory />
          </div>
          
          <div>
            <ExchangeConnections 
              isConnected={isConnected}
              onConnectionChange={setIsConnected}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
