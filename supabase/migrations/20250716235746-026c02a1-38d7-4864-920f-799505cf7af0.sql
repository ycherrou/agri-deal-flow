-- Supprimer la politique conflictuelle qui limite les clients à voir seulement leurs propres reventes
DROP POLICY IF EXISTS "Clients can view their own reventes" ON reventes_clients;