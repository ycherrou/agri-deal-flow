-- Ajout de tous les autres champs manquants identifiés dans les erreurs TypeScript

-- Ajout de champs dans navires
ALTER TABLE public.navires ADD COLUMN IF NOT EXISTS terme_commercial TEXT;

-- Ajout de champs dans reventes_clients
ALTER TABLE public.reventes_clients ADD COLUMN IF NOT EXISTS type_position TEXT;

-- Ajout de champs dans transactions_marche_secondaire
ALTER TABLE public.transactions_marche_secondaire ADD COLUMN IF NOT EXISTS prix_achat_original DECIMAL(8,2);
ALTER TABLE public.transactions_marche_secondaire ADD COLUMN IF NOT EXISTS prix_vente_final DECIMAL(8,2);
ALTER TABLE public.transactions_marche_secondaire ADD COLUMN IF NOT EXISTS volume_transige DECIMAL(10,2);
ALTER TABLE public.transactions_marche_secondaire ADD COLUMN IF NOT EXISTS gain_vendeur DECIMAL(10,2);

-- Ajout de champs dans ventes
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS parent_deal_id UUID REFERENCES public.ventes(id);

-- Ajout du champ volume_couvert dans couvertures_achat
ALTER TABLE public.couvertures_achat ADD COLUMN IF NOT EXISTS volume_couvert DECIMAL(10,2);