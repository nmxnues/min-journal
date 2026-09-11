export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_risk_changes: {
        Row: {
          account_id: string
          created_at: string
          effective_at: string
          fixed_risk_amount: number | null
          id: string
          risk_mode: string
          risk_percent: number | null
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          effective_at?: string
          fixed_risk_amount?: number | null
          id?: string
          risk_mode: string
          risk_percent?: number | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          effective_at?: string
          fixed_risk_amount?: number | null
          id?: string
          risk_mode?: string
          risk_percent?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_risk_changes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string
          currency: string
          drawdown_limit_percent: number
          fixed_risk_amount: number | null
          id: string
          name: string
          risk_mode: string
          risk_percent: number | null
          started_at: string
          starting_capital: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          drawdown_limit_percent?: number
          fixed_risk_amount?: number | null
          id?: string
          name: string
          risk_mode: string
          risk_percent?: number | null
          started_at: string
          starting_capital: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          drawdown_limit_percent?: number
          fixed_risk_amount?: number | null
          id?: string
          name?: string
          risk_mode?: string
          risk_percent?: number | null
          started_at?: string
          starting_capital?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          caption: string | null
          created_at: string
          height: number | null
          id: string
          storage_path: string
          trade_id: string
          user_id: string
          width: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          storage_path: string
          trade_id: string
          user_id: string
          width?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          storage_path?: string
          trade_id?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          currency: string
          date: string
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          currency: string
          date: string
          id?: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          currency?: string
          date?: string
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          payload?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      models: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          reference_image_path: string | null
          rules: Json
          sort_order: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          reference_image_path?: string | null
          rules?: Json
          sort_order?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          reference_image_path?: string | null
          rules?: Json
          sort_order?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          default_instrument: string
          default_session: string
          pnl_convention: string
          r_precision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_instrument?: string
          default_session?: string
          pnl_convention?: string
          r_precision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_instrument?: string
          default_session?: string
          pnl_convention?: string
          r_precision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          account_id: string
          confirmation: string | null
          created_at: string
          date: string
          direction: string
          entry: number
          exit: number | null
          exit_reason: string | null
          hold_minutes: number | null
          htf_pairing: string
          id: string
          instrument: string
          model_id: string | null
          notes: string | null
          r_value_at_entry: number
          range_high: number
          range_low: number
          result: string | null
          session: string
          size: number
          stop: number
          sweep_side: string
          tags: string[]
          target: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          confirmation?: string | null
          created_at?: string
          date: string
          direction: string
          entry: number
          exit?: number | null
          exit_reason?: string | null
          hold_minutes?: number | null
          htf_pairing?: string
          id?: string
          instrument: string
          model_id?: string | null
          notes?: string | null
          r_value_at_entry: number
          range_high: number
          range_low: number
          result?: string | null
          session: string
          size: number
          stop: number
          sweep_side: string
          tags?: string[]
          target?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          confirmation?: string | null
          created_at?: string
          date?: string
          direction?: string
          entry?: number
          exit?: number | null
          exit_reason?: string | null
          hold_minutes?: number | null
          htf_pairing?: string
          id?: string
          instrument?: string
          model_id?: string | null
          notes?: string | null
          r_value_at_entry?: number
          range_high?: number
          range_low?: number
          result?: string | null
          session?: string
          size?: number
          stop?: number
          sweep_side?: string
          tags?: string[]
          target?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          created_at: string
          focus_items: Json
          id: string
          iso_week: string
          one_change: string | null
          updated_at: string
          user_id: string
          what_didnt: string | null
          what_worked: string | null
        }
        Insert: {
          created_at?: string
          focus_items?: Json
          id?: string
          iso_week: string
          one_change?: string | null
          updated_at?: string
          user_id: string
          what_didnt?: string | null
          what_worked?: string | null
        }
        Update: {
          created_at?: string
          focus_items?: Json
          id?: string
          iso_week?: string
          one_change?: string | null
          updated_at?: string
          user_id?: string
          what_didnt?: string | null
          what_worked?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

