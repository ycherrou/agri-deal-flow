-- 1. Extend clients table with missing address fields
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS adresse TEXT,
ADD COLUMN IF NOT EXISTS ville TEXT,
ADD COLUMN IF NOT EXISTS code_postal TEXT,
ADD COLUMN IF NOT EXISTS pays TEXT DEFAULT 'Maroc';

-- 2. Extend navires table with transport and cargo details
ALTER TABLE public.navires
ADD COLUMN IF NOT EXISTS port_chargement TEXT,
ADD COLUMN IF NOT EXISTS port_dechargement TEXT,
ADD COLUMN IF NOT EXISTS origine TEXT,
ADD COLUMN IF NOT EXISTS connaissement TEXT,
ADD COLUMN IF NOT EXISTS date_connaissement DATE;

-- 3. Create references_factures table for automatic reference generation
CREATE TABLE IF NOT EXISTS public.references_factures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annee INTEGER NOT NULL,
  dernier_numero INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(annee)
);

-- 4. Function to generate invoice references (YRG YY/MM format)
CREATE OR REPLACE FUNCTION public.generer_reference_facture()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  annee_courante INTEGER;
  mois_courant INTEGER;
  numero_suivant INTEGER;
  reference_finale TEXT;
BEGIN
  annee_courante := EXTRACT(YEAR FROM CURRENT_DATE);
  mois_courant := EXTRACT(MONTH FROM CURRENT_DATE);
  
  -- Insert or update sequence for current year
  INSERT INTO public.references_factures (annee, dernier_numero)
  VALUES (annee_courante, 1)
  ON CONFLICT (annee)
  DO UPDATE SET 
    dernier_numero = references_factures.dernier_numero + 1,
    updated_at = now()
  RETURNING dernier_numero INTO numero_suivant;
  
  -- Format: YRG YY/MM
  reference_finale := 'YRG ' || 
    RIGHT(annee_courante::TEXT, 2) || '/' || 
    LPAD(mois_courant::TEXT, 2, '0');
  
  RETURN reference_finale;
END;
$$;

-- 5. Function to auto-generate reference on facture creation
CREATE OR REPLACE FUNCTION public.auto_generer_reference_facture()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := generer_reference_facture();
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Create trigger for auto-generating references
DROP TRIGGER IF EXISTS trigger_auto_reference_facture ON public.factures;
CREATE TRIGGER trigger_auto_reference_facture
  BEFORE INSERT ON public.factures
  FOR EACH ROW
  EXECUTE FUNCTION auto_generer_reference_facture();

-- 7. Add reference column to factures if it doesn't exist
ALTER TABLE public.factures 
ADD COLUMN IF NOT EXISTS reference TEXT;