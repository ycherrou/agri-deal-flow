-- Reconstruction complète de la base de données à partir des migrations existantes

-- 1. CRÉATION DES TYPES ENUM
CREATE TYPE public.user_role AS ENUM ('admin', 'client');
CREATE TYPE public.product_type AS ENUM ('mais', 'tourteau_soja', 'ble', 'orge');
CREATE TYPE public.deal_type AS ENUM ('prime', 'flat');
CREATE TYPE public.revente_status AS ENUM ('en_attente_validation', 'valide', 'en_attente', 'vendu', 'retire');

-- 2. CRÉATION DE LA TABLE CLIENTS
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'client',
    email TEXT,
    telephone TEXT,
    adresse TEXT,
    ville TEXT,
    code_postal TEXT,
    pays TEXT DEFAULT 'France',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. CRÉATION DE LA TABLE ECHEANCES (pour les contrats CBOT)
CREATE TABLE public.echeances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produit product_type NOT NULL,
    nom TEXT NOT NULL UNIQUE,
    date_echeance DATE NOT NULL,
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. CRÉATION DE LA TABLE PRIX_MARCHE
CREATE TABLE public.prix_marche (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    echeance_id UUID NOT NULL REFERENCES public.echeances(id) ON DELETE CASCADE,
    prix DECIMAL(8,2) NOT NULL,
    date_maj TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(echeance_id, date_maj)
);

-- 5. CRÉATION DE LA TABLE NAVIRES
CREATE TABLE public.navires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    produit product_type NOT NULL,
    quantite_totale DECIMAL(10,2) NOT NULL,
    prime_achat DECIMAL(8,2),
    date_arrivee DATE NOT NULL,
    fournisseur TEXT NOT NULL,
    reference_cbot TEXT,
    echeance_id UUID REFERENCES public.echeances(id),
    navire_parent_id UUID REFERENCES public.navires(id),
    est_roll BOOLEAN DEFAULT false,
    volume_dispo_achat DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. CRÉATION DE LA TABLE VENTES
