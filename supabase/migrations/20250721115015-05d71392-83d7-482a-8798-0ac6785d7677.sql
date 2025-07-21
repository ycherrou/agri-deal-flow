-- Corriger manuellement les transactions existantes 
UPDATE transactions_marche_secondaire 
SET 
  prix_achat_original = 50,  -- Prime d'achat originale
  gain_vendeur = CASE 
    WHEN prix_vente_final = 100 THEN (100 - 50) * 0.3937 * volume_transige  -- 50 cts/bu * facteur conversion * volume
    WHEN prix_vente_final = 90 THEN (90 - 50) * 0.3937 * volume_transige    -- 40 cts/bu * facteur conversion * volume
    ELSE gain_vendeur
  END,
  updated_at = now()
WHERE id IN (
  SELECT t.id 
  FROM transactions_marche_secondaire t
  JOIN reventes_clients r ON t.revente_id = r.id
  JOIN ventes v ON r.vente_id = v.id
  WHERE v.type_deal = 'prime'
);