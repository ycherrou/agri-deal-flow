-- Drop the current policy
DROP POLICY IF EXISTS "Admins can view pending reventes for validation" ON public.reventes_clients;

-- Create the corrected policy that includes the validated_by_admin filter
CREATE POLICY "Admins can view pending reventes for validation" 
ON public.reventes_clients
FOR SELECT 
USING (
  public.get_user_role() = 'admin' 
  AND etat = 'en_attente'::revente_status 
  AND validated_by_admin = false
);