-- Completely remove all RLS policies for ventes table and recreate them safely
DROP POLICY IF EXISTS "Admins can manage all ventes" ON public.ventes;
DROP POLICY IF EXISTS "Clients can view their own ventes" ON public.ventes;
DROP POLICY IF EXISTS "Users can view ventes with active reventes" ON public.ventes;
DROP POLICY IF EXISTS "Users can view ventes with sold reventes" ON public.ventes;

-- Create simple, non-recursive policies
-- Policy 1: Admins can manage everything (using direct user metadata check)
CREATE POLICY "Admins can manage all ventes" ON public.ventes
FOR ALL USING (
  (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
);

-- Policy 2: Users can view their own ventes (direct client_id check)
CREATE POLICY "Clients can view their own ventes" ON public.ventes
FOR SELECT USING (
  client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
);

-- Policy 3: Allow viewing ventes for secondary market (simple direct check)
CREATE POLICY "Public can view secondary market ventes" ON public.ventes
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  id IN (
    SELECT vente_id FROM public.reventes_clients 
    WHERE validated_by_admin = true
  )
);