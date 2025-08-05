-- Check and recreate only missing essential policies

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view navires" ON public.navires;
DROP POLICY IF EXISTS "Users can view their own client profile" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own client profile" ON public.clients;

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