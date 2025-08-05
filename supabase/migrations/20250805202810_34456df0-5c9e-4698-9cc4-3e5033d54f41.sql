-- Fix the infinite recursion on ventes table

-- Drop ALL existing policies on ventes that could cause recursion
DROP POLICY IF EXISTS "Admins can manage all ventes" ON public.ventes;
DROP POLICY IF EXISTS "Admins can view all ventes" ON public.ventes;
DROP POLICY IF EXISTS "Clients can view their own ventes" ON public.ventes;
DROP POLICY IF EXISTS "Public can view secondary market ventes" ON public.ventes;

-- Create simple, non-recursive policies for ventes
CREATE POLICY "Users can view their own ventes" ON public.ventes
FOR SELECT USING (
  client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all ventes" ON public.ventes
FOR ALL USING (public.is_admin());

CREATE POLICY "Users can view validated secondary market ventes" ON public.ventes
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  id IN (
    SELECT vente_id FROM public.reventes_clients 
    WHERE validated_by_admin = true
  )
);

-- Fix couvertures policies to avoid recursion
DROP POLICY IF EXISTS "Clients can view couvertures for their ventes" ON public.couvertures;

CREATE POLICY "Users can view their own couvertures" ON public.couvertures
FOR SELECT USING (
  vente_id IN (
    SELECT id FROM public.ventes v 
    WHERE v.client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  ) OR vente_id IS NULL
);

CREATE POLICY "Admins can manage all couvertures" ON public.couvertures
FOR ALL USING (public.is_admin());