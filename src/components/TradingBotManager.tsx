import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Play, Pause, Trash2, Settings, Plus, Activity, Clock } from "lucide-react";
import { BotScheduler } from "./BotScheduler";

interface TradingBot {
  id: string;
  name: string;
  symbol: string;
  exchange_name: string;
  account_type: string;
  is_active: boolean;
  is_testnet: boolean;
  num_slots: number;
  leverage: number | null;
  total_alloc_pct: number;
  base_capital_mode: string;
  levels_method: string;
  atr_timeframe: string;
  atr_period: number;
  level_atr_mults: number[];
  level_pcts: number[];
  tp_method: string;
  tp_atr_mult: number;
  tp_pct: number;
  tp_fixed: number;
  recenter_threshold_pct: number;
  last_run_at: string | null;
}

interface BotSlot {
  slot_id: number;
  entry_price: number;
  tp_price: number;
  size_usdt: number;
  qty: number;
  buy_order_id: string;
  tp_order_id: string;
  status: string;
  filled_qty: number;
}

interface BotLog {
  timestamp: string;
  log_level: string;
  message: string;
  details: any;
}

export const TradingBotManager = () => {
  const [bots, setBots] = useState<TradingBot[]>([]);
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [slots, setSlots] = useState<BotSlot[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newBot, setNewBot] = useState({
    name: "XMR Bot",
    symbol: "XMR/USDT:USDT",
    exchange_name: "Bybit",
    account_type: "demo",
    is_testnet: true,
    num_slots: 6,
    leverage: 20,
    total_alloc_pct: 0.6,
    base_capital_mode: "initial",
    levels_method: "atr",
    atr_timeframe: "5m",
    atr_period: 14,
    level_atr_mults: [0, 1, 2, 3, 4, 5],
    level_pcts: [0, -0.03, -0.06, -0.12, -0.25, -0.5],
    tp_method: "atr_above_entry",
    tp_atr_mult: 0.5,
    tp_pct: 0.005,
    tp_fixed: 0,
    recenter_threshold_pct: 0.001
  });

  useEffect(() => {
    fetchBots();
  }, []);

  useEffect(() => {
    if (selectedBot) {
      fetchBotData(selectedBot);
    }
  }, [selectedBot]);

  const fetchBots = async () => {
    const { data, error } = await supabase
      .from('trading_bots')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error loading bots');
      return;
    }

    setBots(data || []);
  };

  const fetchBotData = async (botId: string) => {
    // Fetch slots
    const { data: slotsData } = await supabase
      .from('bot_slots')
      .select('*')
      .eq('bot_id', botId)
      .order('slot_id');

    setSlots(slotsData || []);

    // Fetch logs
    const { data: logsData } = await supabase
      .from('bot_logs')
      .select('*')
      .eq('bot_id', botId)
      .order('timestamp', { ascending: false })
      .limit(50);

    setLogs(logsData || []);
  };

  const createBot = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const { data, error } = await supabase
        .from('trading_bots')
        .insert([{ ...newBot, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Bot created successfully');
      setDialogOpen(false);
      fetchBots();
    } catch (error) {
      console.error('Error creating bot:', error);
      toast.error('Failed to create bot');
    } finally {
      setLoading(false);
    }
  };

  const toggleBot = async (botId: string, currentState: boolean) => {
    const { error } = await supabase
      .from('trading_bots')
      .update({ is_active: !currentState })
      .eq('id', botId);

    if (error) {
      toast.error('Error toggling bot');
      return;
    }

    toast.success(currentState ? 'Bot stopped' : 'Bot started');
    fetchBots();
  };

  const runBot = async (botId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-trading-bot', {
        body: { botId }
      });

      if (error) throw error;

      toast.success('Bot executed successfully');
      fetchBotData(botId);
    } catch (error) {
      console.error('Error running bot:', error);
      toast.error('Failed to run bot');
    } finally {
      setLoading(false);
    }
  };

  const deleteBot = async (botId: string) => {
    if (!confirm('Are you sure you want to delete this bot?')) return;

    const { error } = await supabase
      .from('trading_bots')
      .delete()
      .eq('id', botId);

    if (error) {
      toast.error('Error deleting bot');
      return;
    }

    toast.success('Bot deleted');
    setSelectedBot(null);
    fetchBots();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Trading Bots</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Bot
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Trading Bot</DialogTitle>
              <DialogDescription>
                Configure a new XMR ladder trading bot
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Bot Name</Label>
                <Input
                  value={newBot.name}
                  onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Symbol</Label>
                  <Input
                    value={newBot.symbol}
                    onChange={(e) => setNewBot({ ...newBot, symbol: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Exchange</Label>
                  <Select
                    value={newBot.exchange_name}
                    onValueChange={(value) => setNewBot({ ...newBot, exchange_name: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bybit">Bybit</SelectItem>
                      <SelectItem value="Binance">Binance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Account Type</Label>
                  <Select
                    value={newBot.account_type}
                    onValueChange={(value) => setNewBot({ ...newBot, account_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="real">Real</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newBot.is_testnet}
                    onCheckedChange={(checked) => setNewBot({ ...newBot, is_testnet: checked })}
                  />
                  <Label>Use Testnet</Label>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Number of Slots</Label>
                  <Input
                    type="number"
                    value={newBot.num_slots}
                    onChange={(e) => setNewBot({ ...newBot, num_slots: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Leverage</Label>
                  <Input
                    type="number"
                    value={newBot.leverage || ''}
                    onChange={(e) => setNewBot({ ...newBot, leverage: parseInt(e.target.value) || null })}
                  />
                </div>
                <div>
                  <Label>Capital Allocation %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newBot.total_alloc_pct}
                    onChange={(e) => setNewBot({ ...newBot, total_alloc_pct: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label>Levels Method</Label>
                <Select
                  value={newBot.levels_method}
                  onValueChange={(value) => setNewBot({ ...newBot, levels_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atr">ATR</SelectItem>
                    <SelectItem value="percent">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Take Profit Method</Label>
                <Select
                  value={newBot.tp_method}
                  onValueChange={(value) => setNewBot({ ...newBot, tp_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atr_above_entry">ATR Above Entry</SelectItem>
                    <SelectItem value="percent_of_entry">Percentage of Entry</SelectItem>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={createBot} disabled={loading} className="w-full">
                {loading ? 'Creating...' : 'Create Bot'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Bots</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {bots.map((bot) => (
                <Card
                  key={bot.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedBot === bot.id ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                  onClick={() => setSelectedBot(bot.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{bot.name}</div>
                      <div className="text-sm text-muted-foreground">{bot.symbol}</div>
                      <BotScheduler 
                        botId={bot.id} 
                        isActive={bot.is_active}
                        intervalSeconds={60}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {bot.is_active ? (
                        <Activity className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-gray-400" />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedBot ? (
            <BotDetails
              bot={bots.find(b => b.id === selectedBot)!}
              slots={slots}
              logs={logs}
              onToggle={toggleBot}
              onRun={runBot}
              onDelete={deleteBot}
              loading={loading}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Select a bot to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

const BotDetails = ({
  bot,
  slots,
  logs,
  onToggle,
  onRun,
  onDelete,
  loading
}: {
  bot: TradingBot;
  slots: BotSlot[];
  logs: BotLog[];
  onToggle: (id: string, state: boolean) => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle>{bot.name}</CardTitle>
            <CardDescription>
              {bot.exchange_name} • {bot.symbol} • {bot.account_type}
            </CardDescription>
            <BotScheduler 
              botId={bot.id} 
              isActive={bot.is_active}
              intervalSeconds={60}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onToggle(bot.id, bot.is_active)}
            >
              {bot.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              onClick={() => onRun(bot.id)}
              disabled={loading}
            >
              Run Now
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(bot.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="slots">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="slots">Slots</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="slots" className="space-y-2">
            {slots.map((slot) => (
              <Card key={slot.slot_id}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Slot</div>
                      <div className="font-medium">{slot.slot_id}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Entry</div>
                      <div className="font-medium">${slot.entry_price}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">TP</div>
                      <div className="font-medium">${slot.tp_price}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Status</div>
                      <div className="font-medium">{slot.status}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="config" className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Slots</div>
                <div className="font-medium">{bot.num_slots}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Leverage</div>
                <div className="font-medium">{bot.leverage || 'Not set'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Capital Allocation</div>
                <div className="font-medium">{(bot.total_alloc_pct * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Levels Method</div>
                <div className="font-medium">{bot.levels_method}</div>
              </div>
              <div>
                <div className="text-muted-foreground">TP Method</div>
                <div className="font-medium">{bot.tp_method}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Last Run</div>
                <div className="font-medium">
                  {bot.last_run_at ? new Date(bot.last_run_at).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log, idx) => (
              <div key={idx} className="text-sm border-l-2 border-primary pl-3 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`text-xs font-medium ${
                    log.log_level === 'error' ? 'text-red-500' :
                    log.log_level === 'warn' ? 'text-yellow-500' :
                    'text-green-500'
                  }`}>
                    {log.log_level.toUpperCase()}
                  </span>
                </div>
                <div>{log.message}</div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
