-- Create sequences table for invoice numbering
CREATE TABLE public.sequences_factures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annee INTEGER NOT NULL,
  type_facture TEXT NOT NULL CHECK (type_facture IN ('proforma', 'commerciale', 'regularisation')),
  dernier_numero INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(annee, type_facture)
);

-- Create invoices table
CREATE TABLE public.factures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_facture TEXT NOT NULL UNIQUE,
  vente_id UUID REFERENCES public.ventes(id),
  client_id UUID NOT NULL,
  type_facture TEXT NOT NULL CHECK (type_facture IN ('proforma', 'commerciale', 'regularisation')),
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'envoyee', 'payee', 'annulee')),
  date_facture DATE NOT NULL DEFAULT CURRENT_DATE,
  date_echeance DATE,
  montant_total NUMERIC NOT NULL DEFAULT 0,
  devise TEXT NOT NULL DEFAULT 'USD',
  taux_change NUMERIC DEFAULT 1,
  conditions_paiement TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice lines table
CREATE TABLE public.lignes_facture (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facture_id UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantite NUMERIC NOT NULL,
  prix_unitaire NUMERIC NOT NULL,
  montant_ligne NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.paiements_factures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facture_id UUID NOT NULL REFERENCES public.factures(id),
  montant_paye NUMERIC NOT NULL,
  date_paiement DATE NOT NULL,
  methode_paiement TEXT NOT NULL CHECK (methode_paiement IN ('lettre_credit', 'cash_against_documents', 'virement', 'autre')),
  reference_paiement TEXT,
  notes TEXT,
  finance_update_processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION public.generer_numero_facture(type_facture_param TEXT)
RETURNS TEXT AS $$
DECLARE
  annee_courante INTEGER;
  prefixe TEXT;
  numero_suivant INTEGER;
  numero_formate TEXT;
BEGIN
  annee_courante := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Determine prefix based on invoice type
  CASE type_facture_param
    WHEN 'proforma' THEN prefixe := 'PRO';
    WHEN 'commerciale' THEN prefixe := 'FAC';
    WHEN 'regularisation' THEN prefixe := 'REG';
    ELSE RAISE EXCEPTION 'Type de facture invalide: %', type_facture_param;
  END CASE;
  
  -- Insert or update sequence for current year and type
  INSERT INTO public.sequences_factures (annee, type_facture, dernier_numero)
  VALUES (annee_courante, type_facture_param, 1)
  ON CONFLICT (annee, type_facture)
  DO UPDATE SET 
    dernier_numero = sequences_factures.dernier_numero + 1,
    updated_at = now()
  RETURNING dernier_numero INTO numero_suivant;
  
  -- Format: YYYY-PRO-001
  numero_formate := annee_courante::TEXT || '-' || prefixe || '-' || LPAD(numero_suivant::TEXT, 3, '0');
  
  RETURN numero_formate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to auto-generate invoice number
CREATE OR REPLACE FUNCTION public.auto_generer_numero_facture()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_facture IS NULL OR NEW.numero_facture = '' THEN
    NEW.numero_facture := generer_numero_facture(NEW.type_facture);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-numbering
CREATE TRIGGER trigger_auto_numero_facture
  BEFORE INSERT ON public.factures
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generer_numero_facture();

-- Create trigger for updated_at
CREATE TRIGGER update_factures_updated_at
  BEFORE UPDATE ON public.factures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sequences_factures_updated_at
  BEFORE UPDATE ON public.sequences_factures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_paiements_factures_updated_at
  BEFORE UPDATE ON public.paiements_factures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.sequences_factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lignes_facture ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements_factures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sequences_factures
CREATE POLICY "Admins can manage invoice sequences" 
ON public.sequences_factures FOR ALL 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Authenticated users can view sequences" 
ON public.sequences_factures FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- RLS Policies for factures
CREATE POLICY "Admins can manage all invoices" 
ON public.factures FOR ALL 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Clients can view their own invoices" 
ON public.factures FOR SELECT 
USING (client_id IN (
  SELECT id FROM public.clients WHERE user_id = auth.uid()
));

-- RLS Policies for lignes_facture
CREATE POLICY "Admins can manage all invoice lines" 
ON public.lignes_facture FOR ALL 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Clients can view their invoice lines" 
ON public.lignes_facture FOR SELECT 
USING (facture_id IN (
  SELECT id FROM public.factures 
  WHERE client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
));

-- RLS Policies for paiements_factures
CREATE POLICY "Admins can manage all payments" 
ON public.paiements_factures FOR ALL 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Clients can view their payments" 
ON public.paiements_factures FOR SELECT 
USING (facture_id IN (
  SELECT id FROM public.factures 
  WHERE client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
));

-- Function to update financing when payment is received
CREATE OR REPLACE FUNCTION public.traiter_paiement_facture(
  paiement_id_param UUID
)
RETURNS VOID AS $$
DECLARE
  paiement_record RECORD;
  facture_record RECORD;
  financement_record RECORD;
  montant_a_liberer NUMERIC;
BEGIN
  -- Get payment record
  SELECT * INTO paiement_record 
  FROM public.paiements_factures 
  WHERE id = paiement_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paiement non trouvé';
  END IF;
  
  -- Get invoice record
  SELECT * INTO facture_record 
  FROM public.factures 
  WHERE id = paiement_record.facture_id;
  
  -- Find related financing if vente_id exists
  IF facture_record.vente_id IS NOT NULL THEN
    SELECT * INTO financement_record 
    FROM public.financements 
    WHERE vente_id = facture_record.vente_id 
    AND statut IN ('actif', 'partiellement_rembourse')
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF FOUND THEN
      -- Calculate amount to release (proportional to payment)
      montant_a_liberer := LEAST(
        paiement_record.montant_paye, 
        financement_record.montant_finance
      );
      
      -- Release financing
      PERFORM liberer_financement(financement_record.id, montant_a_liberer);
      
      -- Mark payment as processed
      UPDATE public.paiements_factures 
      SET 
        finance_update_processed = true,
        updated_at = now()
      WHERE id = paiement_id_param;
    END IF;
  END IF;
  
  -- Update invoice status if fully paid
  IF (SELECT SUM(montant_paye) FROM public.paiements_factures WHERE facture_id = facture_record.id) >= facture_record.montant_total THEN
    UPDATE public.factures 
    SET statut = 'payee', updated_at = now()
    WHERE id = facture_record.id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;