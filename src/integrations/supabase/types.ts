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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      certificates: {
        Row: {
          file_name: string
          holder_cnpj: string | null
          id: string
          password_ciphertext: string | null
          pfx_ciphertext: string | null
          status: string
          subject_name: string | null
          thumbprint: string | null
          uploaded_at: string
          user_id: string
          valid_from: string | null
          valid_until: string
        }
        Insert: {
          file_name: string
          holder_cnpj?: string | null
          id?: string
          password_ciphertext?: string | null
          pfx_ciphertext?: string | null
          status?: string
          subject_name?: string | null
          thumbprint?: string | null
          uploaded_at?: string
          user_id: string
          valid_from?: string | null
          valid_until: string
        }
        Update: {
          file_name?: string
          holder_cnpj?: string | null
          id?: string
          password_ciphertext?: string | null
          pfx_ciphertext?: string | null
          status?: string
          subject_name?: string | null
          thumbprint?: string | null
          uploaded_at?: string
          user_id?: string
          valid_from?: string | null
          valid_until?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          access_key: string
          created_at: string
          direction: string
          doc_type: string
          environment: string | null
          id: string
          issued_at: string
          issuer_cnpj: string
          issuer_name: string
          nsu: number | null
          number: string
          recipient_cnpj: string | null
          recipient_name: string
          schema_type: string | null
          series: string
          source: string
          status: string
          total_amount: number
          user_id: string
          xml_content: string
        }
        Insert: {
          access_key: string
          created_at?: string
          direction: string
          doc_type: string
          environment?: string | null
          id?: string
          issued_at: string
          issuer_cnpj: string
          issuer_name: string
          nsu?: number | null
          number: string
          recipient_cnpj?: string | null
          recipient_name: string
          schema_type?: string | null
          series: string
          source?: string
          status?: string
          total_amount?: number
          user_id: string
          xml_content: string
        }
        Update: {
          access_key?: string
          created_at?: string
          direction?: string
          doc_type?: string
          environment?: string | null
          id?: string
          issued_at?: string
          issuer_cnpj?: string
          issuer_name?: string
          nsu?: number | null
          number?: string
          recipient_cnpj?: string | null
          recipient_name?: string
          schema_type?: string | null
          series?: string
          source?: string
          status?: string
          total_amount?: number
          user_id?: string
          xml_content?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      sefaz_accounts: {
        Row: {
          blocked_until: string | null
          cnpj: string
          created_at: string
          environment: string
          last_status: string | null
          last_sync_at: string | null
          nfce_blocked_until: string | null
          nfce_last_status: string | null
          nfce_last_sync_at: string | null
          uf: string
          ult_nsu: number
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked_until?: string | null
          cnpj: string
          created_at?: string
          environment?: string
          last_status?: string | null
          last_sync_at?: string | null
          nfce_blocked_until?: string | null
          nfce_last_status?: string | null
          nfce_last_sync_at?: string | null
          uf?: string
          ult_nsu?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked_until?: string | null
          cnpj?: string
          created_at?: string
          environment?: string
          last_status?: string | null
          last_sync_at?: string | null
          nfce_blocked_until?: string | null
          nfce_last_status?: string | null
          nfce_last_sync_at?: string | null
          uf?: string
          ult_nsu?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "pending" | "approved" | "rejected"
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
      account_status: ["pending", "approved", "rejected"],
      app_role: ["admin", "user"],
    },
  },
} as const
