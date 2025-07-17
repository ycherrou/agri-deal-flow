-- Supprimer la politique qui cause la récursion infinie
DROP POLICY IF EXISTS "Users can view seller profiles on secondary market" ON clients;