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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          role: 'user' | 'superuser'
          invite_status: 'invited' | 'active'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          role?: 'user' | 'superuser'
          invite_status?: 'invited' | 'active'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          role?: 'user' | 'superuser'
          invite_status?: 'invited' | 'active'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          context_snapshot: Json | null
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          context_snapshot?: Json | null
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          context_snapshot?: Json | null
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mesocycles: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string | null
          focus: string
          id: string
          interruption_notes: string | null
          name: string
          phase_type: string
          planned_end: string
          planned_start: string
          programme_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string | null
          focus: string
          id?: string
          interruption_notes?: string | null
          name: string
          phase_type: string
          planned_end: string
          planned_start: string
          programme_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string | null
          focus?: string
          id?: string
          interruption_notes?: string | null
          name?: string
          phase_type?: string
          planned_end?: string
          planned_start?: string
          programme_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mesocycles_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesocycles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_sessions: {
        Row: {
          created_at: string | null
          generated_plan: Json | null
          generation_notes: string | null
          id: string
          mesocycle_id: string | null
          planned_date: string
          session_type: string
          status: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          generated_plan?: Json | null
          generation_notes?: string | null
          id?: string
          mesocycle_id?: string | null
          planned_date: string
          session_type: string
          status?: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          generated_plan?: Json | null
          generation_notes?: string | null
          id?: string
          mesocycle_id?: string | null
          planned_date?: string
          session_type?: string
          status?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_sessions_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "weekly_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      programmes: {
        Row: {
          athlete_profile: Json | null
          created_at: string | null
          goal: string
          id: string
          name: string
          notes: string | null
          start_date: string
          status: string
          target_date: string
          user_id: string
        }
        Insert: {
          athlete_profile?: Json | null
          created_at?: string | null
          goal: string
          id?: string
          name: string
          notes?: string | null
          start_date: string
          status?: string
          target_date: string
          user_id: string
        }
        Update: {
          athlete_profile?: Json | null
          created_at?: string | null
          goal?: string
          id?: string
          name?: string
          notes?: string | null
          start_date?: string
          status?: string
          target_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programmes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      injury_areas: {
        Row: {
          id: string
          area: string
          is_active: boolean
          added_at: string
          archived_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          area: string
          is_active?: boolean
          added_at?: string
          archived_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          area?: string
          is_active?: boolean
          added_at?: string
          archived_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "injury_areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness_checkins: {
        Row: {
          created_at: string | null
          date: string
          fatigue: number
          finger_health: number
          id: string
          illness_flag: boolean
          injury_area_health: Json | null
          life_stress: number
          notes: string | null
          readiness_score: number | null
          sleep_quality: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          fatigue: number
          finger_health: number
          id?: string
          illness_flag?: boolean
          injury_area_health?: Json | null
          life_stress: number
          notes?: string | null
          readiness_score?: number | null
          sleep_quality: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          fatigue?: number
          finger_health?: number
          id?: string
          illness_flag?: boolean
          injury_area_health?: Json | null
          life_stress?: number
          notes?: string | null
          readiness_score?: number | null
          sleep_quality?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readiness_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_logs: {
        Row: {
          created_at: string | null
          date: string
          deviation_from_plan: string | null
          duration_mins: number | null
          id: string
          location: string | null
          log_data: Json | null
          notes: string | null
          planned_session_id: string | null
          quality_rating: number | null
          rpe: number | null
          session_type: string
          injury_flags: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          deviation_from_plan?: string | null
          duration_mins?: number | null
          id?: string
          injury_flags?: Json | null
          location?: string | null
          log_data?: Json | null
          notes?: string | null
          planned_session_id?: string | null
          quality_rating?: number | null
          rpe?: number | null
          session_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          deviation_from_plan?: string | null
          duration_mins?: number | null
          id?: string
          injury_flags?: Json | null
          location?: string | null
          log_data?: Json | null
          notes?: string | null
          planned_session_id?: string | null
          quality_rating?: number | null
          rpe?: number | null
          session_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_planned_session_id_fkey"
            columns: ["planned_session_id"]
            isOneToOne: false
            referencedRelation: "planned_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_templates: {
        Row: {
          day_of_week: number
          duration_mins: number | null
          id: string
          intensity: string
          mesocycle_id: string | null
          notes: string | null
          primary_focus: string | null
          session_label: string
          session_type: string
          user_id: string
        }
        Insert: {
          day_of_week: number
          duration_mins?: number | null
          id?: string
          intensity: string
          mesocycle_id?: string | null
          notes?: string | null
          primary_focus?: string | null
          session_label: string
          session_type: string
          user_id: string
        }
        Update: {
          day_of_week?: number
          duration_mins?: number | null
          id?: string
          intensity?: string
          mesocycle_id?: string | null
          notes?: string | null
          primary_focus?: string | null
          session_label?: string
          session_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_templates_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
