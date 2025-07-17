-- Ajouter un champ pour tracker si le P&L a été payé au client
ALTER TABLE public.transactions_marche_secondaire 
ADD COLUMN pnl_paye BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN date_paiement_pnl TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN admin_paiement_id UUID NULL;

-- Ajouter un commentaire pour expliquer l'usage
COMMENT ON COLUMN public.transactions_marche_secondaire.pnl_paye IS 'Indique si le P&L de la transaction a été payé au client vendeur';
COMMENT ON COLUMN public.transactions_marche_secondaire.date_paiement_pnl IS 'Date à laquelle le P&L a été marqué comme payé';
COMMENT ON COLUMN public.transactions_marche_secondaire.admin_paiement_id IS 'ID de l''admin qui a marqué le paiement comme effectué';