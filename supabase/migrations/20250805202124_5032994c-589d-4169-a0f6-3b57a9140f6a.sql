-- Replace ALL instances of get_current_user_role() to prevent infinite recursion
-- This is the root cause of the problem

-- First, drop the problematic function entirely
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- Update all policies that used get_current_user_role() to use direct client table check

-- 1. Clients table policies
DROP POLICY IF EXISTS "Admins can view all client profiles" ON public.clients;
DROP POLICY IF EXISTS "Admins can update all client profiles" ON public.clients;
DROP POLICY IF EXISTS "Users can view seller profiles on secondary market" ON public.clients;

CREATE POLICY "Admins can view all client profiles" ON public.clients
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = auth.uid() AND c.role = 'admin')
);

CREATE POLICY "Admins can update all client profiles" ON public.clients
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = auth.uid() AND c.role = 'admin')
);

CREATE POLICY "Users can view seller profiles on secondary market" ON public.clients
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = auth.uid() AND c.role = 'admin') OR
    is_client_visible_on_market(id)
  )
);

-- 2. Navires table
DROP POLICY IF EXISTS "Admins can manage navires" ON public.navires;
CREATE POLICY "Admins can manage navires" ON public.navires
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clients WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. Couvertures table
DROP POLICY IF EXISTS "Admins can manage all couvertures" ON public.couvertures;
CREATE POLICY "Admins can manage all couvertures" ON public.couvertures
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clients WHERE user_id = auth.uid() AND role = 'admin')
);

-- 4. Reventes_clients table
DROP POLICY IF EXISTS "Admins can manage all reventes" ON public.reventes_clients;
CREATE POLICY "Admins can manage all reventes" ON public.reventes_clients
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clients WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. Prix_marche table
DROP POLICY IF EXISTS "Admins can manage prix_marche" ON public.prix_marche;
CREATE POLICY "Admins can manage prix_marche" ON public.prix_marche
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clients WHERE user_id = auth.uid() AND role = 'admin')
);