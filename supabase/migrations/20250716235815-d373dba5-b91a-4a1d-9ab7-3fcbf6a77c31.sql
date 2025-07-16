-- Ajouter une politique pour permettre aux clients de voir les ventes associées aux reventes validées
CREATE POLICY "Users can view ventes on secondary market" 
ON ventes 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND id IN (
    SELECT vente_id 
    FROM reventes_clients 
    WHERE etat = 'vendu' 
    AND validated_by_admin = true
  )
);