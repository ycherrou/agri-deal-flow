-- Ajout des derniers champs et fonctions manquants

-- Ajout de champs dans navires
ALTER TABLE public.navires ADD COLUMN IF NOT EXISTS taux_fret DECIMAL(8,2);

-- Ajout de champs dans reventes_clients
ALTER TABLE public.reventes_clients ADD COLUMN IF NOT EXISTS validated_by_admin BOOLEAN DEFAULT false;

-- Création de la fonction calculate_pru_facture
CREATE OR REPLACE FUNCTION public.calculate_pru_facture(p_facture_id UUID)
RETURNS DECIMAL AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Création de la fonction allouer_financement
CREATE OR REPLACE FUNCTION public.allouer_financement(
    p_ligne_bancaire_id UUID,
    p_montant DECIMAL,
    p_type_financement TEXT
)
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;