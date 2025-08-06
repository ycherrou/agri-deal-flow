-- Create policy to allow admins to view pending reventes for validation
CREATE POLICY "Admins can view pending reventes for validation" 
ON public.reventes_clients
FOR SELECT 
USING (
  public.get_user_role() = 'admin' AND etat = 'en_attente'::revente_status
);