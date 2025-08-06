-- Remove the problematic policy that caused infinite recursion
DROP POLICY IF EXISTS "Users can view ventes details for validated market reventes" ON public.ventes;