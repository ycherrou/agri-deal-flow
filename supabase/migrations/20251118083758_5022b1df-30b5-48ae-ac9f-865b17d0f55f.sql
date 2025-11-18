-- Phase 3: Compléter les colonnes manquantes

-- 3.1 Ajouter les colonnes manquantes dans transactions_marche_secondaire
ALTER TABLE public.transactions_marche_secondaire 
  ADD COLUMN IF NOT EXISTS pnl_paye boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_paiement_pnl timestamp with time zone,
  ADD COLUMN IF NOT EXISTS commission_admin numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bid_id uuid,
  ADD COLUMN IF NOT EXISTS admin_paiement_id uuid;

-- 3.2 Ajouter les colonnes manquantes dans bids_marche_secondaire
ALTER TABLE public.bids_marche_secondaire
  ADD COLUMN IF NOT EXISTS accepted_by_seller boolean DEFAULT false;

-- 3.3 Modifier l'enum product_type pour inclure ddgs et ferrailles
ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'ddgs';
ALTER TYPE product_type ADD VALUE IF NOT EXISTS 'ferrailles';

-- 3.4 Créer une vue pour compatibilité navire_parent_id
CREATE OR REPLACE VIEW public.navires_with_aliases AS
SELECT 
  *,
  navire_parent_id as parent_navire_id
FROM public.navires;

-- 3.5 Ajouter colonnes manquantes dans whatsapp_templates si besoin
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS event_type text;