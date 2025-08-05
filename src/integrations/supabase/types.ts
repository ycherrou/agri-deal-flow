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
      bids_marche_secondaire: {
        Row: {
          accepted_at: string | null
          accepted_by_seller: boolean | null
          client_id: string
          created_at: string
          date_bid: string
          id: string
          prix_bid: number
          revente_id: string
          statut: string
          updated_at: string
          volume_bid: number
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_seller?: boolean | null
          client_id: string
          created_at?: string
          date_bid?: string
          id?: string
          prix_bid: number
          revente_id: string
          statut?: string
          updated_at?: string
          volume_bid: number
        }
        Update: {
          accepted_at?: string | null
          accepted_by_seller?: boolean | null
          client_id?: string
          created_at?: string
          date_bid?: string
          id?: string
          prix_bid?: number
          revente_id?: string
          statut?: string
          updated_at?: string
          volume_bid?: number
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
          nombre_contrats: number
          prix_futures: number
          updated_at: string | null
          vente_id: string | null
          volume_couvert: number
        }
        Insert: {
          created_at?: string | null
          date_couverture?: string
          id?: string
          nombre_contrats?: number
          prix_futures: number
          updated_at?: string | null
          vente_id?: string | null
          volume_couvert: number
        }
        Update: {
          created_at?: string | null
          date_couverture?: string
          id?: string
          nombre_contrats?: number
          prix_futures?: number
          updated_at?: string | null
          vente_id?: string | null
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
          id: string
          navire_id: string
          nombre_contrats: number
          prix_futures: number
          updated_at: string | null
          volume_couvert: number
        }
        Insert: {
          created_at?: string | null
          date_couverture?: string
          id?: string
          navire_id: string
          nombre_contrats?: number
          prix_futures: number
          updated_at?: string | null
          volume_couvert: number
        }
        Update: {
          created_at?: string | null
          date_couverture?: string
          id?: string
          navire_id?: string
          nombre_contrats?: number
          prix_futures?: number
          updated_at?: string | null
          volume_couvert?: number
        }
        Relationships: [
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
          active: boolean
          created_at: string
          id: string
          nom: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          nom: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: []
      }
      factures: {
        Row: {
          client_id: string
          conditions_paiement: string | null
          created_at: string
          date_echeance: string | null
          date_facture: string
          devise: string
          id: string
          montant_total: number
          notes: string | null
          numero_facture: string
          reference: string | null
          statut: string
          taux_change: number | null
          type_facture: string
          updated_at: string
          vente_id: string | null
        }
        Insert: {
          client_id: string
          conditions_paiement?: string | null
          created_at?: string
          date_echeance?: string | null
          date_facture?: string
          devise?: string
          id?: string
          montant_total?: number
          notes?: string | null
          numero_facture: string
          reference?: string | null
          statut?: string
          taux_change?: number | null
          type_facture: string
          updated_at?: string
          vente_id?: string | null
        }
        Update: {
          client_id?: string
          conditions_paiement?: string | null
          created_at?: string
          date_echeance?: string | null
          date_facture?: string
          devise?: string
          id?: string
          montant_total?: number
          notes?: string | null
          numero_facture?: string
          reference?: string | null
          statut?: string
          taux_change?: number | null
          type_facture?: string
          updated_at?: string
          vente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factures_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      financements: {
        Row: {
          commentaire: string | null
          created_at: string
          date_financement: string
          id: string
          ligne_bancaire_id: string | null
          montant_finance: number
          statut: string
          updated_at: string
          vente_id: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          date_financement?: string
          id?: string
          ligne_bancaire_id?: string | null
          montant_finance: number
          statut?: string
          updated_at?: string
          vente_id: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          date_financement?: string
          id?: string
          ligne_bancaire_id?: string | null
          montant_finance?: number
          statut?: string
          updated_at?: string
          vente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_financements_ligne_bancaire"
            columns: ["ligne_bancaire_id"]
            isOneToOne: false
            referencedRelation: "lignes_bancaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_financements_vente"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      lignes_bancaires: {
        Row: {
          active: boolean
          banque: string
          created_at: string
          date_echeance: string | null
          date_ouverture: string | null
          id: string
          montant_disponible: number | null
          montant_total: number
          montant_utilise: number
          nom: string
          taux_interet: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          banque: string
          created_at?: string
          date_echeance?: string | null
          date_ouverture?: string | null
          id?: string
          montant_disponible?: number | null
          montant_total: number
          montant_utilise?: number
          nom: string
          taux_interet?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          banque?: string
          created_at?: string
          date_echeance?: string | null
          date_ouverture?: string | null
          id?: string
          montant_disponible?: number | null
          montant_total?: number
          montant_utilise?: number
          nom?: string
          taux_interet?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      lignes_facture: {
        Row: {
          created_at: string
          description: string
          facture_id: string
          id: string
          montant_ligne: number
          prix_unitaire: number
          quantite: number
        }
        Insert: {
          created_at?: string
          description: string
          facture_id: string
          id?: string
          montant_ligne: number
          prix_unitaire: number
          quantite: number
        }
        Update: {
          created_at?: string
          description?: string
          facture_id?: string
          id?: string
          montant_ligne?: number
          prix_unitaire?: number
          quantite?: number
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
          created_at: string
          date_mouvement: string
          description: string | null
          financement_id: string | null
          id: string
          ligne_bancaire_id: string
          montant: number
          montant_apres: number
          montant_avant: number
          reference: string | null
          type_mouvement: string
        }
        Insert: {
          created_at?: string
          date_mouvement?: string
          description?: string | null
          financement_id?: string | null
          id?: string
          ligne_bancaire_id: string
          montant: number
          montant_apres: number
          montant_avant: number
          reference?: string | null
          type_mouvement: string
        }
        Update: {
          created_at?: string
          date_mouvement?: string
          description?: string | null
          financement_id?: string | null
          id?: string
          ligne_bancaire_id?: string
          montant?: number
          montant_apres?: number
          montant_avant?: number
          reference?: string | null
          type_mouvement?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_mouvements_financement"
            columns: ["financement_id"]
            isOneToOne: false
            referencedRelation: "financements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_mouvements_ligne_bancaire"
            columns: ["ligne_bancaire_id"]
            isOneToOne: false
            referencedRelation: "lignes_bancaires"
            referencedColumns: ["id"]
          },
        ]
      }
      navires: {
        Row: {
          connaissement: string | null
          created_at: string | null
          date_arrivee: string
          date_connaissement: string | null
          fournisseur: string
          id: string
          nom: string
          origine: string | null
          parent_navire_id: string | null
          port_chargement: string | null
          port_dechargement: string | null
          prime_achat: number | null
          prix_achat_flat: number | null
          produit: Database["public"]["Enums"]["product_type"]
          quantite_totale: number
          reference_cbot: string | null
          taux_fret: number | null
          terme_commercial: string
          updated_at: string | null
        }
        Insert: {
          connaissement?: string | null
          created_at?: string | null
          date_arrivee: string
          date_connaissement?: string | null
          fournisseur: string
          id?: string
          nom: string
          origine?: string | null
          parent_navire_id?: string | null
          port_chargement?: string | null
          port_dechargement?: string | null
          prime_achat?: number | null
          prix_achat_flat?: number | null
          produit: Database["public"]["Enums"]["product_type"]
          quantite_totale: number
          reference_cbot?: string | null
          taux_fret?: number | null
          terme_commercial?: string
          updated_at?: string | null
        }
        Update: {
          connaissement?: string | null
          created_at?: string | null
          date_arrivee?: string
          date_connaissement?: string | null
          fournisseur?: string
          id?: string
          nom?: string
          origine?: string | null
          parent_navire_id?: string | null
          port_chargement?: string | null
          port_dechargement?: string | null
          prime_achat?: number | null
          prix_achat_flat?: number | null
          produit?: Database["public"]["Enums"]["product_type"]
          quantite_totale?: number
          reference_cbot?: string | null
          taux_fret?: number | null
          terme_commercial?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "navires_parent_navire_id_fkey"
            columns: ["parent_navire_id"]
            isOneToOne: false
            referencedRelation: "navires"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          client_id: string
          created_at: string
          enabled: boolean
          event_type: string
          id: string
          produit_filter: string[] | null
          updated_at: string
          volume_max: number | null
          volume_min: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
          produit_filter?: string[] | null
          updated_at?: string
          volume_max?: number | null
          volume_min?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
          produit_filter?: string[] | null
          updated_at?: string
          volume_max?: number | null
          volume_min?: number | null
        }
        Relationships: []
      }
      notifications_history: {
        Row: {
          client_id: string
          created_at: string
          error_message: string | null
          id: string
          message_content: string
          message_type: string
          phone_number: string
          sent_at: string | null
          status: string
          twilio_sid: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_content: string
          message_type: string
          phone_number: string
          sent_at?: string | null
          status?: string
          twilio_sid?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_content?: string
          message_type?: string
          phone_number?: string
          sent_at?: string | null
          status?: string
          twilio_sid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      paiements_factures: {
        Row: {
          created_at: string
          date_paiement: string
          facture_id: string
          finance_update_processed: boolean
          id: string
          methode_paiement: string
          montant_paye: number
          notes: string | null
          reference_paiement: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_paiement: string
          facture_id: string
          finance_update_processed?: boolean
          id?: string
          methode_paiement: string
          montant_paye: number
          notes?: string | null
          reference_paiement?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_paiement?: string
          facture_id?: string
          finance_update_processed?: boolean
          id?: string
          methode_paiement?: string
          montant_paye?: number
          notes?: string | null
          reference_paiement?: string | null
          updated_at?: string
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
          echeance_id: string | null
          id: string
          prix: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          echeance_id?: string | null
          id?: string
          prix: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          echeance_id?: string | null
          id?: string
          prix?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_prix_marche_echeance"
            columns: ["echeance_id"]
            isOneToOne: false
            referencedRelation: "echeances"
            referencedColumns: ["id"]
          },
        ]
      }
      references_factures: {
        Row: {
          annee: number
          created_at: string | null
          dernier_numero: number | null
          id: string
          updated_at: string | null
        }
        Insert: {
          annee: number
          created_at?: string | null
          dernier_numero?: number | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          annee?: number
          created_at?: string | null
          dernier_numero?: number | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reventes_clients: {
        Row: {
          admin_id: string | null
          admin_validation_date: string | null
          commentaire: string | null
          created_at: string | null
          date_expiration_validation: string | null
          date_revente: string
          etat: Database["public"]["Enums"]["revente_status"]
          id: string
          prime_demandee: number | null
          prix_flat_demande: number | null
          type_position: string
          updated_at: string | null
          validated_by_admin: boolean | null
          vente_id: string
          volume: number
        }
        Insert: {
          admin_id?: string | null
          admin_validation_date?: string | null
          commentaire?: string | null
          created_at?: string | null
          date_expiration_validation?: string | null
          date_revente?: string
          etat?: Database["public"]["Enums"]["revente_status"]
          id?: string
          prime_demandee?: number | null
          prix_flat_demande?: number | null
          type_position?: string
          updated_at?: string | null
          validated_by_admin?: boolean | null
          vente_id: string
          volume: number
        }
        Update: {
          admin_id?: string | null
          admin_validation_date?: string | null
          commentaire?: string | null
          created_at?: string | null
          date_expiration_validation?: string | null
          date_revente?: string
          etat?: Database["public"]["Enums"]["revente_status"]
          id?: string
          prime_demandee?: number | null
          prix_flat_demande?: number | null
          type_position?: string
          updated_at?: string | null
          validated_by_admin?: boolean | null
          vente_id?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "reventes_clients_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reventes_clients_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences_factures: {
        Row: {
          annee: number
          created_at: string
          dernier_numero: number
          id: string
          type_facture: string
          updated_at: string
        }
        Insert: {
          annee: number
          created_at?: string
          dernier_numero?: number
          id?: string
          type_facture: string
          updated_at?: string
        }
        Update: {
          annee?: number
          created_at?: string
          dernier_numero?: number
          id?: string
          type_facture?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions_marche_secondaire: {
        Row: {
          acheteur_id: string
          admin_paiement_id: string | null
          bid_id: string
          commission_admin: number | null
          created_at: string
          date_paiement_pnl: string | null
          date_transaction: string
          gain_vendeur: number
          id: string
          pnl_paye: boolean
          prix_achat_original: number
          prix_vente_final: number
          revente_id: string
          statut: string
          updated_at: string
          vendeur_id: string
          volume_transige: number
        }
        Insert: {
          acheteur_id: string
          admin_paiement_id?: string | null
          bid_id: string
          commission_admin?: number | null
          created_at?: string
          date_paiement_pnl?: string | null
          date_transaction?: string
          gain_vendeur: number
          id?: string
          pnl_paye?: boolean
          prix_achat_original: number
          prix_vente_final: number
          revente_id: string
          statut?: string
          updated_at?: string
          vendeur_id: string
          volume_transige: number
        }
        Update: {
          acheteur_id?: string
          admin_paiement_id?: string | null
          bid_id?: string
          commission_admin?: number | null
          created_at?: string
          date_paiement_pnl?: string | null
          date_transaction?: string
          gain_vendeur?: number
          id?: string
          pnl_paye?: boolean
          prix_achat_original?: number
          prix_vente_final?: number
          revente_id?: string
          statut?: string
          updated_at?: string
          vendeur_id?: string
          volume_transige?: number
        }
        Relationships: []
      }
      ventes: {
        Row: {
          client_id: string
          created_at: string | null
          date_deal: string
          id: string
          navire_id: string
          parent_deal_id: string | null
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
          parent_deal_id?: string | null
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
          parent_deal_id?: string | null
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
          {
            foreignKeyName: "ventes_parent_deal_id_fkey"
            columns: ["parent_deal_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          active: boolean
          created_at: string
          event_type: string
          id: string
          message_template: string
          nom: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          event_type: string
          id?: string
          message_template: string
          nom: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          event_type?: string
          id?: string
          message_template?: string
          nom?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_bid_and_create_transaction: {
        Args: { bid_id_param: string; seller_client_id: string }
        Returns: string
      }
      accept_bid_and_create_transaction_with_notifications: {
        Args: { bid_id_param: string; seller_client_id: string }
        Returns: string
      }
      allouer_financement: {
        Args: {
          vente_id_param: string
          ligne_bancaire_id_param: string
          montant_param: number
          commentaire_param?: string
        }
        Returns: string
      }
      calculate_pru_facture: {
        Args: { vente_id_param: string }
        Returns: number
      }
      calculate_pru_vente: {
        Args: { vente_id_param: string }
        Returns: number
      }
      generer_numero_facture: {
        Args: { type_facture_param: string }
        Returns: string
      }
      generer_reference_facture: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_contract_size: {
        Args: { produit_type: string }
        Returns: number
      }
      is_client_visible_on_market: {
        Args: { client_id_param: string }
        Returns: boolean
      }
      liberer_financement: {
        Args: {
          financement_id_param: string
          montant_liberation_param?: number
        }
        Returns: undefined
      }
      traiter_paiement_facture: {
        Args: { paiement_id_param: string }
        Returns: undefined
      }
      update_existing_transactions_pru: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      deal_type: "prime" | "flat"
      product_type:
        | "mais"
        | "tourteau_soja"
        | "ble"
        | "orge"
        | "ddgs"
        | "ferrailles"
      revente_status:
        | "en_attente"
        | "vendu"
        | "retire"
        | "en_attente_validation"
        | "annulee"
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
      product_type: [
        "mais",
        "tourteau_soja",
        "ble",
        "orge",
        "ddgs",
        "ferrailles",
      ],
      revente_status: [
        "en_attente",
        "vendu",
        "retire",
        "en_attente_validation",
        "annulee",
      ],
      user_role: ["admin", "client"],
    },
  },
} as const
