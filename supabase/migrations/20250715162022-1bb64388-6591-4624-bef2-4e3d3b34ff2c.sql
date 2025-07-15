-- Créer la table des échéances
CREATE TABLE public.echeances (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nom TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activer RLS sur la table échéances
ALTER TABLE public.echeances ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS pour les échéances
CREATE POLICY "Admins can manage all echeances" 
ON public.echeances 
FOR ALL 
USING (get_current_user_role() = 'admin'::user_role);

CREATE POLICY "Authenticated users can view active echeances" 
ON public.echeances 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND active = true);

-- Insérer les échéances existantes depuis prix_marche
INSERT INTO public.echeances (nom, active)
SELECT DISTINCT echeance, true
FROM public.prix_marche
WHERE echeance IS NOT NULL;

-- Ajouter la colonne echeance_id à prix_marche
ALTER TABLE public.prix_marche 
ADD COLUMN echeance_id UUID;

-- Mettre à jour les références dans prix_marche
UPDATE public.prix_marche 
SET echeance_id = echeances.id
FROM public.echeances
WHERE public.prix_marche.echeance = echeances.nom;

-- Créer la contrainte de clé étrangère
ALTER TABLE public.prix_marche 
ADD CONSTRAINT fk_prix_marche_echeance 
FOREIGN KEY (echeance_id) REFERENCES public.echeances(id);

-- Supprimer l'ancienne colonne echeance (après avoir vérifié que echeance_id est bien rempli)
ALTER TABLE public.prix_marche DROP COLUMN echeance;

-- Supprimer l'ancienne contrainte unique
ALTER TABLE public.prix_marche DROP CONSTRAINT IF EXISTS prix_marche_echeance_created_at_unique;

-- Créer une nouvelle contrainte unique sur echeance_id et created_at
ALTER TABLE public.prix_marche 
ADD CONSTRAINT prix_marche_echeance_id_created_at_unique 
UNIQUE (echeance_id, created_at);

-- Créer un trigger pour mettre à jour updated_at sur echeances
CREATE TRIGGER update_echeances_updated_at
    BEFORE UPDATE ON public.echeances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();