CREATE TABLE public.ventes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navire_id UUID NOT NULL REFERENCES public.navires(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    type_deal deal_type NOT NULL,
    prime_vente DECIMAL(8,2),
    prix_flat DECIMAL(8,2),
    volume DECIMAL(10,2) NOT NULL,
    date_deal DATE NOT NULL DEFAULT CURRENT_DATE,
    prix_reference TEXT,
    vente_parent_id UUID REFERENCES public.ventes(id),
    est_roll BOOLEAN DEFAULT false,
    echeance_id UUID REFERENCES public.echeances(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    CONSTRAINT check_deal_type_price CHECK (
        (type_deal = 'prime' AND prime_vente IS NOT NULL AND prix_flat IS NULL) OR
        (type_deal = 'flat' AND prix_flat IS NOT NULL AND prime_vente IS NULL)
    )
);

-- 7. CRÉATION DE LA TABLE COUVERTURES
CREATE TABLE public.couvertures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vente_id UUID NOT NULL REFERENCES public.ventes(id) ON DELETE CASCADE,
    volume_couvert DECIMAL(10,2) NOT NULL,
    prix_futures DECIMAL(8,2) NOT NULL,
    date_couverture DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. CRÉATION DE LA TABLE COUVERTURES_ACHAT
CREATE TABLE public.couvertures_achat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navire_id UUID NOT NULL REFERENCES public.navires(id) ON DELETE CASCADE,
    nombre_contrats DECIMAL(10,2) NOT NULL,
    prix_futures DECIMAL(8,2) NOT NULL,
    date_couverture DATE NOT NULL DEFAULT CURRENT_DATE,
    echeance_id UUID REFERENCES public.echeances(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 9. CRÉATION DE LA TABLE REVENTES_CLIENTS
CREATE TABLE public.reventes_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vente_id UUID NOT NULL REFERENCES public.ventes(id) ON DELETE CASCADE,
    volume DECIMAL(10,2) NOT NULL,
    prix_flat_demande DECIMAL(8,2) NOT NULL,
    date_revente DATE NOT NULL DEFAULT CURRENT_DATE,
    etat revente_status NOT NULL DEFAULT 'en_attente',
    commentaire TEXT,
    date_expiration_validation TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10. CRÉATION DE LA TABLE BIDS_MARCHE_SECONDAIRE
CREATE TABLE public.bids_marche_secondaire (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revente_id UUID NOT NULL REFERENCES public.reventes_clients(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    prix_propose DECIMAL(8,2) NOT NULL,
    commentaire TEXT,
    statut TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 11. CRÉATION DE LA TABLE TRANSACTIONS_MARCHE_SECONDAIRE
CREATE TABLE public.transactions_marche_secondaire (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revente_id UUID NOT NULL REFERENCES public.reventes_clients(id) ON DELETE CASCADE,
    vendeur_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    acheteur_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    volume DECIMAL(10,2) NOT NULL,
    prix_transaction DECIMAL(8,2) NOT NULL,
    date_transaction TIMESTAMP WITH TIME ZONE DEFAULT now(),
    commission DECIMAL(8,2) DEFAULT 0,
    statut TEXT DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 12. CRÉATION DE LA TABLE FACTURES
CREATE TABLE public.factures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_facture TEXT NOT NULL UNIQUE,
    vente_id UUID REFERENCES public.ventes(id) ON DELETE SET NULL,
    transaction_secondaire_id UUID REFERENCES public.transactions_marche_secondaire(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    type_facture TEXT NOT NULL CHECK (type_facture IN ('proforma', 'commerciale', 'regularisation')),
    date_facture DATE NOT NULL DEFAULT CURRENT_DATE,
    date_echeance DATE NOT NULL,
    montant_total DECIMAL(10,2) NOT NULL,
    devise TEXT DEFAULT 'EUR',
    taux_change DECIMAL(10,4) DEFAULT 1.0,
    statut TEXT DEFAULT 'impayee' CHECK (statut IN ('impayee', 'partiellement_payee', 'payee', 'annulee')),
    conditions_paiement TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 13. CRÉATION DE LA TABLE LIGNES_FACTURE
CREATE TABLE public.lignes_facture (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facture_id UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantite DECIMAL(10,2) NOT NULL,
    prix_unitaire DECIMAL(10,2) NOT NULL,
    montant_ligne DECIMAL(10,2) NOT NULL,
    ordre INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 14. CRÉATION DE LA TABLE PAIEMENTS_FACTURES
CREATE TABLE public.paiements_factures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facture_id UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
    montant DECIMAL(10,2) NOT NULL,
    date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
    mode_paiement TEXT,
    reference_paiement TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 15. CRÉATION DE LA TABLE LIGNES_BANCAIRES
CREATE TABLE public.lignes_bancaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    banque TEXT NOT NULL,
    type_ligne TEXT NOT NULL,
    montant_autorise DECIMAL(12,2) NOT NULL,
    montant_utilise DECIMAL(12,2) DEFAULT 0,
    taux_interet DECIMAL(5,2),
    date_debut DATE NOT NULL,
    date_fin DATE,
    actif BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 16. CRÉATION DE LA TABLE MOUVEMENTS_BANCAIRES
CREATE TABLE public.mouvements_bancaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ligne_bancaire_id UUID NOT NULL REFERENCES public.lignes_bancaires(id) ON DELETE CASCADE,
    type_mouvement TEXT NOT NULL CHECK (type_mouvement IN ('utilisation', 'remboursement')),
    montant DECIMAL(12,2) NOT NULL,
    date_mouvement DATE NOT NULL DEFAULT CURRENT_DATE,
    reference TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 17. CRÉATION DE LA TABLE WHATSAPP_TEMPLATES
CREATE TABLE public.whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    description TEXT,
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 18. CRÉATION DE LA TABLE NOTIFICATIONS_HISTORY
CREATE TABLE public.notifications_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    template_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    message_content TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 19. ACTIVATION DU RLS SUR TOUTES LES TABLES
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echeances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prix_marche ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couvertures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couvertures_achat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reventes_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids_marche_secondaire ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions_marche_secondaire ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lignes_facture ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements_factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lignes_bancaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mouvements_bancaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_history ENABLE ROW LEVEL SECURITY;

-- 20. FONCTION SECURITY DEFINER POUR OBTENIR LE RÔLE
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 21. POLITIQUES RLS POUR CLIENTS
CREATE POLICY "Les admins peuvent tout voir sur clients"
ON public.clients FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Les clients peuvent voir leur propre profil"
ON public.clients FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Les admins peuvent créer des clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Les clients peuvent mettre à jour leur profil"
ON public.clients FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.get_current_user_role() = 'admin');

-- 22. POLITIQUES RLS POUR ECHEANCES
CREATE POLICY "Tout le monde peut voir les échéances"
ON public.echeances FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Seuls les admins peuvent gérer les échéances"
ON public.echeances FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- 23. POLITIQUES RLS POUR PRIX_MARCHE
CREATE POLICY "Tout le monde peut voir les prix de marché"
ON public.prix_marche FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Seuls les admins peuvent gérer les prix"
ON public.prix_marche FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- 24. POLITIQUES RLS POUR NAVIRES
CREATE POLICY "Tout le monde peut voir les navires"
ON public.navires FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Seuls les admins peuvent gérer les navires"
ON public.navires FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- 25. POLITIQUES RLS POUR VENTES
CREATE POLICY "Les admins peuvent tout voir sur ventes"
ON public.ventes FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Les clients peuvent voir leurs ventes"
ON public.ventes FOR SELECT
TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Seuls les admins peuvent créer des ventes"
ON public.ventes FOR INSERT
TO authenticated
WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Seuls les admins peuvent modifier les ventes"
ON public.ventes FOR UPDATE
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Seuls les admins peuvent supprimer les ventes"
ON public.ventes FOR DELETE
TO authenticated
USING (public.get_current_user_role() = 'admin');

-- 26. POLITIQUES RLS POUR COUVERTURES
CREATE POLICY "Les admins peuvent tout voir sur couvertures"
ON public.couvertures FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Les clients peuvent voir leurs couvertures"
ON public.couvertures FOR SELECT
TO authenticated
USING (vente_id IN (
    SELECT id FROM public.ventes 
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
));

CREATE POLICY "Seuls les admins peuvent gérer les couvertures"
ON public.couvertures FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- 27. POLITIQUES RLS POUR COUVERTURES_ACHAT
CREATE POLICY "Seuls les admins peuvent voir et gérer les couvertures d'achat"
ON public.couvertures_achat FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- 28. POLITIQUES RLS POUR REVENTES_CLIENTS
CREATE POLICY "Les admins peuvent tout voir sur reventes"
ON public.reventes_clients FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Les clients peuvent voir toutes les reventes disponibles"
ON public.reventes_clients FOR SELECT
TO authenticated
USING (etat IN ('en_attente', 'valide'));

CREATE POLICY "Les clients peuvent créer leurs reventes"
ON public.reventes_clients FOR INSERT
TO authenticated
WITH CHECK (vente_id IN (
    SELECT id FROM public.ventes 
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
));

CREATE POLICY "Les clients peuvent modifier leurs reventes"
ON public.reventes_clients FOR UPDATE
TO authenticated
USING (vente_id IN (
    SELECT id FROM public.ventes 
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
) OR public.get_current_user_role() = 'admin');

CREATE POLICY "Seuls les admins peuvent supprimer les reventes"
ON public.reventes_clients FOR DELETE
TO authenticated
USING (public.get_current_user_role() = 'admin');

-- 29. POLITIQUES RLS POUR BIDS_MARCHE_SECONDAIRE
CREATE POLICY "Les admins peuvent tout voir sur les bids"
ON public.bids_marche_secondaire FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Les clients peuvent voir leurs propres bids"
ON public.bids_marche_secondaire FOR SELECT
TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Les clients peuvent créer des bids"
ON public.bids_marche_secondaire FOR INSERT
TO authenticated
WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Seuls les admins peuvent modifier les bids"
ON public.bids_marche_secondaire FOR UPDATE
TO authenticated
USING (public.get_current_user_role() = 'admin');

-- 30. POLITIQUES RLS POUR TRANSACTIONS_MARCHE_SECONDAIRE
CREATE POLICY "Les admins peuvent tout voir sur les transactions"
ON public.transactions_marche_secondaire FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Les clients peuvent voir leurs transactions"
ON public.transactions_marche_secondaire FOR SELECT
TO authenticated
USING (
    vendeur_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()) OR
    acheteur_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

CREATE POLICY "Seuls les admins peuvent créer des transactions"
ON public.transactions_marche_secondaire FOR INSERT
TO authenticated
WITH CHECK (public.get_current_user_role() = 'admin');

-- 31. POLITIQUES RLS POUR FACTURES
CREATE POLICY "Les admins peuvent tout voir sur factures"
ON public.factures FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Les clients peuvent voir leurs factures"
ON public.factures FOR SELECT
TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Seuls les admins peuvent gérer les factures"
ON public.factures FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- 32. POLITIQUES RLS POUR LIGNES_FACTURE
CREATE POLICY "Les admins peuvent tout voir sur lignes facture"
ON public.lignes_facture FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Les clients peuvent voir les lignes de leurs factures"
ON public.lignes_facture FOR SELECT
TO authenticated
USING (facture_id IN (
    SELECT id FROM public.factures 
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
));

CREATE POLICY "Seuls les admins peuvent gérer les lignes facture"
ON public.lignes_facture FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- 33. POLITIQUES RLS POUR PAIEMENTS_FACTURES
CREATE POLICY "Les admins peuvent tout voir sur paiements"
ON public.paiements_factures FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Les clients peuvent voir les paiements de leurs factures"
ON public.paiements_factures FOR SELECT
TO authenticated
USING (facture_id IN (
    SELECT id FROM public.factures 
    WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
));

CREATE POLICY "Seuls les admins peuvent gérer les paiements"
ON public.paiements_factures FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- 34. POLITIQUES RLS POUR LIGNES_BANCAIRES
CREATE POLICY "Seuls les admins peuvent gérer les lignes bancaires"
ON public.lignes_bancaires FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- 35. POLITIQUES RLS POUR MOUVEMENTS_BANCAIRES
CREATE POLICY "Seuls les admins peuvent gérer les mouvements bancaires"
ON public.mouvements_bancaires FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- 36. POLITIQUES RLS POUR WHATSAPP_TEMPLATES
CREATE POLICY "Tout le monde peut voir les templates WhatsApp actifs"
ON public.whatsapp_templates FOR SELECT
TO authenticated
USING (actif = true OR public.get_current_user_role() = 'admin');

CREATE POLICY "Seuls les admins peuvent gérer les templates"
ON public.whatsapp_templates FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- 37. POLITIQUES RLS POUR NOTIFICATIONS_HISTORY
CREATE POLICY "Les admins peuvent voir tout l'historique"
ON public.notifications_history FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Les clients peuvent voir leurs notifications"
ON public.notifications_history FOR SELECT
TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Seuls les admins peuvent créer des entrées historique"
ON public.notifications_history FOR INSERT
TO authenticated
WITH CHECK (public.get_current_user_role() = 'admin');

-- 38. TRIGGERS POUR UPDATED_AT
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_echeances_updated_at BEFORE UPDATE ON public.echeances
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_navires_updated_at BEFORE UPDATE ON public.navires
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ventes_updated_at BEFORE UPDATE ON public.ventes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_couvertures_updated_at BEFORE UPDATE ON public.couvertures
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_couvertures_achat_updated_at BEFORE UPDATE ON public.couvertures_achat
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reventes_clients_updated_at BEFORE UPDATE ON public.reventes_clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bids_updated_at BEFORE UPDATE ON public.bids_marche_secondaire
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions_marche_secondaire
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_factures_updated_at BEFORE UPDATE ON public.factures
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lignes_facture_updated_at BEFORE UPDATE ON public.lignes_facture
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_paiements_updated_at BEFORE UPDATE ON public.paiements_factures
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lignes_bancaires_updated_at BEFORE UPDATE ON public.lignes_bancaires
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mouvements_updated_at BEFORE UPDATE ON public.mouvements_bancaires
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.whatsapp_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 39. TRIGGER POUR CRÉER UN CLIENT LORS DE L'INSCRIPTION
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 40. FONCTION POUR GÉNÉRER LES NUMÉROS DE FACTURE
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
$$ LANGUAGE plpgsql;

-- 41. FONCTION POUR TRAITER LES PAIEMENTS
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 42. FONCTION POUR ACCEPTER UN BID ET CRÉER UNE TRANSACTION
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 43. FONCTION POUR OBTENIR LES REVENTES VALIDÉES DU MARCHÉ SECONDAIRE
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
        rc.*,
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
    GROUP BY rc.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;