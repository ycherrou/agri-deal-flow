-- Fix critical security issue: Enable RLS on references_factures table
ALTER TABLE public.references_factures ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for references_factures table
CREATE POLICY "Admins can manage references"
ON public.references_factures
FOR ALL
USING (get_current_user_role() = 'admin'::user_role);

CREATE POLICY "Authenticated users can view references"
ON public.references_factures
FOR SELECT
USING (auth.uid() IS NOT NULL);