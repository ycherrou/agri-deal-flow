-- Create policy to allow admins to view all ventes
CREATE POLICY "Admins can view all ventes" 
ON public.ventes
FOR SELECT 
USING (public.get_user_role() = 'admin');