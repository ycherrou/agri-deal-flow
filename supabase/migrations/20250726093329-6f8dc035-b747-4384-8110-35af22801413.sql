-- Corriger les transactions existantes avec le mauvais calcul de gain
-- Mise à jour des transactions existantes pour recalculer les gains correctement

UPDATE transactions_marche_secondaire t
SET gain_vendeur = CASE 
  WHEN rc.type_position = 'non_couverte' THEN
    -- Pour les positions non couvertes (prime): (prix_bid - prime_vente_originale) * 0.3937 * volume
    (t.prix_vente_final - v.prime_vente) * 0.3937 * t.volume_transige
  ELSE
    -- Pour les positions couvertes (flat): gain_vendeur reste le même
    t.gain_vendeur
END
FROM reventes_clients rc
JOIN ventes v ON rc.vente_id = v.id
WHERE t.revente_id = rc.id
  AND rc.type_position = 'non_couverte'
  AND t.gain_vendeur > 100000; -- Seulement pour les transactions avec un gain aberrant

-- Corriger aussi les stats dans le dashboard
UPDATE transactions_marche_secondaire t
SET commission_admin = gain_vendeur * 0.1
WHERE t.commission_admin > 50000; -- Recalculer les commissions aberrantes