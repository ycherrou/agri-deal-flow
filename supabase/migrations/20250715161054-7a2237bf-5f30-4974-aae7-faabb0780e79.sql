-- Remove the date_maj column from prix_marche table since it's redundant with created_at
-- Also remove the unique constraint that includes date_maj
DROP INDEX IF EXISTS prix_marche_echeance_date_maj_key;
ALTER TABLE prix_marche DROP COLUMN IF EXISTS date_maj;

-- Create new unique constraint on echeance and created_at to prevent duplicate entries
-- for the same echeance on the same timestamp
ALTER TABLE prix_marche ADD CONSTRAINT prix_marche_echeance_created_at_unique UNIQUE (echeance, created_at);