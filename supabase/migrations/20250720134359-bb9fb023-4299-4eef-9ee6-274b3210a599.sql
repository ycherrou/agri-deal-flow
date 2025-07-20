
-- Ajouter une politique RLS pour empêcher qu'un vendeur fasse une offre sur son propre lot
CREATE POLICY "Clients cannot bid on their own positions"
ON public.bids_marche_secondaire
FOR INSERT
WITH CHECK (
  client_id NOT IN (
    SELECT v.client_id 
    FROM reventes_clients r
    JOIN ventes v ON r.vente_id = v.id
    WHERE r.id = revente_id
  )
);
