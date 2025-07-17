-- Ajouter des colonnes à bids_marche_secondaire pour l'acceptation
ALTER TABLE public.bids_marche_secondaire 
ADD COLUMN accepted_at timestamp with time zone,
ADD COLUMN accepted_by_seller boolean DEFAULT false;

-- Créer la table des transactions du marché secondaire
CREATE TABLE public.transactions_marche_secondaire (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  revente_id uuid NOT NULL,
  bid_id uuid NOT NULL,
  vendeur_id uuid NOT NULL,
  acheteur_id uuid NOT NULL,
  prix_achat_original numeric NOT NULL,
  prix_vente_final numeric NOT NULL,
  volume_transige numeric NOT NULL,
  gain_vendeur numeric NOT NULL,
  commission_admin numeric DEFAULT 0,
  date_transaction timestamp with time zone NOT NULL DEFAULT now(),
  statut text NOT NULL DEFAULT 'completee',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Activer RLS sur la nouvelle table
ALTER TABLE public.transactions_marche_secondaire ENABLE ROW LEVEL SECURITY;

-- Politique pour les admins (peuvent tout voir et gérer)
CREATE POLICY "Admins can manage all transactions" 
ON public.transactions_marche_secondaire
FOR ALL 
USING (get_current_user_role() = 'admin'::user_role);

-- Politique pour que les vendeurs voient leurs transactions
CREATE POLICY "Vendeurs can view their transactions" 
ON public.transactions_marche_secondaire
FOR SELECT 
USING (vendeur_id IN (
  SELECT id FROM clients WHERE user_id = auth.uid()
));

-- Politique pour que les acheteurs voient leurs transactions
CREATE POLICY "Acheteurs can view their transactions" 
ON public.transactions_marche_secondaire
FOR SELECT 
USING (acheteur_id IN (
  SELECT id FROM clients WHERE user_id = auth.uid()
));

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions_marche_secondaire
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction pour calculer le PRU d'une vente
CREATE OR REPLACE FUNCTION public.calculate_pru_vente(vente_id_param uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN v.type_deal = 'flat' THEN v.prix_flat
      WHEN v.type_deal = 'prime' THEN 
        COALESCE(v.prime_vente, 0) + 
        COALESCE(
          (SELECT AVG(c.prix_futures) 
           FROM couvertures c 
           WHERE c.vente_id = v.id), 
          0
        )
      ELSE 0
    END
  FROM ventes v
  WHERE v.id = vente_id_param;
$$;

-- Fonction pour accepter une offre et créer la transaction
CREATE OR REPLACE FUNCTION public.accept_bid_and_create_transaction(
  bid_id_param uuid,
  seller_client_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bid_record record;
  revente_record record;
  vente_record record;
  navire_record record;
  prix_achat_original numeric;
  gain_vendeur numeric;
  transaction_id uuid;
  new_vente_id uuid;
BEGIN
  -- Récupérer les informations de l'offre
  SELECT * INTO bid_record 
  FROM bids_marche_secondaire 
  WHERE id = bid_id_param AND statut = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offre non trouvée ou déjà traitée';
  END IF;
  
  -- Récupérer la revente
  SELECT * INTO revente_record 
  FROM reventes_clients 
  WHERE id = bid_record.revente_id;
  
  -- Récupérer la vente originale
  SELECT * INTO vente_record 
  FROM ventes 
  WHERE id = revente_record.vente_id;
  
  -- Vérifier que le vendeur est bien propriétaire
  IF vente_record.client_id != seller_client_id THEN
    RAISE EXCEPTION 'Non autorisé à accepter cette offre';
  END IF;
  
  -- Récupérer les infos du navire
  SELECT * INTO navire_record 
  FROM navires 
  WHERE id = vente_record.navire_id;
  
  -- Calculer le prix d'achat original (PRU)
  prix_achat_original := calculate_pru_vente(vente_record.id);
  
  -- Calculer le gain du vendeur
  gain_vendeur := bid_record.prix_bid - prix_achat_original;
  
  -- Marquer l'offre comme acceptée
  UPDATE bids_marche_secondaire 
  SET 
    statut = 'accepted',
    accepted_at = now(),
    accepted_by_seller = true
  WHERE id = bid_id_param;
  
  -- Rejeter toutes les autres offres pour cette revente
  UPDATE bids_marche_secondaire 
  SET statut = 'rejected'
  WHERE revente_id = bid_record.revente_id 
    AND id != bid_id_param 
    AND statut = 'active';
  
  -- Créer la transaction
  INSERT INTO transactions_marche_secondaire (
    revente_id, bid_id, vendeur_id, acheteur_id,
    prix_achat_original, prix_vente_final, volume_transige,
    gain_vendeur, commission_admin
  ) VALUES (
    bid_record.revente_id, bid_id_param, seller_client_id, bid_record.client_id,
    prix_achat_original, bid_record.prix_bid, bid_record.volume_bid,
    gain_vendeur * bid_record.volume_bid, 0
  ) RETURNING id INTO transaction_id;
  
  -- Créer une nouvelle vente pour l'acheteur
  INSERT INTO ventes (
    navire_id, client_id, type_deal, prix_flat, volume, date_deal, prix_reference
  ) VALUES (
    vente_record.navire_id, bid_record.client_id, 'flat', 
    bid_record.prix_bid, bid_record.volume_bid, CURRENT_DATE, 
    vente_record.prix_reference
  ) RETURNING id INTO new_vente_id;
  
  -- Mettre à jour la revente comme vendue
  UPDATE reventes_clients 
  SET 
    etat = 'vendu'::revente_status,
    updated_at = now()
  WHERE id = bid_record.revente_id;
  
  -- Mettre à jour le volume de la vente originale
  UPDATE ventes 
  SET 
    volume = volume - bid_record.volume_bid,
    updated_at = now()
  WHERE id = vente_record.id;
  
  -- Si tout le volume est vendu, on peut supprimer la vente originale
  IF (vente_record.volume - bid_record.volume_bid) <= 0 THEN
    DELETE FROM ventes WHERE id = vente_record.id;
  END IF;
  
  RETURN transaction_id;
END;
$$;