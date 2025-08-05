-- Fix the security issue by using clients table instead of user_metadata
DROP POLICY IF EXISTS "Admins can manage all ventes" ON public.ventes;

-- Create admin policy using clients table instead of user_metadata
CREATE POLICY "Admins can manage all ventes" ON public.ventes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);