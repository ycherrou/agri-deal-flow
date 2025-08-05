-- Fix infinite recursion in RLS policies for ventes table
-- Drop the problematic policies that are causing recursion
DROP POLICY IF EXISTS "Users can view ventes for secondary market offers" ON public.ventes;
DROP POLICY IF EXISTS "Users can view ventes on secondary market" ON public.ventes;

-- Recreate policies without recursion using EXISTS clauses
CREATE POLICY "Users can view ventes with active reventes" ON public.ventes
FOR SELECT USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.reventes_clients r 
    WHERE r.vente_id = ventes.id 
    AND r.etat = 'en_attente'::revente_status 
    AND r.validated_by_admin = true
  )
);

CREATE POLICY "Users can view ventes with sold reventes" ON public.ventes  
FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.reventes_clients r
    WHERE r.vente_id = ventes.id
    AND r.etat = 'vendu'::revente_status
    AND r.validated_by_admin = true
  )
);