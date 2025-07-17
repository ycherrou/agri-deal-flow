-- Modifier la table couvertures pour permettre les couvertures orphelines
ALTER TABLE couvertures ALTER COLUMN vente_id DROP NOT NULL;
COMMENT ON COLUMN couvertures.vente_id IS 'NULL pour les couvertures orphelines du marché secondaire';

-- Modifier la fonction pour créer des couvertures orphelines au lieu de les transférer à l'acheteur
CREATE OR REPLACE FUNCTION public.accept_bid_and_create_transaction(bid_id_param uuid, seller_client_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  bid_record record;
  revente_record record;
  vente_record record;
  navire_record record;
  prix_achat_original numeric;
  gain_vendeur numeric;
  transaction_id uuid;
  new_vente_id uuid;
  volume_ratio numeric;
  couverture_record record;
  contract_size numeric;
  contrats_a_reduire integer;
  volume_couvert_a_reduire numeric;
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
  
  -- Calculer le ratio du volume vendu
  volume_ratio := bid_record.volume_bid / vente_record.volume;
  
  -- Obtenir la taille du contrat pour ce produit
  contract_size := get_contract_size(navire_record.produit);
  
  -- Marquer l'offre comme acceptée
  UPDATE bids_marche_secondaire 
  SET 
    statut = 'acceptee',
    accepted_at = now(),
    accepted_by_seller = true
  WHERE id = bid_id_param;
  
  -- Rejeter toutes les autres offres pour cette revente
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
  
  -- Créer une nouvelle vente pour l'acheteur (sans couvertures)
  INSERT INTO ventes (
    navire_id, client_id, type_deal, prix_flat, volume, date_deal, prix_reference
  ) VALUES (
    vente_record.navire_id, bid_record.client_id, 'flat', 
    bid_record.prix_bid, bid_record.volume_bid, CURRENT_DATE, 
    vente_record.prix_reference
  ) RETURNING id INTO new_vente_id;
  
  -- Traiter les couvertures : les rendre orphelines au lieu de les transférer
  FOR couverture_record IN 
    SELECT * FROM couvertures WHERE vente_id = vente_record.id
  LOOP
    -- Calculer la réduction proportionnelle des contrats et du volume
    volume_couvert_a_reduire := couverture_record.volume_couvert * volume_ratio;
    contrats_a_reduire := ROUND(couverture_record.nombre_contrats * volume_ratio);
    
    -- Créer une couverture orpheline (vente_id = NULL) pour les futures du marché secondaire
    INSERT INTO couvertures (
      vente_id, prix_futures, volume_couvert, nombre_contrats, date_couverture
    ) VALUES (
      NULL, -- vente_id NULL pour indiquer une couverture orpheline
      couverture_record.prix_futures, 
      volume_couvert_a_reduire,
      contrats_a_reduire,
      couverture_record.date_couverture
    );
    
    -- Réduire la couverture originale
    UPDATE couvertures 
    SET 
      volume_couvert = volume_couvert - volume_couvert_a_reduire,
      nombre_contrats = nombre_contrats - contrats_a_reduire,
      updated_at = now()
    WHERE id = couverture_record.id;
    
    -- Si la couverture devient nulle ou négative, la supprimer
    IF (couverture_record.volume_couvert - volume_couvert_a_reduire) <= 0 THEN
      DELETE FROM couvertures WHERE id = couverture_record.id;
    END IF;
  END LOOP;
  
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
  
  -- Si tout le volume est vendu, supprimer la vente originale
  IF (vente_record.volume - bid_record.volume_bid) <= 0 THEN
    DELETE FROM ventes WHERE id = vente_record.id;
  END IF;
  
  RETURN transaction_id;
END;
$function$;