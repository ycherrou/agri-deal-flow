-- Supprimer toutes les données dans l'ordre des dépendances
-- D'abord les tables qui dépendent d'autres tables

-- 1. Supprimer les reventes clients
DELETE FROM public.reventes_clients;

-- 2. Supprimer les couvertures
DELETE FROM public.couvertures;

-- 3. Supprimer les ventes
DELETE FROM public.ventes;

-- 4. Supprimer les clients
DELETE FROM public.clients;

-- 5. Supprimer les navires
DELETE FROM public.navires;

-- 6. Supprimer les prix marché
DELETE FROM public.prix_marche;

-- 7. Supprimer les utilisateurs auth (cela devrait être fait en dernier)
DELETE FROM auth.users;