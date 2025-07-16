-- Add new status to revente_status enum
ALTER TYPE revente_status ADD VALUE IF NOT EXISTS 'en_attente_validation';

-- Add new columns to reventes_clients table
ALTER TABLE public.reventes_clients 
ADD COLUMN IF NOT EXISTS date_expiration_validation TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS validated_by_admin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_validation_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.clients(id);

-- Create bids_marche_secondaire table
CREATE TABLE IF NOT EXISTS public.bids_marche_secondaire (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    revente_id UUID NOT NULL REFERENCES public.reventes_clients(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    prix_bid NUMERIC NOT NULL,
    volume_bid NUMERIC NOT NULL,
    date_bid TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    statut TEXT NOT NULL DEFAULT 'active' CHECK (statut IN ('active', 'acceptee', 'rejetee')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on bids_marche_secondaire
ALTER TABLE public.bids_marche_secondaire ENABLE ROW LEVEL SECURITY;

-- Create policies for bids_marche_secondaire
CREATE POLICY "Admins can manage all bids" 
ON public.bids_marche_secondaire 
FOR ALL 
USING (get_current_user_role() = 'admin'::user_role);

CREATE POLICY "Clients can view bids for their reventes" 
ON public.bids_marche_secondaire 
FOR SELECT 
USING (
    revente_id IN (
        SELECT r.id 
        FROM reventes_clients r 
        JOIN ventes v ON r.vente_id = v.id 
        JOIN clients c ON v.client_id = c.id 
        WHERE c.user_id = auth.uid()
    )
);

CREATE POLICY "Clients can create bids" 
ON public.bids_marche_secondaire 
FOR INSERT 
WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Clients can view their own bids" 
ON public.bids_marche_secondaire 
FOR SELECT 
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Create trigger for updated_at on bids_marche_secondaire
CREATE TRIGGER update_bids_marche_secondaire_updated_at
BEFORE UPDATE ON public.bids_marche_secondaire
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update RLS policy for reventes_clients to include new statuses
DROP POLICY IF EXISTS "Clients can view their own reventes" ON public.reventes_clients;
CREATE POLICY "Clients can view their own reventes" 
ON public.reventes_clients 
FOR SELECT 
USING (
    vente_id IN (
        SELECT ventes.id
        FROM ventes
        WHERE ventes.client_id IN (
            SELECT clients.id
            FROM clients
            WHERE clients.user_id = auth.uid()
        )
    )
);

-- Allow clients to view validated reventes on secondary market
CREATE POLICY "Authenticated users can view validated reventes" 
ON public.reventes_clients 
FOR SELECT 
USING (
    auth.uid() IS NOT NULL 
    AND etat = 'vendu'::revente_status 
    AND validated_by_admin = true
);