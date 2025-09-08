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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      encrypted_strava_tokens: {
        Row: {
          access_token_encrypted: string
          created_at: string
          expires_at: string
          id: string
          refresh_token_encrypted: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token_encrypted: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token_encrypted?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_state_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          redirect_url: string | null
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          redirect_url?: string | null
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          redirect_url?: string | null
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          created_at: string
          current_weekly_mileage: number | null
          days_per_week: number | null
          elevation_context: string | null
          email: string | null
          experience_years: number | null
          full_name: string | null
          further_notes: string | null
          gender: string | null
          goal: string
          goal_pace_per_km: string | null
          height: number | null
          id: string
          injuries: string | null
          longest_run_km: number | null
          race_date: string
          race_distance_km: number | null
          race_name: string | null
          race_results: string | null
          race_surface: string | null
          strava_athlete_id: string | null
          strava_connected: boolean | null
          strava_connected_at: string | null
          strava_token_expires_at: string | null
          strength_notes: string | null
          time_limits: string | null
          training_history: string | null
          units: string | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          current_weekly_mileage?: number | null
          days_per_week?: number | null
          elevation_context?: string | null
          email?: string | null
          experience_years?: number | null
          full_name?: string | null
          further_notes?: string | null
          gender?: string | null
          goal: string
          goal_pace_per_km?: string | null
          height?: number | null
          id?: string
          injuries?: string | null
          longest_run_km?: number | null
          race_date: string
          race_distance_km?: number | null
          race_name?: string | null
          race_results?: string | null
          race_surface?: string | null
          strava_athlete_id?: string | null
          strava_connected?: boolean | null
          strava_connected_at?: string | null
          strava_token_expires_at?: string | null
          strength_notes?: string | null
          time_limits?: string | null
          training_history?: string | null
          units?: string | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          created_at?: string
          current_weekly_mileage?: number | null
          days_per_week?: number | null
          elevation_context?: string | null
          email?: string | null
          experience_years?: number | null
          full_name?: string | null
          further_notes?: string | null
          gender?: string | null
          goal?: string
          goal_pace_per_km?: string | null
          height?: number | null
          id?: string
          injuries?: string | null
          longest_run_km?: number | null
          race_date?: string
          race_distance_km?: number | null
          race_name?: string | null
          race_results?: string | null
          race_surface?: string | null
          strava_athlete_id?: string | null
          strava_connected?: boolean | null
          strava_connected_at?: string | null
          strava_token_expires_at?: string | null
          strength_notes?: string | null
          time_limits?: string | null
          training_history?: string | null
          units?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          created_at: string
          event_details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      strava_activities: {
        Row: {
          achievement_count: number | null
          activity_type: string
          average_cadence: number | null
          average_heartrate: number | null
          average_speed: number | null
          average_watts: number | null
          created_at: string
          distance: number | null
          elapsed_time: number | null
          id: string
          kilojoules: number | null
          kudos_count: number | null
          max_heartrate: number | null
          max_speed: number | null
          moving_time: number | null
          name: string
          start_date: string
          strava_activity_id: number
          suffer_score: number | null
          total_elevation_gain: number | null
          updated_at: string
          user_id: string
          weighted_average_watts: number | null
        }
        Insert: {
          achievement_count?: number | null
          activity_type: string
          average_cadence?: number | null
          average_heartrate?: number | null
          average_speed?: number | null
          average_watts?: number | null
          created_at?: string
          distance?: number | null
          elapsed_time?: number | null
          id?: string
          kilojoules?: number | null
          kudos_count?: number | null
          max_heartrate?: number | null
          max_speed?: number | null
          moving_time?: number | null
          name: string
          start_date: string
          strava_activity_id: number
          suffer_score?: number | null
          total_elevation_gain?: number | null
          updated_at?: string
          user_id: string
          weighted_average_watts?: number | null
        }
        Update: {
          achievement_count?: number | null
          activity_type?: string
          average_cadence?: number | null
          average_heartrate?: number | null
          average_speed?: number | null
          average_watts?: number | null
          created_at?: string
          distance?: number | null
          elapsed_time?: number | null
          id?: string
          kilojoules?: number | null
          kudos_count?: number | null
          max_heartrate?: number | null
          max_speed?: number | null
          moving_time?: number | null
          name?: string
          start_date?: string
          strava_activity_id?: number
          suffer_score?: number | null
          total_elevation_gain?: number | null
          updated_at?: string
          user_id?: string
          weighted_average_watts?: number | null
        }
        Relationships: []
      }
      strava_best_efforts: {
        Row: {
          achievement_rank: number | null
          activity_id: string | null
          created_at: string
          distance: number
          elapsed_time: number
          id: string
          moving_time: number | null
          name: string
          pr_rank: number | null
          start_date: string
          strava_effort_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_rank?: number | null
          activity_id?: string | null
          created_at?: string
          distance: number
          elapsed_time: number
          id?: string
          moving_time?: number | null
          name: string
          pr_rank?: number | null
          start_date: string
          strava_effort_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_rank?: number | null
          activity_id?: string | null
          created_at?: string
          distance?: number
          elapsed_time?: number
          id?: string
          moving_time?: number | null
          name?: string
          pr_rank?: number | null
          start_date?: string
          strava_effort_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_strava_best_efforts_activity_id"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "strava_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      strava_stats: {
        Row: {
          achievement_count: number | null
          count: number | null
          created_at: string
          distance: number | null
          elevation_gain: number | null
          id: string
          moving_time: number | null
          period_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_count?: number | null
          count?: number | null
          created_at?: string
          distance?: number | null
          elevation_gain?: number | null
          id?: string
          moving_time?: number | null
          period_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_count?: number | null
          count?: number | null
          created_at?: string
          distance?: number | null
          elevation_gain?: number | null
          id?: string
          moving_time?: number | null
          period_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      training_days: {
        Row: {
          additional_training: string | null
          created_at: string
          daily_nutrition_advice: string | null
          date: string
          detailed_fields_generated: boolean | null
          estimated_avg_pace_min_per_km: string | null
          estimated_avg_power_w: number | null
          estimated_cadence_spm: number | null
          estimated_calories: number | null
          estimated_distance_km: number | null
          estimated_elevation_gain_m: number | null
          estimated_moving_time: string | null
          heart_rate_zones: string | null
          id: string
          mileage_breakdown: string | null
          notes: string | null
          pace_targets: string | null
          purpose: string | null
          recovery_training: string | null
          session_load: string | null
          training_plan_id: string
          training_session: string
          updated_at: string
          user_id: string
          what_to_eat_drink: string | null
        }
        Insert: {
          additional_training?: string | null
          created_at?: string
          daily_nutrition_advice?: string | null
          date: string
          detailed_fields_generated?: boolean | null
          estimated_avg_pace_min_per_km?: string | null
          estimated_avg_power_w?: number | null
          estimated_cadence_spm?: number | null
          estimated_calories?: number | null
          estimated_distance_km?: number | null
          estimated_elevation_gain_m?: number | null
          estimated_moving_time?: string | null
          heart_rate_zones?: string | null
          id?: string
          mileage_breakdown?: string | null
          notes?: string | null
          pace_targets?: string | null
          purpose?: string | null
          recovery_training?: string | null
          session_load?: string | null
          training_plan_id: string
          training_session: string
          updated_at?: string
          user_id: string
          what_to_eat_drink?: string | null
        }
        Update: {
          additional_training?: string | null
          created_at?: string
          daily_nutrition_advice?: string | null
          date?: string
          detailed_fields_generated?: boolean | null
          estimated_avg_pace_min_per_km?: string | null
          estimated_avg_power_w?: number | null
          estimated_cadence_spm?: number | null
          estimated_calories?: number | null
          estimated_distance_km?: number | null
          estimated_elevation_gain_m?: number | null
          estimated_moving_time?: string | null
          heart_rate_zones?: string | null
          id?: string
          mileage_breakdown?: string | null
          notes?: string | null
          pace_targets?: string | null
          purpose?: string | null
          recovery_training?: string | null
          session_load?: string | null
          training_plan_id?: string
          training_session?: string
          updated_at?: string
          user_id?: string
          what_to_eat_drink?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_days_training_plan_id_fkey"
            columns: ["training_plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          created_at: string
          end_date: string
          generated_at: string
          id: string
          plan_content: Json
          profile_id: string
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          generated_at?: string
          id?: string
          plan_content: Json
          profile_id: string
          start_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          generated_at?: string
          id?: string
          plan_content?: Json
          profile_id?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
