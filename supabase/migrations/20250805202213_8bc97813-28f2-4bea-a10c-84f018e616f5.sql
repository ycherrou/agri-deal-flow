-- Step 2: Recreate essential policies without recursion
-- Focus on the most critical ones first

-- 1. Navires - Essential for viewing ships
CREATE POLICY "Admins can manage navires" ON public.navires
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clients WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Authenticated users can view navires" ON public.navires
FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2. Clients - Essential for user management
CREATE POLICY "Admins can view all client profiles" ON public.clients
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = auth.uid() AND c.role = 'admin')
);

CREATE POLICY "Users can view their own client profile" ON public.clients
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can update all client profiles" ON public.clients
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = auth.uid() AND c.role = 'admin')
);

CREATE POLICY "Users can update their own client profile" ON public.clients
FOR UPDATE USING (user_id = auth.uid());

-- 3. Couvertures - Essential for coverage management
CREATE POLICY "Admins can manage all couvertures" ON public.couvertures
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clients WHERE user_id = auth.uid() AND role = 'admin')
);

-- 4. Prix marche - Essential for market prices
CREATE POLICY "Admins can manage prix_marche" ON public.prix_marche
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clients WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. Echeances - Essential for market data
CREATE POLICY "Admins can manage all echeances" ON public.echeances
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clients WHERE user_id = auth.uid() AND role = 'admin')
);