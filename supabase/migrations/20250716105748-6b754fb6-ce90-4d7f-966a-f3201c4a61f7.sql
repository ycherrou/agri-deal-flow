-- Ajouter le champ parent_deal_id pour la traçabilité des deals rollés
ALTER TABLE public.ventes 
ADD COLUMN parent_deal_id UUID REFERENCES public.ventes(id) ON DELETE SET NULL;