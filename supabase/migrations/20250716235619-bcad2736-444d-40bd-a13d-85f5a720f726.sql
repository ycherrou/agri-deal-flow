-- Supprimer l'ancienne politique restrictive et créer une nouvelle
DROP POLICY IF EXISTS "Authenticated users can view validated reventes" ON reventes_clients;

-- Nouvelle politique pour que tous les utilisateurs authentifiés voient les reventes validées
CREATE POLICY "All authenticated users can view validated reventes on market" 
ON reventes_clients 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND etat = 'vendu' 
  AND validated_by_admin = true
);