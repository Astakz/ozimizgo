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
      case_responses: {
        Row: {
          case_id: string
          created_at: string
          id: string
          lawyer_id: string
          message: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          lawyer_id: string
          message: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          lawyer_id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_responses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          attachments: Json | null
          case_type: string
          client_id: string
          created_at: string
          description: string
          id: string
          status: string
          title: string
        }
        Insert: {
          attachments?: Json | null
          case_type?: string
          client_id: string
          created_at?: string
          description: string
          id?: string
          status?: string
          title: string
        }
        Update: {
          attachments?: Json | null
          case_type?: string
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          extracted_data: Json | null
          extracted_text: string
          file_type: string
          generated_objection: string
          id: string
          original_filename: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_data?: Json | null
          extracted_text: string
          file_type: string
          generated_objection: string
          id?: string
          original_filename: string
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_data?: Json | null
          extracted_text?: string
          file_type?: string
          generated_objection?: string
          id?: string
          original_filename?: string
          user_id?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_used: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      lawyer_action_logs: {
        Row: {
          action_type: string
          case_id: string
          id: string
          lawyer_id: string
          performed_at: string
        }
        Insert: {
          action_type: string
          case_id: string
          id?: string
          lawyer_id: string
          performed_at?: string
        }
        Update: {
          action_type?: string
          case_id?: string
          id?: string
          lawyer_id?: string
          performed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lawyer_action_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyer_case_permissions: {
        Row: {
          case_id: string
          granted_at: string
          granted_by: string
          id: string
          lawyer_id: string
          permission_type: string
        }
        Insert: {
          case_id: string
          granted_at?: string
          granted_by: string
          id?: string
          lawyer_id: string
          permission_type: string
        }
        Update: {
          case_id?: string
          granted_at?: string
          granted_by?: string
          id?: string
          lawyer_id?: string
          permission_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lawyer_case_permissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          created_at: string
          id: string
          is_read: boolean
          message_text: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          id?: string
          is_read?: boolean
          message_text: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          id?: string
          is_read?: boolean
          message_text?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          experience: string | null
          full_name: string | null
          id: string
          invite_code: string | null
          name: string
          nickname: string | null
          profession: string | null
          specialization: string[] | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          experience?: string | null
          full_name?: string | null
          id?: string
          invite_code?: string | null
          name: string
          nickname?: string | null
          profession?: string | null
          specialization?: string[] | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          experience?: string | null
          full_name?: string | null
          id?: string
          invite_code?: string | null
          name?: string
          nickname?: string | null
          profession?: string | null
          specialization?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          client_id: string
          comment: string | null
          created_at: string
          id: string
          lawyer_id: string
          rating: number
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          lawyer_id: string
          rating?: number
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          lawyer_id?: string
          rating?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_lawyer_perform_action: {
        Args: { _action_type: string; _case_id: string; _lawyer_id: string }
        Returns: boolean
      }
      generate_unique_username: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_nickname_unique: {
        Args: { check_nickname: string; exclude_user_id?: string }
        Returns: boolean
      }
      use_invite_code: {
        Args: { invite_code_value: string; used_by_user_id: string }
        Returns: undefined
      }
      validate_invite_code: {
        Args: { invite_code_value: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "lawyer"
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
      app_role: ["admin", "user", "lawyer"],
    },
  },
} as const
