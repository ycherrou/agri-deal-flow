-- Ajouter les colonnes pour les termes commerciaux et taux de fret
ALTER TABLE public.navires 
ADD COLUMN terme_commercial text NOT NULL DEFAULT 'CFR' CHECK (terme_commercial IN ('FOB', 'CFR')),
ADD COLUMN taux_fret numeric;