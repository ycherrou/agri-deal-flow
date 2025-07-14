-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('admin', 'client');

-- Create products enum
CREATE TYPE public.product_type AS ENUM ('mais', 'tourteau_soja', 'ble', 'orge');

-- Create deal types enum
CREATE TYPE public.deal_type AS ENUM ('prime', 'flat');

-- Create revente status enum
CREATE TYPE public.revente_status AS ENUM ('en_attente', 'vendu', 'retire');

-- Create clients table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'client',
    email TEXT,
    telephone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create navires table
CREATE TABLE public.navires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    produit product_type NOT NULL,
    quantite_totale DECIMAL(10,2) NOT NULL, -- en MT
    prime_achat DECIMAL(8,2), -- en cts/bu
    date_arrivee DATE NOT NULL,
    fournisseur TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ventes table
CREATE TABLE public.ventes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navire_id UUID NOT NULL REFERENCES public.navires(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    type_deal deal_type NOT NULL,
    prime_vente DECIMAL(8,2), -- cts/bu, nullable
    prix_flat DECIMAL(8,2), -- USD/MT, nullable
    volume DECIMAL(10,2) NOT NULL, -- MT
    date_deal DATE NOT NULL DEFAULT CURRENT_DATE,
    prix_reference TEXT, -- ex: 'ZCZ24'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Constraints
    CONSTRAINT check_deal_type_price CHECK (
        (type_deal = 'prime' AND prime_vente IS NOT NULL AND prix_flat IS NULL) OR
        (type_deal = 'flat' AND prix_flat IS NOT NULL AND prime_vente IS NULL)
    )
);

-- Create couvertures table
CREATE TABLE public.couvertures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vente_id UUID NOT NULL REFERENCES public.ventes(id) ON DELETE CASCADE,
    volume_couvert DECIMAL(10,2) NOT NULL, -- MT
    prix_futures DECIMAL(8,2) NOT NULL, -- cts/bu
    date_couverture DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create reventes_clients table
CREATE TABLE public.reventes_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vente_id UUID NOT NULL REFERENCES public.ventes(id) ON DELETE CASCADE,
    volume DECIMAL(10,2) NOT NULL, -- MT
    prix_flat_demande DECIMAL(8,2) NOT NULL, -- USD/MT
    date_revente DATE NOT NULL DEFAULT CURRENT_DATE,
    etat revente_status NOT NULL DEFAULT 'en_attente',
    commentaire TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create prix_marche table for CBOT prices
CREATE TABLE public.prix_marche (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    echeance TEXT NOT NULL, -- ex: 'ZCZ24'
    prix DECIMAL(8,2) NOT NULL, -- cts/bu
    date_maj DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    UNIQUE(echeance, date_maj)
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couvertures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reventes_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prix_marche ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
    SELECT role FROM public.clients WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies for clients
CREATE POLICY "Users can view their own client profile" ON public.clients
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own client profile" ON public.clients
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can view all client profiles" ON public.clients
    FOR SELECT USING (public.get_current_user_role() = 'admin');

-- RLS Policies for navires
CREATE POLICY "Authenticated users can view navires" ON public.navires
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage navires" ON public.navires
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- RLS Policies for ventes
CREATE POLICY "Clients can view their own ventes" ON public.ventes
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

CREATE POLICY "Admins can manage all ventes" ON public.ventes
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- RLS Policies for couvertures
CREATE POLICY "Clients can view couvertures for their ventes" ON public.couvertures
    FOR SELECT USING (
        vente_id IN (
            SELECT id FROM public.ventes WHERE client_id IN (
                SELECT id FROM public.clients WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Admins can manage all couvertures" ON public.couvertures
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- RLS Policies for reventes_clients
CREATE POLICY "Clients can view their own reventes" ON public.reventes_clients
    FOR SELECT USING (
        vente_id IN (
            SELECT id FROM public.ventes WHERE client_id IN (
                SELECT id FROM public.clients WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Clients can create reventes for their ventes" ON public.reventes_clients
    FOR INSERT WITH CHECK (
        vente_id IN (
            SELECT id FROM public.ventes WHERE client_id IN (
                SELECT id FROM public.clients WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Admins can manage all reventes" ON public.reventes_clients
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- RLS Policies for prix_marche
CREATE POLICY "Authenticated users can view prix_marche" ON public.prix_marche
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage prix_marche" ON public.prix_marche
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_navires_updated_at
    BEFORE UPDATE ON public.navires
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ventes_updated_at
    BEFORE UPDATE ON public.ventes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_couvertures_updated_at
    BEFORE UPDATE ON public.couvertures
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reventes_clients_updated_at
    BEFORE UPDATE ON public.reventes_clients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prix_marche_updated_at
    BEFORE UPDATE ON public.prix_marche
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create client profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.clients (user_id, nom, role, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nom', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client'),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();