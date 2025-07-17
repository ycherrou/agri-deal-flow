-- Update the calculate_pru_vente function with correct conversion factor for soybean meal
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
  
  -- Calculate based on deal type
  CASE vente_record.type_deal
    WHEN 'flat' THEN 
      -- For flat deals, PRU equals the flat price (already in $/tonne)
      pru := COALESCE(vente_record.prix_flat, 0);
    WHEN 'prime' THEN 
      -- For prime deals: (prime + average_futures_price) * conversion_factor
      -- Get average futures price for this sale
      SELECT AVG(c.prix_futures) INTO prix_futures_moyen
      FROM couvertures c 
      WHERE c.vente_id = vente_record.id;
      
      pru := (COALESCE(vente_record.prime_vente, 0) + COALESCE(prix_futures_moyen, 0)) * facteur_conversion;
    ELSE 
      pru := 0;
  END CASE;
  
  RETURN pru;
END;
$$;

-- Execute the function to update all existing transactions with corrected PRU
SELECT public.update_existing_transactions_pru();