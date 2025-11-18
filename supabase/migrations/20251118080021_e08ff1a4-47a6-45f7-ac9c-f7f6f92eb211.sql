-- Correction des avertissements de sécurité et ajout des champs manquants

-- 1. CORRECTION DES FONCTIONS AVEC SEARCH_PATH (sans DROP, juste REPLACE)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
DECLARE
    current_role user_role;
BEGIN
    SELECT role INTO current_role
    FROM public.clients
    WHERE user_id = auth.uid();
    
    RETURN current_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.clients (user_id, nom, role, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nom', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'client'::public.user_role),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.generer_numero_facture()
RETURNS TEXT AS $$
DECLARE
    dernier_numero TEXT;
    annee_actuelle TEXT;
    nouveau_numero INTEGER;
BEGIN
    annee_actuelle := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT numero_facture INTO dernier_numero
    FROM public.factures
    WHERE numero_facture LIKE 'F' || annee_actuelle || '%'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF dernier_numero IS NULL THEN
        nouveau_numero := 1;
    ELSE
        nouveau_numero := CAST(SUBSTRING(dernier_numero FROM 4) AS INTEGER) + 1;
    END IF;
    
    RETURN 'F' || annee_actuelle || LPAD(nouveau_numero::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.traiter_paiement_facture(p_paiement_id UUID)
RETURNS VOID AS $$
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
    
    SELECT COALESCE(SUM(montant), 0) INTO v_total_paye
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.accept_bid_and_create_transaction(
    p_bid_id UUID,
    p_commission DECIMAL DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
    v_bid RECORD;
    v_revente RECORD;
    v_vente RECORD;
    v_vendeur_id UUID;
    v_transaction_id UUID;
BEGIN
    SELECT * INTO v_bid FROM public.bids_marche_secondaire WHERE id = p_bid_id;
    SELECT * INTO v_revente FROM public.reventes_clients WHERE id = v_bid.revente_id;
    SELECT * INTO v_vente FROM public.ventes WHERE id = v_revente.vente_id;
    
    v_vendeur_id := v_vente.client_id;
    
    INSERT INTO public.transactions_marche_secondaire (
        revente_id,
        vendeur_id,
        acheteur_id,
        volume,
        prix_transaction,
        commission,
        statut
    ) VALUES (
        v_revente.id,
        v_vendeur_id,
        v_bid.client_id,
        v_revente.volume,
        v_bid.prix_propose,
        p_commission,
        'completed'
    ) RETURNING id INTO v_transaction_id;
    
    UPDATE public.reventes_clients
    SET etat = 'vendu', updated_at = now()
    WHERE id = v_revente.id;
    
    UPDATE public.bids_marche_secondaire
    SET statut = 'accepted', updated_at = now()
    WHERE id = p_bid_id;
    
    UPDATE public.bids_marche_secondaire
    SET statut = 'rejected', updated_at = now()
    WHERE revente_id = v_revente.id AND id != p_bid_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_validated_secondary_market()
RETURNS TABLE (
    id UUID,
    vente_id UUID,
    volume DECIMAL,
    prix_flat_demande DECIMAL,
    date_revente DATE,
    etat revente_status,
    commentaire TEXT,
    date_expiration_validation TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    bids_marche_secondaire JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rc.id,
        rc.vente_id,
        rc.volume,
        rc.prix_flat_demande,
        rc.date_revente,
        rc.etat,
        rc.commentaire,
        rc.date_expiration_validation,
        rc.created_at,
        rc.updated_at,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', b.id,
                    'client_id', b.client_id,
                    'prix_propose', b.prix_propose,
                    'commentaire', b.commentaire,
                    'statut', b.statut,
                    'created_at', b.created_at
                )
            ) FILTER (WHERE b.id IS NOT NULL),
            '[]'::jsonb
        ) as bids_marche_secondaire
    FROM public.reventes_clients rc
    LEFT JOIN public.bids_marche_secondaire b ON b.revente_id = rc.id
    WHERE rc.etat = 'valide'
    GROUP BY rc.id, rc.vente_id, rc.volume, rc.prix_flat_demande, rc.date_revente, 
             rc.etat, rc.commentaire, rc.date_expiration_validation, rc.created_at, rc.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. AJOUT DES CHAMPS MANQUANTS DANS LES TABLES

-- Ajouter les champs manquants dans la table navires
ALTER TABLE public.navires ADD COLUMN IF NOT EXISTS date_debut_planche DATE;
ALTER TABLE public.navires ADD COLUMN IF NOT EXISTS date_fin_planche DATE;
ALTER TABLE public.navires ADD COLUMN IF NOT EXISTS prix_achat_flat DECIMAL(8,2);

-- Ajouter le champ prime_demandee dans reventes_clients
ALTER TABLE public.reventes_clients ADD COLUMN IF NOT EXISTS prime_demandee DECIMAL(8,2);

-- Ajouter le champ nombre_contrats dans couvertures
ALTER TABLE public.couvertures ADD COLUMN IF NOT EXISTS nombre_contrats DECIMAL(10,2);