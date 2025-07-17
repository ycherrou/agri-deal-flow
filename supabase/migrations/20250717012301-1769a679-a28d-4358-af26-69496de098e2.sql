-- Modifier la politique RLS pour permettre aux clients de voir les offres validées en attente
DROP POLICY "All authenticated users can view validated reventes on market" ON public.reventes_clients;

CREATE POLICY "All authenticated users can view validated reventes on market" 
ON public.reventes_clients 
FOR SELECT 
TO authenticated 
USING (
  (auth.uid() IS NOT NULL) 
  AND (etat = 'en_attente'::revente_status) 
  AND (validated_by_admin = true)
);