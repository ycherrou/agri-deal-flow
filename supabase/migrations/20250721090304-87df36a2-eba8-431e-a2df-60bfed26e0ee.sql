-- Ajouter une politique permettant aux admins de modifier tous les clients
CREATE POLICY "Admins can update all client profiles"
ON public.clients
FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'admin'::user_role);