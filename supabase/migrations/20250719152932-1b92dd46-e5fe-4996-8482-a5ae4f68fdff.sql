
-- Ajouter le type de position aux reventes
ALTER TABLE public.reventes_clients 
ADD COLUMN type_position text DEFAULT 'non_couverte' CHECK (type_position IN ('couverte', 'non_couverte'));

-- Mettre à jour les reventes existantes pour les marquer comme non couvertes par défaut
UPDATE public.reventes_clients 
SET type_position = 'non_couverte' 
WHERE type_position IS NULL;

-- Rendre la colonne non nullable maintenant qu'elle a des valeurs
ALTER TABLE public.reventes_clients 
ALTER COLUMN type_position SET NOT NULL;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN public.reventes_clients.type_position IS 'Type de position vendue: couverte (avec futures) ou non_couverte (prime seule)';
