-- Debug: Add temporary logging to see what's happening with RLS
-- Let's first check if the current policy is working by testing it directly

-- Create a more specific policy for market viewing
DROP POLICY IF EXISTS "All authenticated users can view validated reventes on market" ON public.reventes_clients;

CREATE POLICY "Market users can view validated reventes" 
ON public.reventes_clients
FOR SELECT 
TO authenticated
USING (
  (auth.uid() IS NOT NULL) 
  AND (etat = 'en_attente'::revente_status) 
  AND (validated_by_admin = true)
);