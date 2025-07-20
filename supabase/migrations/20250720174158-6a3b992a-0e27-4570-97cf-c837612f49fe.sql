-- Rollback: Supprimer la valeur 'annulee' du type revente_status
-- Note: PostgreSQL ne permet pas de DROP VALUE d'un enum directement
-- On doit créer un nouveau type et migrer les données

-- Créer un nouveau type sans 'annulee'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'revente_status_temp') THEN
        CREATE TYPE revente_status_temp AS ENUM ('en_attente', 'vendu', 'retire', 'en_attente_validation');
    END IF;
END $$;

-- Mettre à jour toutes les valeurs 'annulee' vers 'retire'
UPDATE reventes_clients SET etat = 'retire' WHERE etat = 'annulee';

-- Modifier la colonne pour utiliser le nouveau type
ALTER TABLE reventes_clients ALTER COLUMN etat TYPE revente_status_temp USING etat::text::revente_status_temp;

-- Supprimer l'ancien type et renommer le nouveau
DROP TYPE IF EXISTS revente_status CASCADE;
ALTER TYPE revente_status_temp RENAME TO revente_status;