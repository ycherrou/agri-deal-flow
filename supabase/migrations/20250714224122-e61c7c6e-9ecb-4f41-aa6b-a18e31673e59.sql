-- Ajouter un champ pour la référence CBOT dans les navires
ALTER TABLE public.navires 
ADD COLUMN reference_cbot text;

-- Ajouter un commentaire pour expliquer l'usage
COMMENT ON COLUMN public.navires.reference_cbot IS 'Référence du contrat CBOT utilisé pour la prime d achat (ex: ZCZ24)';
COMMENT ON COLUMN public.ventes.prix_reference IS 'Référence du contrat CBOT utilisé pour la prime de vente (ex: ZCZ24)';