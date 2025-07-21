-- Corriger la vente #cc53883b pour qu'elle soit en prime au lieu de flat
UPDATE ventes 
SET 
  type_deal = 'prime',
  prime_vente = 50.00,  -- Reprendre la prime originale
  prix_flat = NULL,     -- Supprimer le prix flat incorrect
  updated_at = now()
WHERE id = 'cc53883b-4610-401c-8ecd-172642e35eb9';