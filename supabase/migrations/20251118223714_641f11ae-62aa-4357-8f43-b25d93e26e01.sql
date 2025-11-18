-- Rendre prix_flat_demande nullable car il n'est pas toujours utilisé
-- (seulement pour les deals de type "flat", pas pour les deals de type "prime")
ALTER TABLE public.reventes_clients 
ALTER COLUMN prix_flat_demande DROP NOT NULL;

-- Ajouter une contrainte de vérification pour s'assurer qu'au moins 
-- prix_flat_demande OU prime_demandee est renseigné
ALTER TABLE public.reventes_clients
ADD CONSTRAINT check_prix_ou_prime 
CHECK (
  (prix_flat_demande IS NOT NULL) OR 
  (prime_demandee IS NOT NULL)
);