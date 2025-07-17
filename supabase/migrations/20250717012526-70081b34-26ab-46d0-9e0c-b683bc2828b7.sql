-- Créer une nouvelle politique pour permettre aux clients de voir les ventes liées aux offres du marché secondaire en attente
CREATE POLICY "Users can view ventes for secondary market offers" 
ON public.ventes 
FOR SELECT 
TO authenticated 
USING (
  (auth.uid() IS NOT NULL) 
  AND (id IN (
    SELECT vente_id 
    FROM reventes_clients 
    WHERE etat = 'en_attente'::revente_status 
    AND validated_by_admin = true
  ))
);