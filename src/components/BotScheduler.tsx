import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BotSchedulerProps {
  botId: string;
  isActive: boolean;
  intervalSeconds?: number;
}

export const BotScheduler = ({ botId, isActive, intervalSeconds = 60 }: BotSchedulerProps) => {
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [nextRun, setNextRun] = useState<Date | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setNextRun(null);
      setLastRun(null);
      return;
    }

    let isMounted = true;

    const runBot = async () => {
      if (!isMounted || isRunning) return;
      
      setIsRunning(true);
      try {
        console.log(`[Scheduler] Running bot ${botId}`);
        const { data, error } = await supabase.functions.invoke('run-trading-bot', {
          body: { botId }
        });

        if (error) {
          console.error('[Scheduler] Error:', error);
          return;
        }
        
        if (data && !data.success) {
          console.error('[Scheduler] Bot execution failed:', data.message);
          return;
        }
        
        console.log('[Scheduler] Success:', data);
        if (isMounted) {
          setLastRun(new Date());
        }
      } catch (error) {
        console.error('[Scheduler] Exception:', error);
      } finally {
        if (isMounted) {
          setIsRunning(false);
        }
      }
    };

    // Run immediately on activation
    runBot();

    // Then run at intervals
    const interval = setInterval(() => {
      runBot();
      if (isMounted) {
        setNextRun(new Date(Date.now() + intervalSeconds * 1000));
      }
    }, intervalSeconds * 1000);

    // Set next run time
    setNextRun(new Date(Date.now() + intervalSeconds * 1000));

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [botId, isActive, intervalSeconds]);

  if (!isActive) return null;

  return (
    <div className="text-xs text-muted-foreground mt-2 space-y-1">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span>{isRunning ? 'Running...' : 'Waiting'}</span>
      </div>
      {lastRun && (
        <div>Last run: {lastRun.toLocaleTimeString()}</div>
      )}
      {nextRun && !isRunning && (
        <div>Next run: {nextRun.toLocaleTimeString()}</div>
      )}
    </div>
  );
};
