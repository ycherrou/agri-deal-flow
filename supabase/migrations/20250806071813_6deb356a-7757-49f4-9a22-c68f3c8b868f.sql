-- Remove all the policies that are causing infinite recursion
DROP POLICY IF EXISTS "Users can view ventes on secondary market" ON public.ventes;
DROP POLICY IF EXISTS "Users can view navires on secondary market" ON public.navires;
DROP POLICY IF EXISTS "Users can view clients on secondary market" ON public.clients;