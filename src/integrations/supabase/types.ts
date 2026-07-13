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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          meta: Json
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json
          user_id?: string
        }
        Relationships: []
      }
      drafts: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          recipient_email: string
          recipient_name: string
          sent_at: string | null
          source_id: string | null
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          recipient_email: string
          recipient_name: string
          sent_at?: string | null
          source_id?: string | null
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          recipient_email?: string
          recipient_name?: string
          sent_at?: string | null
          source_id?: string | null
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          connected: boolean
          created_at: string
          id: string
          meta: Json
          provider: string
          user_id: string
        }
        Insert: {
          connected?: boolean
          created_at?: string
          id?: string
          meta?: Json
          provider: string
          user_id: string
        }
        Update: {
          connected?: boolean
          created_at?: string
          id?: string
          meta?: Json
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          client_email: string
          client_name: string
          created_at: string
          due_date: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          client_email: string
          client_name: string
          created_at?: string
          due_date: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_email?: string
          client_name?: string
          created_at?: string
          due_date?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          source: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          source?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          source?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      workflow_settings: {
        Row: {
          approval_required: boolean
          auto_send: boolean
          created_at: string
          id: string
          user_id: string
          workflow: string
        }
        Insert: {
          approval_required?: boolean
          auto_send?: boolean
          created_at?: string
          id?: string
          user_id: string
          workflow: string
        }
        Update: {
          approval_required?: boolean
          auto_send?: boolean
          created_at?: string
          id?: string
          user_id?: string
          workflow?: string
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
    Enums: {},
  },
} as const
