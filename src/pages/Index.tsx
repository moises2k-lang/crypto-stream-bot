import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatsGrid } from "@/components/StatsGrid";
import { SignalsPanel } from "@/components/SignalsPanel";
import { TradesHistory } from "@/components/TradesHistory";
import { MarketCharts } from "@/components/MarketCharts";
import { NotificationsHistory } from "@/components/NotificationsHistory";
import { ExchangeConnections } from "@/components/ExchangeConnections";
import { Auth } from "@/components/Auth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

const Index = () => {
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [isExchangeConnected, setIsExchangeConnected] = useState(false);

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
      
      <main className="container mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        <StatsGrid />
        
        <ExchangeConnections 
          isConnected={isExchangeConnected}
          onConnectionChange={setIsExchangeConnected}
        />
        
        <MarketCharts />
        
        <Tabs defaultValue="signals" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signals">{t('tabs.signals')}</TabsTrigger>
            <TabsTrigger value="notifications">{t('tabs.notifications')}</TabsTrigger>
          </TabsList>
          <TabsContent value="signals" className="mt-6">
            <SignalsPanel />
          </TabsContent>
          <TabsContent value="notifications" className="mt-6">
            <NotificationsHistory />
          </TabsContent>
        </Tabs>
        
        <TradesHistory />
      </main>
    </div>
  );
};

export default Index;
