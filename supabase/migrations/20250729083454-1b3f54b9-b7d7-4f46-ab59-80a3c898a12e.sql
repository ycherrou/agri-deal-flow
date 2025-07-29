-- Make date_ouverture optional and provide default values for required fields
ALTER TABLE public.lignes_bancaires 
ALTER COLUMN date_ouverture DROP NOT NULL,
ALTER COLUMN date_ouverture SET DEFAULT CURRENT_DATE;