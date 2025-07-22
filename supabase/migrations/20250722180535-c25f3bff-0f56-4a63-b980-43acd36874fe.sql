-- Corriger le calcul PRU pour les ventes prime sans couvertures
UPDATE transactions_marche_secondaire 
SET 
  prix_achat_original = 25.00,  -- Prime d'achat (prime_vente - prime_achat) * facteur_conversion = (25-0) * 1 = 25
  gain_vendeur = (50 - 25.00) * volume_transige,
  updated_at = now()
WHERE id = '1a413a03-5814-49b1-be9a-751c558bcdfa';

-- Mettre à jour la fonction calculate_pru_vente pour gérer les cas sans couvertures
CREATE OR REPLACE FUNCTION public.calculate_pru_vente(vente_id_param uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $$
DECLARE
  vente_record record;
  navire_record record;
  facteur_conversion numeric;
  prix_futures_moyen numeric;
  pru numeric;
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
      -- For flat deals, PRU equals the flat price (already in $/tonne)
      -- If it's a flat vessel (no prime_achat), we could also use the vessel's flat price as reference
      pru := COALESCE(vente_record.prix_flat, navire_record.prix_achat_flat, 0);
    WHEN 'prime' THEN 
      -- For prime deals: (prime_vente - prime_achat + average_futures_price) * conversion_factor
      -- If no futures coverage, use just the prime difference
      SELECT AVG(c.prix_futures) INTO prix_futures_moyen
      FROM couvertures c 
      WHERE c.vente_id = vente_record.id;
      
      -- Use the prime difference as basis: vente_prime - achat_prime
      pru := (COALESCE(vente_record.prime_vente, 0) - COALESCE(navire_record.prime_achat, 0) + COALESCE(prix_futures_moyen, 0)) * facteur_conversion;
    ELSE 
      pru := 0;
  END CASE;
  
  RETURN pru;
END;
$$;