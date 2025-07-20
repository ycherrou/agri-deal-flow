-- Correction: Gérer la valeur par défaut et rollback proprement
-- D'abord, supprimer la valeur par défaut temporairement
ALTER TABLE reventes_clients ALTER COLUMN etat DROP DEFAULT;

-- Mettre à jour toutes les valeurs 'annulee' vers 'retire' si elles existent
UPDATE reventes_clients SET etat = 'retire' WHERE etat::text = 'annulee';

-- Essayer de remettre la valeur par défaut avec le bon type
ALTER TABLE reventes_clients ALTER COLUMN etat SET DEFAULT 'en_attente'::revente_status;