-- Ajouter le champ prime_demandee pour les reventes en prime
ALTER TABLE public.reventes_clients 
ADD COLUMN prime_demandee numeric;