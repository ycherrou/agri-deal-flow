-- Permettre les valeurs NULL pour prix_flat_demande car les positions non couvertes utilisent prime_demandee
ALTER TABLE public.reventes_clients 
ALTER COLUMN prix_flat_demande DROP NOT NULL;