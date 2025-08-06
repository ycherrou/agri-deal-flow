-- Create policy to allow admins to update reventes
CREATE POLICY "Admins can update reventes for validation" 
ON public.reventes_clients
FOR UPDATE 
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');