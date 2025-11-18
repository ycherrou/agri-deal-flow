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
      bids_marche_secondaire: {
        Row: {
          client_id: string
          commentaire: string | null
          created_at: string | null
          id: string
          prix_propose: number
          revente_id: string
          statut: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          commentaire?: string | null
          created_at?: string | null
          id?: string
          prix_propose: number
          revente_id: string
          statut?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          commentaire?: string | null
          created_at?: string | null
          id?: string
          prix_propose?: number
          revente_id?: string
          statut?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_marche_secondaire_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_marche_secondaire_revente_id_fkey"
            columns: ["revente_id"]
            isOneToOne: false
            referencedRelation: "reventes_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          adresse: string | null
          code_postal: string | null
          created_at: string | null
          email: string | null
          id: string
          nom: string
          pays: string | null
          role: Database["public"]["Enums"]["user_role"]
          telephone: string | null
          updated_at: string | null
          user_id: string
          ville: string | null
        }
        Insert: {
          adresse?: string | null
          code_postal?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nom: string
          pays?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          telephone?: string | null
          updated_at?: string | null
          user_id: string
          ville?: string | null
        }
        Update: {
          adresse?: string | null
          code_postal?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nom?: string
          pays?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          telephone?: string | null
          updated_at?: string | null
          user_id?: string
          ville?: string | null
        }
        Relationships: []
      }
      couvertures: {
        Row: {
          created_at: string | null
          date_couverture: string
          id: string
          nombre_contrats: number | null
          prix_futures: number
          updated_at: string | null
          vente_id: string
          volume_couvert: number
        }
        Insert: {
          created_at?: string | null
          date_couverture?: string
          id?: string
          nombre_contrats?: number | null
          prix_futures: number
          updated_at?: string | null
          vente_id: string
          volume_couvert: number
        }
        Update: {
          created_at?: string | null
          date_couverture?: string
          id?: string
          nombre_contrats?: number | null
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
      couvertures_achat: {
        Row: {
          created_at: string | null
          date_couverture: string
          echeance_id: string | null
          id: string
          navire_id: string
          nombre_contrats: number
          prix_futures: number
          updated_at: string | null
          volume_couvert: number | null
        }
        Insert: {
          created_at?: string | null
          date_couverture?: string
          echeance_id?: string | null
          id?: string
          navire_id: string
          nombre_contrats: number
          prix_futures: number
          updated_at?: string | null
          volume_couvert?: number | null
        }
        Update: {
          created_at?: string | null
          date_couverture?: string
          echeance_id?: string | null
          id?: string
          navire_id?: string
          nombre_contrats?: number
          prix_futures?: number
          updated_at?: string | null
          volume_couvert?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "couvertures_achat_echeance_id_fkey"
            columns: ["echeance_id"]
            isOneToOne: false
            referencedRelation: "echeances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couvertures_achat_navire_id_fkey"
            columns: ["navire_id"]
            isOneToOne: false
            referencedRelation: "navires"
            referencedColumns: ["id"]
          },
        ]
      }
      echeances: {
        Row: {
          actif: boolean | null
          created_at: string | null
          date_echeance: string
          id: string
          nom: string
          produit: Database["public"]["Enums"]["product_type"]
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          date_echeance: string
          id?: string
          nom: string
          produit: Database["public"]["Enums"]["product_type"]
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          date_echeance?: string
          id?: string
          nom?: string
          produit?: Database["public"]["Enums"]["product_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      factures: {
        Row: {
          client_id: string
          conditions_paiement: string | null
          created_at: string | null
          date_echeance: string
          date_facture: string
          devise: string | null
          id: string
          montant_total: number
          notes: string | null
          numero_facture: string
          statut: string | null
          taux_change: number | null
          transaction_secondaire_id: string | null
          type_facture: string
          updated_at: string | null
          vente_id: string | null
        }
        Insert: {
          client_id: string
          conditions_paiement?: string | null
          created_at?: string | null
          date_echeance: string
          date_facture?: string
          devise?: string | null
          id?: string
          montant_total: number
          notes?: string | null
          numero_facture: string
          statut?: string | null
          taux_change?: number | null
          transaction_secondaire_id?: string | null
          type_facture: string
          updated_at?: string | null
          vente_id?: string | null
        }
        Update: {
          client_id?: string
          conditions_paiement?: string | null
          created_at?: string | null
          date_echeance?: string
          date_facture?: string
          devise?: string | null
          id?: string
          montant_total?: number
          notes?: string | null
          numero_facture?: string
          statut?: string | null
          taux_change?: number | null
          transaction_secondaire_id?: string | null
          type_facture?: string
          updated_at?: string | null
          vente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_transaction_secondaire_id_fkey"
            columns: ["transaction_secondaire_id"]
            isOneToOne: false
            referencedRelation: "transactions_marche_secondaire"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      lignes_bancaires: {
        Row: {
          actif: boolean | null
          banque: string
          created_at: string | null
          date_debut: string
          date_fin: string | null
          id: string
          montant_autorise: number
          montant_utilise: number | null
          notes: string | null
          taux_interet: number | null
          type_ligne: string
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          banque: string
          created_at?: string | null
          date_debut: string
          date_fin?: string | null
          id?: string
          montant_autorise: number
          montant_utilise?: number | null
          notes?: string | null
          taux_interet?: number | null
          type_ligne: string
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          banque?: string
          created_at?: string | null
          date_debut?: string
          date_fin?: string | null
          id?: string
          montant_autorise?: number
          montant_utilise?: number | null
          notes?: string | null
          taux_interet?: number | null
          type_ligne?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lignes_facture: {
        Row: {
          created_at: string | null
          description: string
          facture_id: string
          id: string
          montant_ligne: number
          ordre: number | null
          prix_unitaire: number
          quantite: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          facture_id: string
          id?: string
          montant_ligne: number
          ordre?: number | null
          prix_unitaire: number
          quantite: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          facture_id?: string
          id?: string
          montant_ligne?: number
          ordre?: number | null
          prix_unitaire?: number
          quantite?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lignes_facture_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      mouvements_bancaires: {
        Row: {
          created_at: string | null
          date_mouvement: string
          description: string | null
          id: string
          ligne_bancaire_id: string
          montant: number
          reference: string | null
          type_mouvement: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_mouvement?: string
          description?: string | null
          id?: string
          ligne_bancaire_id: string
          montant: number
          reference?: string | null
          type_mouvement: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_mouvement?: string
          description?: string | null
          id?: string
          ligne_bancaire_id?: string
          montant?: number
          reference?: string | null
          type_mouvement?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mouvements_bancaires_ligne_bancaire_id_fkey"
            columns: ["ligne_bancaire_id"]
            isOneToOne: false
            referencedRelation: "lignes_bancaires"
            referencedColumns: ["id"]
          },
        ]
      }
      navires: {
        Row: {
          created_at: string | null
          date_arrivee: string
          date_debut_planche: string | null
          date_fin_planche: string | null
          echeance_id: string | null
          est_roll: boolean | null
          fournisseur: string
          id: string
          navire_parent_id: string | null
          nom: string
          prime_achat: number | null
          prix_achat_flat: number | null
          produit: Database["public"]["Enums"]["product_type"]
          quantite_totale: number
          reference_cbot: string | null
          taux_fret: number | null
          terme_commercial: string | null
          updated_at: string | null
          volume_dispo_achat: number | null
        }
        Insert: {
          created_at?: string | null
          date_arrivee: string
          date_debut_planche?: string | null
          date_fin_planche?: string | null
          echeance_id?: string | null
          est_roll?: boolean | null
          fournisseur: string
          id?: string
          navire_parent_id?: string | null
          nom: string
          prime_achat?: number | null
          prix_achat_flat?: number | null
          produit: Database["public"]["Enums"]["product_type"]
          quantite_totale: number
          reference_cbot?: string | null
          taux_fret?: number | null
          terme_commercial?: string | null
          updated_at?: string | null
          volume_dispo_achat?: number | null
        }
        Update: {
          created_at?: string | null
          date_arrivee?: string
          date_debut_planche?: string | null
          date_fin_planche?: string | null
          echeance_id?: string | null
          est_roll?: boolean | null
          fournisseur?: string
          id?: string
          navire_parent_id?: string | null
          nom?: string
          prime_achat?: number | null
          prix_achat_flat?: number | null
          produit?: Database["public"]["Enums"]["product_type"]
          quantite_totale?: number
          reference_cbot?: string | null
          taux_fret?: number | null
          terme_commercial?: string | null
          updated_at?: string | null
          volume_dispo_achat?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "navires_echeance_id_fkey"
            columns: ["echeance_id"]
            isOneToOne: false
            referencedRelation: "echeances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "navires_navire_parent_id_fkey"
            columns: ["navire_parent_id"]
            isOneToOne: false
            referencedRelation: "navires"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_history: {
        Row: {
          client_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message_content: string
          phone_number: string
          sent_at: string | null
          status: string
          template_name: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_content: string
          phone_number: string
          sent_at?: string | null
          status: string
          template_name: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string
          phone_number?: string
          sent_at?: string | null
          status?: string
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements_factures: {
        Row: {
          created_at: string | null
          date_paiement: string
          facture_id: string
          id: string
          mode_paiement: string | null
          montant: number
          notes: string | null
          reference_paiement: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_paiement?: string
          facture_id: string
          id?: string
          mode_paiement?: string | null
          montant: number
          notes?: string | null
          reference_paiement?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_paiement?: string
          facture_id?: string
          id?: string
          mode_paiement?: string | null
          montant?: number
          notes?: string | null
          reference_paiement?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_factures_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      prix_marche: {
        Row: {
          created_at: string | null
          date_maj: string
          echeance_id: string
          id: string
          prix: number
        }
        Insert: {
          created_at?: string | null
          date_maj?: string
          echeance_id: string
          id?: string
          prix: number
        }
        Update: {
          created_at?: string | null
          date_maj?: string
          echeance_id?: string
          id?: string
          prix?: number
        }
        Relationships: [
          {
            foreignKeyName: "prix_marche_echeance_id_fkey"
            columns: ["echeance_id"]
            isOneToOne: false
            referencedRelation: "echeances"
            referencedColumns: ["id"]
          },
        ]
      }
      reventes_clients: {
        Row: {
          commentaire: string | null
          created_at: string | null
          date_expiration_validation: string | null
          date_revente: string
          etat: Database["public"]["Enums"]["revente_status"]
          id: string
          prime_demandee: number | null
          prix_flat_demande: number
          type_position: string | null
          updated_at: string | null
          validated_by_admin: boolean | null
          vente_id: string
          volume: number
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          date_expiration_validation?: string | null
          date_revente?: string
          etat?: Database["public"]["Enums"]["revente_status"]
          id?: string
          prime_demandee?: number | null
          prix_flat_demande: number
          type_position?: string | null
          updated_at?: string | null
          validated_by_admin?: boolean | null
          vente_id: string
          volume: number
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          date_expiration_validation?: string | null
          date_revente?: string
          etat?: Database["public"]["Enums"]["revente_status"]
          id?: string
          prime_demandee?: number | null
          prix_flat_demande?: number
          type_position?: string | null
          updated_at?: string | null
          validated_by_admin?: boolean | null
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
      transactions_marche_secondaire: {
        Row: {
          acheteur_id: string
          commission: number | null
          created_at: string | null
          date_transaction: string | null
          gain_vendeur: number | null
          id: string
          notes: string | null
          prix_achat_original: number | null
          prix_transaction: number
          prix_vente_final: number | null
          revente_id: string
          statut: string | null
          updated_at: string | null
          vendeur_id: string
          volume: number
          volume_transige: number | null
        }
        Insert: {
          acheteur_id: string
          commission?: number | null
          created_at?: string | null
          date_transaction?: string | null
          gain_vendeur?: number | null
          id?: string
          notes?: string | null
          prix_achat_original?: number | null
          prix_transaction: number
          prix_vente_final?: number | null
          revente_id: string
          statut?: string | null
          updated_at?: string | null
          vendeur_id: string
          volume: number
          volume_transige?: number | null
        }
        Update: {
          acheteur_id?: string
          commission?: number | null
          created_at?: string | null
          date_transaction?: string | null
          gain_vendeur?: number | null
          id?: string
          notes?: string | null
          prix_achat_original?: number | null
          prix_transaction?: number
          prix_vente_final?: number | null
          revente_id?: string
          statut?: string | null
          updated_at?: string | null
          vendeur_id?: string
          volume?: number
          volume_transige?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_marche_secondaire_acheteur_id_fkey"
            columns: ["acheteur_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_marche_secondaire_revente_id_fkey"
            columns: ["revente_id"]
            isOneToOne: false
            referencedRelation: "reventes_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_marche_secondaire_vendeur_id_fkey"
            columns: ["vendeur_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ventes: {
        Row: {
          client_id: string
          created_at: string | null
          date_deal: string
          echeance_id: string | null
          est_roll: boolean | null
          id: string
          navire_id: string
          parent_deal_id: string | null
          prime_vente: number | null
          prix_flat: number | null
          prix_reference: string | null
          type_deal: Database["public"]["Enums"]["deal_type"]
          updated_at: string | null
          vente_parent_id: string | null
          volume: number
        }
        Insert: {
          client_id: string
          created_at?: string | null
          date_deal?: string
          echeance_id?: string | null
          est_roll?: boolean | null
          id?: string
          navire_id: string
          parent_deal_id?: string | null
          prime_vente?: number | null
          prix_flat?: number | null
          prix_reference?: string | null
          type_deal: Database["public"]["Enums"]["deal_type"]
          updated_at?: string | null
          vente_parent_id?: string | null
          volume: number
        }
        Update: {
          client_id?: string
          created_at?: string | null
          date_deal?: string
          echeance_id?: string | null
          est_roll?: boolean | null
          id?: string
          navire_id?: string
          parent_deal_id?: string | null
          prime_vente?: number | null
          prix_flat?: number | null
          prix_reference?: string | null
          type_deal?: Database["public"]["Enums"]["deal_type"]
          updated_at?: string | null
          vente_parent_id?: string | null
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
            foreignKeyName: "ventes_echeance_id_fkey"
            columns: ["echeance_id"]
            isOneToOne: false
            referencedRelation: "echeances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_navire_id_fkey"
            columns: ["navire_id"]
            isOneToOne: false
            referencedRelation: "navires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_parent_deal_id_fkey"
            columns: ["parent_deal_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_vente_parent_id_fkey"
            columns: ["vente_parent_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          actif: boolean | null
          content: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          content: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          content?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_bid_and_create_transaction: {
        Args: { p_bid_id: string; p_commission?: number }
        Returns: string
      }
      allouer_financement: {
        Args: {
          p_ligne_bancaire_id: string
          p_montant: number
          p_type_financement: string
        }
        Returns: string
      }
      calculate_pru_facture: { Args: { p_facture_id: string }; Returns: number }
      generer_numero_facture: { Args: never; Returns: string }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_validated_secondary_market: {
        Args: never
        Returns: {
          bids_marche_secondaire: Json
          commentaire: string
          created_at: string
          date_expiration_validation: string
          date_revente: string
          etat: Database["public"]["Enums"]["revente_status"]
          id: string
          prix_flat_demande: number
          updated_at: string
          vente_id: string
          volume: number
        }[]
      }
      traiter_paiement_facture: {
        Args: { p_paiement_id: string }
        Returns: undefined
      }
    }
    Enums: {
      deal_type: "prime" | "flat"
      product_type: "mais" | "tourteau_soja" | "ble" | "orge"
      revente_status:
        | "en_attente_validation"
        | "valide"
        | "en_attente"
        | "vendu"
        | "retire"
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
      revente_status: [
        "en_attente_validation",
        "valide",
        "en_attente",
        "vendu",
        "retire",
      ],
      user_role: ["admin", "client"],
    },
  },
} as const
