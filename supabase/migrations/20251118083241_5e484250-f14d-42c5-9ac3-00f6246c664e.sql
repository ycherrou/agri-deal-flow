-- Phase 1: Corrections de Structure des Tables

-- 1.1 Ajouter les colonnes manquantes à reventes_clients
ALTER TABLE public.reventes_clients 
  ADD COLUMN IF NOT EXISTS prime_demandee numeric,
  ADD COLUMN IF NOT EXISTS type_position text;

-- Ajouter contrainte sur type_position
ALTER TABLE public.reventes_clients 
  DROP CONSTRAINT IF EXISTS check_type_position;
ALTER TABLE public.reventes_clients 
  ADD CONSTRAINT check_type_position 
  CHECK (type_position IN ('couverte', 'non_couverte'));

-- 1.2 Renommer et ajouter colonnes dans bids_marche_secondaire
ALTER TABLE public.bids_marche_secondaire
  RENAME COLUMN prix_propose TO prix_bid;
  
ALTER TABLE public.bids_marche_secondaire
  ADD COLUMN IF NOT EXISTS volume_bid numeric,
  ADD COLUMN IF NOT EXISTS date_bid timestamp with time zone DEFAULT now();

-- 1.3 Corriger paiements_factures
ALTER TABLE public.paiements_factures
  RENAME COLUMN montant TO montant_paye;
  
ALTER TABLE public.paiements_factures
  RENAME COLUMN mode_paiement TO methode_paiement;

-- Phase 2: Correction des Fonctions SQL

-- 2.1 Recréer allouer_financement avec les bons noms de paramètres
DROP FUNCTION IF EXISTS public.allouer_financement(uuid, numeric, text);

CREATE OR REPLACE FUNCTION public.allouer_financement(
  p_ligne_bancaire_id uuid,
  p_montant numeric,
  p_type_financement text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_mouvement_id UUID;
BEGIN
    INSERT INTO public.mouvements_bancaires (
        ligne_bancaire_id,
        type_mouvement,
        montant,
        description
    ) VALUES (
        p_ligne_bancaire_id,
        'utilisation',
        p_montant,
        'Allocation financement: ' || p_type_financement
    ) RETURNING id INTO v_mouvement_id;
    
    UPDATE public.lignes_bancaires
    SET montant_utilise = montant_utilise + p_montant,
        updated_at = now()
    WHERE id = p_ligne_bancaire_id;
    
    RETURN v_mouvement_id;
END;
$$;

-- 2.2 Recréer traiter_paiement_facture avec les bons noms de paramètres  
DROP FUNCTION IF EXISTS public.traiter_paiement_facture(uuid);

CREATE OR REPLACE FUNCTION public.traiter_paiement_facture(
  p_paiement_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_facture_id UUID;
    v_total_paye DECIMAL(10,2);
    v_montant_facture DECIMAL(10,2);
    v_nouveau_statut TEXT;
BEGIN
    SELECT facture_id INTO v_facture_id
    FROM public.paiements_factures
    WHERE id = p_paiement_id;
    
    SELECT montant_total INTO v_montant_facture
    FROM public.factures
    WHERE id = v_facture_id;
    
    SELECT COALESCE(SUM(montant_paye), 0) INTO v_total_paye
    FROM public.paiements_factures
    WHERE facture_id = v_facture_id;
    
    IF v_total_paye >= v_montant_facture THEN
        v_nouveau_statut := 'payee';
    ELSIF v_total_paye > 0 THEN
        v_nouveau_statut := 'partiellement_payee';
    ELSE
        v_nouveau_statut := 'impayee';
    END IF;
    
    UPDATE public.factures
    SET statut = v_nouveau_statut,
        updated_at = now()
    WHERE id = v_facture_id;
END;
$$;

-- 2.3 Recréer calculate_pru_facture (correction nom de colonne)
DROP FUNCTION IF EXISTS public.calculate_pru_facture(uuid);

CREATE OR REPLACE FUNCTION public.calculate_pru_facture(p_facture_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_montant_total DECIMAL(10,2);
    v_quantite_totale DECIMAL(10,2);
    v_pru DECIMAL(10,2);
BEGIN
    SELECT montant_total INTO v_montant_total
    FROM public.factures
    WHERE id = p_facture_id;
    
    SELECT SUM(quantite) INTO v_quantite_totale
    FROM public.lignes_facture
    WHERE facture_id = p_facture_id;
    
    IF v_quantite_totale IS NULL OR v_quantite_totale = 0 THEN
        RETURN 0;
    END IF;
    
    v_pru := v_montant_total / v_quantite_totale;
    
    RETURN v_pru;
END;
$$;