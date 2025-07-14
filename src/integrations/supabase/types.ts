export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nom: string
          role: Database["public"]["Enums"]["user_role"]
          telephone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          nom: string
          role?: Database["public"]["Enums"]["user_role"]
          telephone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nom?: string
          role?: Database["public"]["Enums"]["user_role"]
          telephone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      couvertures: {
        Row: {
          created_at: string | null
          date_couverture: string
          id: string
          prix_futures: number
          updated_at: string | null
          vente_id: string
          volume_couvert: number
        }
        Insert: {
          created_at?: string | null
          date_couverture?: string
          id?: string
          prix_futures: number
          updated_at?: string | null
          vente_id: string
          volume_couvert: number
        }
        Update: {
          created_at?: string | null
          date_couverture?: string
          id?: string
          prix_futures?: number
          updated_at?: string | null
          vente_id?: string
          volume_couvert?: number
        }
        Relationships: [
          {
            foreignKeyName: "couvertures_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      navires: {
        Row: {
          created_at: string | null
          date_arrivee: string
          fournisseur: string
          id: string
          nom: string
          prime_achat: number | null
          produit: Database["public"]["Enums"]["product_type"]
          quantite_totale: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_arrivee: string
          fournisseur: string
          id?: string
          nom: string
          prime_achat?: number | null
          produit: Database["public"]["Enums"]["product_type"]
          quantite_totale: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_arrivee?: string
          fournisseur?: string
          id?: string
          nom?: string
          prime_achat?: number | null
          produit?: Database["public"]["Enums"]["product_type"]
          quantite_totale?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      prix_marche: {
        Row: {
          created_at: string | null
          date_maj: string
          echeance: string
          id: string
          prix: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_maj?: string
          echeance: string
          id?: string
          prix: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_maj?: string
          echeance?: string
          id?: string
          prix?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      reventes_clients: {
        Row: {
          commentaire: string | null
          created_at: string | null
          date_revente: string
          etat: Database["public"]["Enums"]["revente_status"]
          id: string
          prix_flat_demande: number
          updated_at: string | null
          vente_id: string
          volume: number
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          date_revente?: string
          etat?: Database["public"]["Enums"]["revente_status"]
          id?: string
          prix_flat_demande: number
          updated_at?: string | null
          vente_id: string
          volume: number
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          date_revente?: string
          etat?: Database["public"]["Enums"]["revente_status"]
          id?: string
          prix_flat_demande?: number
          updated_at?: string | null
          vente_id?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "reventes_clients_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      ventes: {
        Row: {
          client_id: string
          created_at: string | null
          date_deal: string
          id: string
          navire_id: string
          prime_vente: number | null
          prix_flat: number | null
          prix_reference: string | null
          type_deal: Database["public"]["Enums"]["deal_type"]
          updated_at: string | null
          volume: number
        }
        Insert: {
          client_id: string
          created_at?: string | null
          date_deal?: string
          id?: string
          navire_id: string
          prime_vente?: number | null
          prix_flat?: number | null
          prix_reference?: string | null
          type_deal: Database["public"]["Enums"]["deal_type"]
          updated_at?: string | null
          volume: number
        }
        Update: {
          client_id?: string
          created_at?: string | null
          date_deal?: string
          id?: string
          navire_id?: string
          prime_vente?: number | null
          prix_flat?: number | null
          prix_reference?: string | null
          type_deal?: Database["public"]["Enums"]["deal_type"]
          updated_at?: string | null
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "ventes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_navire_id_fkey"
            columns: ["navire_id"]
            isOneToOne: false
            referencedRelation: "navires"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      deal_type: "prime" | "flat"
      product_type: "mais" | "tourteau_soja" | "ble" | "orge"
      revente_status: "en_attente" | "vendu" | "retire"
      user_role: "admin" | "client"
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
      deal_type: ["prime", "flat"],
      product_type: ["mais", "tourteau_soja", "ble", "orge"],
      revente_status: ["en_attente", "vendu", "retire"],
      user_role: ["admin", "client"],
    },
  },
} as const
