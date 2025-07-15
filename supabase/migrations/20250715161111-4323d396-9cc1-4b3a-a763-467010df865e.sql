-- Remove the unique constraint that includes date_maj
DROP INDEX IF EXISTS prix_marche_echeance_date_maj_key;

-- Drop the date_maj column
ALTER TABLE public.prix_marche DROP COLUMN IF EXISTS date_maj;

-- Create new unique constraint on echeance and created_at
ALTER TABLE public.prix_marche ADD CONSTRAINT prix_marche_echeance_created_at_unique UNIQUE (echeance, created_at);