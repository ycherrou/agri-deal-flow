-- Create a secure function to check if user is admin
-- This function uses SECURITY DEFINER to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role::text 
  FROM public.clients 
  WHERE user_id = user_uuid
  LIMIT 1;
$$;

-- Drop existing clients policy
DROP POLICY IF EXISTS "Allow own profile access" ON public.clients;

-- Create new policy that allows admins to see all clients
CREATE POLICY "Clients access policy" ON public.clients
FOR ALL USING (
  user_id = auth.uid() OR 
  public.get_user_role() = 'admin'
);