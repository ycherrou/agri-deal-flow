-- Permettre aux utilisateurs authentifiés de voir les profils des clients vendeurs sur le marché secondaire
CREATE POLICY "Users can view seller profiles on secondary market" 
ON clients 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND id IN (
    SELECT v.client_id 
    FROM ventes v
    JOIN reventes_clients r ON v.id = r.vente_id
    WHERE r.etat = 'vendu' 
    AND r.validated_by_admin = true
  )
);