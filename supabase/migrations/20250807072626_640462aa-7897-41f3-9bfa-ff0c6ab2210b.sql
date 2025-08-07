-- Add new date columns for planche periods
ALTER TABLE public.navires 
ADD COLUMN date_debut_planche date,
ADD COLUMN date_fin_planche date;

-- Migrate existing data: use date_arrivee as debut, add 3 days for fin
UPDATE public.navires 
SET 
  date_debut_planche = date_arrivee,
  date_fin_planche = date_arrivee + INTERVAL '3 days'
WHERE date_arrivee IS NOT NULL;

-- For navires without date_arrivee, set reasonable defaults
UPDATE public.navires 
SET 
  date_debut_planche = CURRENT_DATE,
  date_fin_planche = CURRENT_DATE + INTERVAL '3 days'
WHERE date_arrivee IS NULL;

-- Make the columns non-nullable now that we have data
ALTER TABLE public.navires 
ALTER COLUMN date_debut_planche SET NOT NULL,
ALTER COLUMN date_fin_planche SET NOT NULL;

-- Add a constraint to ensure end date is after or equal to start date
ALTER TABLE public.navires 
ADD CONSTRAINT check_planche_dates 
CHECK (date_fin_planche >= date_debut_planche);