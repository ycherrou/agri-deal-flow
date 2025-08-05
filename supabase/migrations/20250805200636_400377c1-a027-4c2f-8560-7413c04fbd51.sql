-- Ajouter une politique pour permettre aux clients de voir leurs propres reventes vendues
CREATE POLICY "Clients can view their own sold reventes" 
ON public.reventes_clients 
FOR SELECT 
USING (
  vente_id IN (
    SELECT ventes.id 
    FROM ventes 
    WHERE ventes.client_id IN (
      SELECT clients.id 
      FROM clients 
      WHERE clients.user_id = auth.uid()
    )
  )
);