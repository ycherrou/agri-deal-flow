-- Allow all authenticated users to view ventes that are listed on validated secondary market
CREATE POLICY "Users can view ventes on secondary market" 
ON public.ventes
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.reventes_clients 
    WHERE reventes_clients.vente_id = ventes.id
    AND reventes_clients.etat = 'en_attente'::revente_status 
    AND reventes_clients.validated_by_admin = true
  )
);

-- Allow all authenticated users to view navires associated with secondary market ventes
CREATE POLICY "Users can view navires on secondary market" 
ON public.navires
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.ventes v
    JOIN public.reventes_clients r ON v.id = r.vente_id
    WHERE v.navire_id = navires.id
    AND r.etat = 'en_attente'::revente_status 
    AND r.validated_by_admin = true
  )
);

-- Also allow viewing clients associated with secondary market sales
CREATE POLICY "Users can view clients on secondary market" 
ON public.clients
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.ventes v
    JOIN public.reventes_clients r ON v.id = r.vente_id
    WHERE v.client_id = clients.id
    AND r.etat = 'en_attente'::revente_status 
    AND r.validated_by_admin = true
  )
);