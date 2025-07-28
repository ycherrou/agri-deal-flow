-- Corriger la logique des couvertures dans les transactions du marché secondaire
-- Ne plus créer automatiquement des couvertures orphelines

CREATE OR REPLACE FUNCTION public.accept_bid_and_create_transaction_with_notifications(bid_id_param uuid, seller_client_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  bid_record record;
  revente_record record;
  vente_record record;
  navire_record record;
  prix_achat_original_prime numeric;
  prix_vente_final_prime numeric;
  gain_vendeur_prime numeric;
  gain_vendeur_total numeric;
  transaction_id uuid;
  new_vente_id uuid;
  volume_ratio numeric;
  couverture_record record;
  contract_size numeric;
  contrats_a_reduire integer;
  volume_couvert_a_reduire numeric;
  buyer_client record;
  seller_client record;
  facteur_conversion numeric;
BEGIN
  -- Set search path for security
  SET search_path = '';
  
  -- Récupérer les informations de l'offre
  SELECT * INTO bid_record 
  FROM public.bids_marche_secondaire 
  WHERE id = bid_id_param AND statut = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offre non trouvée ou déjà traitée';
  END IF;
  
  -- Récupérer la revente
  SELECT * INTO revente_record 
  FROM public.reventes_clients 
  WHERE id = bid_record.revente_id;
  
  -- Récupérer la vente originale
  SELECT * INTO vente_record 
  FROM public.ventes 
  WHERE id = revente_record.vente_id;
  
  -- Vérifier que le vendeur est bien propriétaire
  IF vente_record.client_id != seller_client_id THEN
    RAISE EXCEPTION 'Non autorisé à accepter cette offre';
  END IF;
  
  -- Récupérer les infos du navire
  SELECT * INTO navire_record 
  FROM public.navires 
  WHERE id = vente_record.navire_id;
  
  -- Récupérer les infos des clients
  SELECT * INTO buyer_client FROM public.clients WHERE id = bid_record.client_id;
  SELECT * INTO seller_client FROM public.clients WHERE id = seller_client_id;
  
  -- Déterminer le facteur de conversion
  CASE navire_record.produit
    WHEN 'mais' THEN facteur_conversion := 0.3937;
    WHEN 'tourteau_soja' THEN facteur_conversion := 0.9072;
    ELSE facteur_conversion := 1;
  END CASE;
  
  -- Calcul corrigé du gain selon le type de deal
  IF vente_record.type_deal = 'prime' THEN
    -- Pour les deals prime : utiliser la prime de vente originale comme référence
    prix_achat_original_prime := COALESCE(vente_record.prime_vente, 0);
    prix_vente_final_prime := bid_record.prix_bid;
    
    -- Gain en prime (cts/bu)
    gain_vendeur_prime := prix_vente_final_prime - prix_achat_original_prime;
    
    -- Gain total en USD : gain_prime * facteur_conversion * volume
    gain_vendeur_total := gain_vendeur_prime * facteur_conversion * bid_record.volume_bid;
  ELSE
    -- Pour les deals flat : calcul direct en $/MT
    prix_achat_original_prime := COALESCE(vente_record.prix_flat, 0);
    prix_vente_final_prime := bid_record.prix_bid;
    gain_vendeur_total := (prix_vente_final_prime - prix_achat_original_prime) * bid_record.volume_bid;
  END IF;
  
  -- Calculer le ratio du volume vendu
  volume_ratio := bid_record.volume_bid / vente_record.volume;
  
  -- Obtenir la taille du contrat pour ce produit
  contract_size := public.get_contract_size(navire_record.produit::text);
  
  -- Marquer l'offre comme acceptée
  UPDATE public.bids_marche_secondaire 
  SET 
    statut = 'acceptee',
    accepted_at = now(),
    accepted_by_seller = true
  WHERE id = bid_id_param;
  
  -- Rejeter toutes les autres offres pour cette revente
  UPDATE public.bids_marche_secondaire 
  SET statut = 'rejetee'
  WHERE revente_id = bid_record.revente_id 
    AND id != bid_id_param 
    AND statut = 'active';
  
  -- Créer la transaction avec les bonnes valeurs
  INSERT INTO public.transactions_marche_secondaire (
    revente_id, bid_id, vendeur_id, acheteur_id,
    prix_achat_original, prix_vente_final, volume_transige,
    gain_vendeur, commission_admin
  ) VALUES (
    bid_record.revente_id, bid_id_param, seller_client_id, bid_record.client_id,
    prix_achat_original_prime, prix_vente_final_prime, bid_record.volume_bid,
    gain_vendeur_total, 0
  ) RETURNING id INTO transaction_id;
  
  -- Créer une nouvelle vente pour l'acheteur en préservant le type original
  -- NOUVEAU: Marquer avec parent_deal_id pour identifier les positions du marché secondaire
  IF vente_record.type_deal = 'prime' THEN
    INSERT INTO public.ventes (
      navire_id, client_id, type_deal, prime_vente, volume, date_deal, prix_reference, parent_deal_id
    ) VALUES (
      vente_record.navire_id, bid_record.client_id, 'prime',
      bid_record.prix_bid, bid_record.volume_bid, CURRENT_DATE, 
      vente_record.prix_reference, vente_record.id
    ) RETURNING id INTO new_vente_id;
  ELSE
    INSERT INTO public.ventes (
      navire_id, client_id, type_deal, prix_flat, volume, date_deal, prix_reference, parent_deal_id
    ) VALUES (
      vente_record.navire_id, bid_record.client_id, 'flat', 
      bid_record.prix_bid, bid_record.volume_bid, CURRENT_DATE, 
      vente_record.prix_reference, vente_record.id
    ) RETURNING id INTO new_vente_id;
  END IF;
  
  -- NOUVELLE LOGIQUE : Traiter les couvertures uniquement si la revente était de type "couverte"
  IF revente_record.type_position = 'couverte' THEN
    FOR couverture_record IN 
      SELECT * FROM public.couvertures WHERE vente_id = vente_record.id
    LOOP
      -- Calculer la réduction proportionnelle des contrats et du volume
      volume_couvert_a_reduire := couverture_record.volume_couvert * volume_ratio;
      contrats_a_reduire := ROUND(couverture_record.nombre_contrats * volume_ratio);
      
      -- Ne plus créer de couvertures orphelines automatiquement
      -- L'acheteur devra gérer ses propres couvertures selon ses besoins
      
      -- Réduire la couverture originale proportionnellement
      UPDATE public.couvertures 
      SET 
        volume_couvert = volume_couvert - volume_couvert_a_reduire,
        nombre_contrats = nombre_contrats - contrats_a_reduire,
        updated_at = now()
      WHERE id = couverture_record.id;
      
      -- Si la couverture devient nulle ou négative, la supprimer
      IF (couverture_record.volume_couvert - volume_couvert_a_reduire) <= 0 THEN
        DELETE FROM public.couvertures WHERE id = couverture_record.id;
      END IF;
    END LOOP;
  END IF;
  
  -- Mettre à jour la revente comme vendue
  UPDATE public.reventes_clients 
  SET 
    etat = 'vendu'::revente_status,
    updated_at = now()
  WHERE id = bid_record.revente_id;
  
  -- Mettre à jour le volume de la vente originale
  UPDATE public.ventes 
  SET 
    volume = volume - bid_record.volume_bid,
    updated_at = now()
  WHERE id = vente_record.id;
  
  -- Si tout le volume est vendu, supprimer la vente originale
  IF (vente_record.volume - bid_record.volume_bid) <= 0 THEN
    DELETE FROM public.ventes WHERE id = vente_record.id;
  END IF;

  -- Envoyer les notifications WhatsApp en arrière-plan
  PERFORM net.http_post(
    url := 'https://ghakstxearfsffrbkuxs.supabase.co/functions/v1/send-whatsapp-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || 
      current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
    body := json_build_object(
      'client_id', bid_record.client_id,
      'template_name', 'offre_acceptee',
      'variables', json_build_object(
        'prix', bid_record.prix_bid,
        'volume', bid_record.volume_bid,
        'produit', navire_record.produit
      )
    )::jsonb
  );

  PERFORM net.http_post(
    url := 'https://ghakstxearfsffrbkuxs.supabase.co/functions/v1/send-whatsapp-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || 
      current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
    body := json_build_object(
      'client_id', seller_client_id,
      'template_name', 'transaction_completee_vendeur',
      'variables', json_build_object(
        'prix', bid_record.prix_bid,
        'volume', bid_record.volume_bid,
        'produit', navire_record.produit,
        'gain', ROUND(gain_vendeur_total, 2)
      )
    )::jsonb
  );

  PERFORM net.http_post(
    url := 'https://ghakstxearfsffrbkuxs.supabase.co/functions/v1/send-whatsapp-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || 
      current_setting('app.settings.service_role_key', true) || '"}'::jsonb,
    body := json_build_object(
      'client_id', bid_record.client_id,
      'template_name', 'transaction_completee_acheteur',
      'variables', json_build_object(
        'prix', bid_record.prix_bid,
        'volume', bid_record.volume_bid,
        'produit', navire_record.produit
      )
    )::jsonb
  );
  
  RETURN transaction_id;
END;
$function$;