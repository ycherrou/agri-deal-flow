-- Fonction pour calculer le PRU exact pour les factures
CREATE OR REPLACE FUNCTION public.calculate_pru_facture(vente_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  vente_record record;
  navire_record record;
  facteur_conversion numeric;
  prix_marche_actuel numeric;
  couvertures_info record;
  pru_final numeric;
BEGIN
  -- Récupérer la vente
  SELECT * INTO vente_record 
  FROM ventes 
  WHERE id = vente_id_param;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Récupérer le navire
  SELECT * INTO navire_record 
  FROM navires 
  WHERE id = vente_record.navire_id;
  
  -- Facteur de conversion selon le produit (Cts/Bu vers USD/MT)
  CASE navire_record.produit
    WHEN 'mais' THEN facteur_conversion := 0.3937;
    WHEN 'tourteau_soja' THEN facteur_conversion := 0.9072;
    ELSE facteur_conversion := 1;
  END CASE;
  
  -- Calcul selon le type de deal
  IF vente_record.type_deal = 'flat' THEN
    pru_final := COALESCE(vente_record.prix_flat, 0);
  ELSIF vente_record.type_deal = 'prime' THEN
    -- Récupérer les infos de couvertures
    SELECT 
      COALESCE(SUM(volume_couvert), 0) as volume_couvert_total,
      CASE 
        WHEN SUM(volume_couvert) > 0 THEN 
          SUM(prix_futures * volume_couvert) / SUM(volume_couvert)
        ELSE 0 
      END as prix_futures_moyen
    INTO couvertures_info
    FROM couvertures 
    WHERE vente_id = vente_record.id;
    
    -- Récupérer le prix de marché actuel si référence existe
    prix_marche_actuel := 0;
    IF vente_record.prix_reference IS NOT NULL THEN
      SELECT COALESCE(pm.prix, 0) INTO prix_marche_actuel
      FROM prix_marche pm 
      JOIN echeances e ON pm.echeance_id = e.id 
      WHERE e.nom = vente_record.prix_reference 
        AND e.active = true
      ORDER BY pm.created_at DESC 
      LIMIT 1;
    END IF;
    
    -- Calcul du PRU selon couverture
    IF couvertures_info.volume_couvert_total > 0 THEN
      -- Partiellement ou totalement couvert
      IF couvertures_info.volume_couvert_total >= vente_record.volume THEN
        -- Totalement couvert
        pru_final := (COALESCE(vente_record.prime_vente, 0) + couvertures_info.prix_futures_moyen) * facteur_conversion;
      ELSE
        -- Partiellement couvert - moyenne pondérée
        DECLARE
          volume_non_couvert numeric;
          pru_couvert numeric;
          pru_non_couvert numeric;
        BEGIN
          volume_non_couvert := vente_record.volume - couvertures_info.volume_couvert_total;
          pru_couvert := (COALESCE(vente_record.prime_vente, 0) + couvertures_info.prix_futures_moyen) * facteur_conversion;
          pru_non_couvert := (COALESCE(vente_record.prime_vente, 0) + prix_marche_actuel) * facteur_conversion;
          
          pru_final := (pru_couvert * couvertures_info.volume_couvert_total + pru_non_couvert * volume_non_couvert) / vente_record.volume;
        END;
      END IF;
    ELSE
      -- Non couvert - utiliser prix de marché
      pru_final := (COALESCE(vente_record.prime_vente, 0) + prix_marche_actuel) * facteur_conversion;
    END IF;
  ELSE
    pru_final := 0;
  END IF;
  
  RETURN pru_final;
END;
$function$;