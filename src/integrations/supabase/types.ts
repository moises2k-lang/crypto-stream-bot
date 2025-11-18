export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bot_logs: {
        Row: {
          bot_id: string
          details: Json | null
          id: string
          log_level: string
          message: string
          timestamp: string
        }
        Insert: {
          bot_id: string
          details?: Json | null
          id?: string
          log_level?: string
          message: string
          timestamp?: string
        }
        Update: {
          bot_id?: string
          details?: Json | null
          id?: string
          log_level?: string
          message?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_logs_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "trading_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_slots: {
        Row: {
          bot_id: string
          buy_order_id: string | null
          entry_price: number
          filled_qty: number
          id: string
          last_update_ts: string
          qty: number
          size_usdt: number
          slot_id: number
          status: string
          tp_order_id: string | null
          tp_price: number
        }
        Insert: {
          bot_id: string
          buy_order_id?: string | null
          entry_price: number
          filled_qty?: number
          id?: string
          last_update_ts?: string
          qty?: number
          size_usdt?: number
          slot_id: number
          status?: string
          tp_order_id?: string | null
          tp_price: number
        }
        Update: {
          bot_id?: string
          buy_order_id?: string | null
          entry_price?: number
          filled_qty?: number
          id?: string
          last_update_ts?: string
          qty?: number
          size_usdt?: number
          slot_id?: number
          status?: string
          tp_order_id?: string | null
          tp_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bot_slots_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "trading_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_connections: {
        Row: {
          account_type: string
          api_key_preview: string | null
          connected_at: string | null
          created_at: string | null
          exchange_name: string
          id: string
          is_connected: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_type?: string
          api_key_preview?: string | null
          connected_at?: string | null
          created_at?: string | null
          exchange_name: string
          id?: string
          is_connected?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_type?: string
          api_key_preview?: string | null
          connected_at?: string | null
          created_at?: string | null
          exchange_name?: string
          id?: string
          is_connected?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exchange_credentials: {
        Row: {
          account_type: string
          api_key_ciphertext: string
          api_key_iv: string
          api_secret_ciphertext: string
          api_secret_iv: string
          created_at: string | null
          exchange_name: string
          id: string
          salt: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_type?: string
          api_key_ciphertext: string
          api_key_iv: string
          api_secret_ciphertext: string
          api_secret_iv: string
          created_at?: string | null
          exchange_name: string
          id?: string
          salt: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_type?: string
          api_key_ciphertext?: string
          api_key_iv?: string
          api_secret_ciphertext?: string
          api_secret_iv?: string
          created_at?: string | null
          exchange_name?: string
          id?: string
          salt?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      free_trials: {
        Row: {
          created_at: string
          expires_at: string | null
          has_used_trial: boolean | null
          id: string
          is_active: boolean | null
          started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          has_used_trial?: boolean | null
          id?: string
          is_active?: boolean | null
          started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          has_used_trial?: boolean | null
          id?: string
          is_active?: boolean | null
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      login_history: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_info: string | null
          id: string
          ip_address: string | null
          login_at: string
          os: string | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          login_at?: string
          os?: string | null
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          login_at?: string
          os?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          signal_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          signal_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          signal_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          created_at: string | null
          entry: string
          id: string
          pair: string
          status: string | null
          stop_loss: string
          target: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entry: string
          id?: string
          pair: string
          status?: string | null
          stop_loss: string
          target: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          entry?: string
          id?: string
          pair?: string
          status?: string | null
          stop_loss?: string
          target?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_connections: {
        Row: {
          chat_id: string
          created_at: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      trades: {
        Row: {
          created_at: string | null
          entry: string
          exit: string
          id: string
          pair: string
          percentage: string
          profit: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entry: string
          exit: string
          id?: string
          pair: string
          percentage: string
          profit: string
          status: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          entry?: string
          exit?: string
          id?: string
          pair?: string
          percentage?: string
          profit?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_bots: {
        Row: {
          account_type: string
          atr_period: number
          atr_timeframe: string
          base_capital_mode: string
          created_at: string
          exchange_name: string
          id: string
          is_active: boolean
          is_testnet: boolean
          last_run_at: string | null
          level_atr_mults: number[] | null
          level_pcts: number[] | null
          levels_method: string
          leverage: number | null
          name: string
          num_slots: number
          recenter_threshold_pct: number
          symbol: string
          total_alloc_pct: number
          tp_atr_mult: number | null
          tp_fixed: number | null
          tp_method: string
          tp_pct: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          atr_period?: number
          atr_timeframe?: string
          base_capital_mode?: string
          created_at?: string
          exchange_name?: string
          id?: string
          is_active?: boolean
          is_testnet?: boolean
          last_run_at?: string | null
          level_atr_mults?: number[] | null
          level_pcts?: number[] | null
          levels_method?: string
          leverage?: number | null
          name: string
          num_slots?: number
          recenter_threshold_pct?: number
          symbol?: string
          total_alloc_pct?: number
          tp_atr_mult?: number | null
          tp_fixed?: number | null
          tp_method?: string
          tp_pct?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          atr_period?: number
          atr_timeframe?: string
          base_capital_mode?: string
          created_at?: string
          exchange_name?: string
          id?: string
          is_active?: boolean
          is_testnet?: boolean
          last_run_at?: string | null
          level_atr_mults?: number[] | null
          level_pcts?: number[] | null
          levels_method?: string
          leverage?: number | null
          name?: string
          num_slots?: number
          recenter_threshold_pct?: number
          symbol?: string
          total_alloc_pct?: number
          tp_atr_mult?: number | null
          tp_fixed?: number | null
          tp_method?: string
          tp_pct?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          created_at: string | null
          id: string
          today_pnl: number | null
          total_balance: number | null
          updated_at: string | null
          user_id: string
          win_rate: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          today_pnl?: number | null
          total_balance?: number | null
          updated_at?: string | null
          user_id: string
          win_rate?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          today_pnl?: number | null
          total_balance?: number | null
          updated_at?: string | null
          user_id?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      webauthn_credentials: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_name: string | null
          id: string
          last_used_at: string | null
          public_key: string
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
