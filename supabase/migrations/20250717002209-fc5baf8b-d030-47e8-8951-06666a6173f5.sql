-- Corriger la fonction pour utiliser les bons statuts
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
  
  -- Marquer l'offre comme acceptée (utiliser 'acceptee' au lieu de 'accepted')
  UPDATE bids_marche_secondaire 
  SET 
    statut = 'acceptee',
    accepted_at = now(),
    accepted_by_seller = true
  WHERE id = bid_id_param;
  
  -- Rejeter toutes les autres offres pour cette revente (utiliser 'rejetee' au lieu de 'rejected')
  UPDATE bids_marche_secondaire 
  SET statut = 'rejetee'
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