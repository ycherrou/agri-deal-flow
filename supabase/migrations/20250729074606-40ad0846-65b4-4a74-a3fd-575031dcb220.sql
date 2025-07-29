-- Create tables for finance module

-- Table for bank credit lines
CREATE TABLE public.lignes_bancaires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  montant_total NUMERIC NOT NULL,
  montant_utilise NUMERIC NOT NULL DEFAULT 0,
  montant_disponible NUMERIC GENERATED ALWAYS AS (montant_total - montant_utilise) STORED,
  taux_interet NUMERIC,
  banque TEXT NOT NULL,
  date_ouverture DATE NOT NULL,
  date_echeance DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for financing records
CREATE TABLE public.financements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vente_id UUID NOT NULL,
  ligne_bancaire_id UUID,
  montant_finance NUMERIC NOT NULL,
  date_financement DATE NOT NULL DEFAULT CURRENT_DATE,
  statut TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'rembourse', 'partiellement_rembourse')),
  commentaire TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for bank movements history
CREATE TABLE public.mouvements_bancaires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ligne_bancaire_id UUID NOT NULL,
  financement_id UUID,
  type_mouvement TEXT NOT NULL CHECK (type_mouvement IN ('allocation', 'liberation', 'remboursement')),
  montant NUMERIC NOT NULL,
  montant_avant NUMERIC NOT NULL,
  montant_apres NUMERIC NOT NULL,
  date_mouvement TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reference TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lignes_bancaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mouvements_bancaires ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lignes_bancaires
CREATE POLICY "Admins can manage all bank lines" 
ON public.lignes_bancaires 
FOR ALL 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Finance users can view bank lines" 
ON public.lignes_bancaires 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- RLS Policies for financements
CREATE POLICY "Admins can manage all financements" 
ON public.financements 
FOR ALL 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Finance users can view financements" 
ON public.financements 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- RLS Policies for mouvements_bancaires
CREATE POLICY "Admins can manage all bank movements" 
ON public.mouvements_bancaires 
FOR ALL 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Finance users can view bank movements" 
ON public.mouvements_bancaires 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Add foreign key constraints
ALTER TABLE public.financements 
ADD CONSTRAINT fk_financements_vente 
FOREIGN KEY (vente_id) REFERENCES public.ventes(id) ON DELETE CASCADE;

ALTER TABLE public.financements 
ADD CONSTRAINT fk_financements_ligne_bancaire 
FOREIGN KEY (ligne_bancaire_id) REFERENCES public.lignes_bancaires(id) ON DELETE SET NULL;

ALTER TABLE public.mouvements_bancaires 
ADD CONSTRAINT fk_mouvements_ligne_bancaire 
FOREIGN KEY (ligne_bancaire_id) REFERENCES public.lignes_bancaires(id) ON DELETE CASCADE;

ALTER TABLE public.mouvements_bancaires 
ADD CONSTRAINT fk_mouvements_financement 
FOREIGN KEY (financement_id) REFERENCES public.financements(id) ON DELETE SET NULL;

-- Add updated_at triggers
CREATE TRIGGER update_lignes_bancaires_updated_at
  BEFORE UPDATE ON public.lignes_bancaires
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financements_updated_at
  BEFORE UPDATE ON public.financements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to allocate financing from bank line
CREATE OR REPLACE FUNCTION public.allouer_financement(
  vente_id_param UUID,
  ligne_bancaire_id_param UUID,
  montant_param NUMERIC,
  commentaire_param TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ligne_record record;
  financement_id UUID;
  movement_id UUID;
BEGIN
  -- Check if bank line has sufficient funds
  SELECT * INTO ligne_record 
  FROM public.lignes_bancaires 
  WHERE id = ligne_bancaire_id_param AND active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ligne bancaire non trouvée ou inactive';
  END IF;
  
  IF ligne_record.montant_disponible < montant_param THEN
    RAISE EXCEPTION 'Fonds insuffisants sur la ligne bancaire. Disponible: %, Demandé: %', 
      ligne_record.montant_disponible, montant_param;
  END IF;
  
  -- Create financing record
  INSERT INTO public.financements (
    vente_id, ligne_bancaire_id, montant_finance, commentaire
  ) VALUES (
    vente_id_param, ligne_bancaire_id_param, montant_param, commentaire_param
  ) RETURNING id INTO financement_id;
  
  -- Update bank line utilization
  UPDATE public.lignes_bancaires 
  SET 
    montant_utilise = montant_utilise + montant_param,
    updated_at = now()
  WHERE id = ligne_bancaire_id_param;
  
  -- Record bank movement
  INSERT INTO public.mouvements_bancaires (
    ligne_bancaire_id, financement_id, type_mouvement, montant,
    montant_avant, montant_apres, description
  ) VALUES (
    ligne_bancaire_id_param, financement_id, 'allocation', montant_param,
    ligne_record.montant_disponible, ligne_record.montant_disponible - montant_param,
    'Allocation de financement pour vente'
  );
  
  RETURN financement_id;
END;
$$;

-- Function to release financing back to bank line
CREATE OR REPLACE FUNCTION public.liberer_financement(
  financement_id_param UUID,
  montant_liberation_param NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  financement_record record;
  ligne_record record;
  montant_liberation NUMERIC;
BEGIN
  -- Get financing record
  SELECT * INTO financement_record 
  FROM public.financements 
  WHERE id = financement_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financement non trouvé';
  END IF;
  
  -- Use provided amount or full financing amount
  montant_liberation := COALESCE(montant_liberation_param, financement_record.montant_finance);
  
  IF montant_liberation > financement_record.montant_finance THEN
    RAISE EXCEPTION 'Montant de libération supérieur au financement';
  END IF;
  
  -- Get current bank line state
  SELECT * INTO ligne_record 
  FROM public.lignes_bancaires 
  WHERE id = financement_record.ligne_bancaire_id;
  
  -- Update bank line
  UPDATE public.lignes_bancaires 
  SET 
    montant_utilise = montant_utilise - montant_liberation,
    updated_at = now()
  WHERE id = financement_record.ligne_bancaire_id;
  
  -- Update financing status
  IF montant_liberation = financement_record.montant_finance THEN
    UPDATE public.financements 
    SET statut = 'rembourse', updated_at = now()
    WHERE id = financement_id_param;
  ELSE
    UPDATE public.financements 
    SET 
      montant_finance = montant_finance - montant_liberation,
      statut = 'partiellement_rembourse',
      updated_at = now()
    WHERE id = financement_id_param;
  END IF;
  
  -- Record bank movement
  INSERT INTO public.mouvements_bancaires (
    ligne_bancaire_id, financement_id, type_mouvement, montant,
    montant_avant, montant_apres, description
  ) VALUES (
    financement_record.ligne_bancaire_id, financement_id_param, 'liberation', montant_liberation,
    ligne_record.montant_disponible, ligne_record.montant_disponible + montant_liberation,
    'Libération de financement'
  );
END;
$$;