-- Permettre aux clients de voir les ventes qui sont listées en revente secondaire
CREATE POLICY "Les clients peuvent voir les ventes listées en revente secondaire"
ON public.ventes
FOR SELECT
USING (
  id IN (
    SELECT vente_id
    FROM public.reventes_clients
    WHERE etat = ANY (ARRAY['en_attente'::revente_status, 'valide'::revente_status])
  )
);