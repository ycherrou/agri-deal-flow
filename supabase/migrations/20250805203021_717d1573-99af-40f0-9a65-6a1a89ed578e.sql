-- Force drop all policies and function

-- First, force drop all policies that depend on is_admin function
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.clients;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.clients;
DROP POLICY IF EXISTS "Admins can manage navires" ON public.navires;
DROP POLICY IF EXISTS "Admins can manage whatsapp templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Admins can manage all ventes" ON public.ventes;
DROP POLICY IF EXISTS "Admins can manage all couvertures" ON public.couvertures;

-- Drop any remaining policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view navires" ON public.navires;
DROP POLICY IF EXISTS "Users can view their own ventes" ON public.ventes;
DROP POLICY IF EXISTS "Users can view validated secondary market ventes" ON public.ventes;
DROP POLICY IF EXISTS "Users can view their own couvertures" ON public.couvertures;
DROP POLICY IF EXISTS "Authenticated users can view prix_marche" ON public.prix_marche;
DROP POLICY IF EXISTS "Authenticated users can view echeances" ON public.echeances;

-- Now drop the function
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- Create ultra-simple policies that cannot cause recursion

-- Clients table - simple user access only
CREATE POLICY "Allow own profile access" ON public.clients
FOR ALL USING (user_id = auth.uid());

-- Navires table - allow all authenticated users to view
CREATE POLICY "All authenticated can view navires" ON public.navires
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Ventes table - allow users to see their own sales only  
CREATE POLICY "Own ventes only" ON public.ventes
FOR SELECT USING (
  client_id = (
    SELECT id FROM public.clients 
    WHERE user_id = auth.uid() 
    LIMIT 1
  )
);

-- Couvertures table - allow users to see couvertures for their sales
CREATE POLICY "Own couvertures only" ON public.couvertures
FOR SELECT USING (
  vente_id IN (
    SELECT id FROM public.ventes 
    WHERE client_id = (
      SELECT id FROM public.clients 
      WHERE user_id = auth.uid() 
      LIMIT 1
    )
  ) OR vente_id IS NULL
);

-- Essential read-only tables
CREATE POLICY "All can view prix_marche" ON public.prix_marche
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All can view echeances" ON public.echeances
FOR SELECT USING (auth.uid() IS NOT NULL);

-- WhatsApp templates - view only for authenticated users
CREATE POLICY "All can view templates" ON public.whatsapp_templates
FOR SELECT USING (auth.uid() IS NOT NULL);