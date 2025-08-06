-- Allow users to view sales details for validated market reventes
CREATE POLICY "Users can view ventes details for validated market reventes" 
ON public.ventes
FOR SELECT 
TO authenticated
USING (
  id IN (
    SELECT vente_id 
    FROM public.reventes_clients 
    WHERE etat = 'en_attente'::revente_status 
    AND validated_by_admin = true
  )
);