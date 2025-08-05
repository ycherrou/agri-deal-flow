-- Comprehensive RLS repair to fix infinite recursion issues

-- 1. Drop ALL existing policies on clients table to start fresh
DROP POLICY IF EXISTS "Admins can view all client profiles" ON public.clients;
DROP POLICY IF EXISTS "Admins can update all client profiles" ON public.clients;
DROP POLICY IF EXISTS "Users can view their own client profile" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own client profile" ON public.clients;

-- 2. Drop existing policies that may conflict
DROP POLICY IF EXISTS "Authenticated users can view prix_marche" ON public.prix_marche;
DROP POLICY IF EXISTS "Authenticated users can view active echeances" ON public.echeances;
DROP POLICY IF EXISTS "Admins can view all ventes" ON public.ventes;
DROP POLICY IF EXISTS "Admins can manage navires" ON public.navires;

-- 3. Create simple, non-recursive policies for clients table
CREATE POLICY "Users can view their own profile" ON public.clients
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.clients
FOR UPDATE USING (user_id = auth.uid());

-- 4. Create security definer function to safely check admin role
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients 
    WHERE user_id = user_uuid AND role = 'admin'
  );
$$;

-- 5. Create admin policies using the security definer function
CREATE POLICY "Admins can view all profiles" ON public.clients
FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all profiles" ON public.clients
FOR UPDATE USING (public.is_admin());

-- 6. Fix navires policies to use the security definer function
CREATE POLICY "Admins can manage navires" ON public.navires
FOR ALL USING (public.is_admin());

-- 7. Add missing policy for whatsapp_templates
CREATE POLICY "Admins can manage whatsapp templates" ON public.whatsapp_templates
FOR ALL USING (public.is_admin());

-- 8. Fix ventes policies
CREATE POLICY "Admins can view all ventes" ON public.ventes
FOR ALL USING (public.is_admin());

-- 9. Ensure basic authenticated access for essential tables
CREATE POLICY "Authenticated users can view prix_marche" ON public.prix_marche
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view echeances" ON public.echeances
FOR SELECT USING (auth.uid() IS NOT NULL);