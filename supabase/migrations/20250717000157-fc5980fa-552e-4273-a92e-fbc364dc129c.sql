-- Créer une fonction security definer pour vérifier si un client peut être vu sur le marché secondaire
CREATE OR REPLACE FUNCTION public.is_client_visible_on_market(client_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM ventes v
    JOIN reventes_clients r ON v.id = r.vente_id
    WHERE v.client_id = client_id_param
    AND r.etat = 'vendu' 
    AND r.validated_by_admin = true
  );
$$;

-- Créer une nouvelle politique en utilisant cette fonction
CREATE POLICY "Users can view seller profiles on secondary market" 
ON clients 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND (
    user_id = auth.uid() -- Toujours permettre de voir son propre profil
    OR get_current_user_role() = 'admin'::user_role -- Les admins voient tout
    OR is_client_visible_on_market(id) -- Ou si le client vend sur le marché secondaire
  )
);