-- Corriger la fonction calculate_pru_vente pour intégrer correctement le fret selon le type de prix
CREATE OR REPLACE FUNCTION public.calculate_pru_vente(vente_id_param uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  vente_record record;
  navire_record record;
  facteur_conversion numeric;
  prix_futures_moyen numeric;
  pru numeric;
  prime_achat_avec_fret numeric;
  prix_flat_avec_fret numeric;
BEGIN
  -- Get sale record
  SELECT * INTO vente_record 
  FROM ventes 
  WHERE id = vente_id_param;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Get vessel record for product type
  SELECT * INTO navire_record 
  FROM navires 
  WHERE id = vente_record.navire_id;
  
  -- Determine conversion factor based on product type (cts/bu -> $/tonne)
  CASE navire_record.produit
    WHEN 'mais' THEN facteur_conversion := 0.3937;
    WHEN 'tourteau_soja' THEN facteur_conversion := 0.9072;
    ELSE facteur_conversion := 1; -- Already in $/tonne
  END CASE;
  
  -- Calculate based on deal type and vessel type
  CASE vente_record.type_deal
    WHEN 'flat' THEN 
      -- For flat deals: add freight directly to flat price (both in $/tonne)
      prix_flat_avec_fret := COALESCE(vente_record.prix_flat, navire_record.prix_achat_flat, 0);
      
      IF navire_record.terme_commercial = 'FOB' THEN
        prix_flat_avec_fret := prix_flat_avec_fret + COALESCE(navire_record.taux_fret, 0);
      END IF;
      
      pru := prix_flat_avec_fret;
      
    WHEN 'prime' THEN 
      -- For prime deals: convert freight from $/tonne to cts/bu and add to prime
      prime_achat_avec_fret := COALESCE(navire_record.prime_achat, 0);
      
      IF navire_record.terme_commercial = 'FOB' AND facteur_conversion > 0 THEN
        -- Convert freight from $/tonne to cts/bu by dividing by conversion factor
        prime_achat_avec_fret := prime_achat_avec_fret + (COALESCE(navire_record.taux_fret, 0) / facteur_conversion);
      END IF;
      
      -- Get average futures price
      SELECT AVG(c.prix_futures) INTO prix_futures_moyen
      FROM couvertures c 
      WHERE c.vente_id = vente_record.id;
      
      -- Calculate PRU: (prime_vente - prime_achat_avec_fret + futures) * conversion_factor
      pru := (COALESCE(vente_record.prime_vente, 0) - prime_achat_avec_fret + COALESCE(prix_futures_moyen, 0)) * facteur_conversion;
      
    ELSE 
      pru := 0;
  END CASE;
  
  RETURN pru;
END;
$function$