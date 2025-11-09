import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatsGrid } from "@/components/StatsGrid";
import { ExchangeConnections } from "@/components/ExchangeConnections";
import { SignalsPanel } from "@/components/SignalsPanel";
import { TradesHistory } from "@/components/TradesHistory";
import { MarketCharts } from "@/components/MarketCharts";
import { Auth } from "@/components/Auth";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!user) {
    return <Auth />;
  }

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
