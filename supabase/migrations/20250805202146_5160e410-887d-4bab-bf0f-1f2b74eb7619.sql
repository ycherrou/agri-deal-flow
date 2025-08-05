-- Step 1: Drop ALL policies that depend on get_current_user_role() function
-- This will allow us to remove the function and recreate policies safely

-- Drop all admin policies across all tables
DROP POLICY IF EXISTS "Admins can view all client profiles" ON public.clients;
DROP POLICY IF EXISTS "Admins can update all client profiles" ON public.clients;
DROP POLICY IF EXISTS "Users can view seller profiles on secondary market" ON public.clients;
DROP POLICY IF EXISTS "Admins can manage navires" ON public.navires;
DROP POLICY IF EXISTS "Admins can manage all couvertures" ON public.couvertures;
DROP POLICY IF EXISTS "Admins can manage all reventes" ON public.reventes_clients;
DROP POLICY IF EXISTS "Admins can manage prix_marche" ON public.prix_marche;
DROP POLICY IF EXISTS "Admins can manage all couvertures_achat" ON public.couvertures_achat;
DROP POLICY IF EXISTS "Admins can manage all echeances" ON public.echeances;
DROP POLICY IF EXISTS "Admins can manage all bids" ON public.bids_marche_secondaire;
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions_marche_secondaire;
DROP POLICY IF EXISTS "Admins can manage WhatsApp templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Admins can view all notifications history" ON public.notifications_history;
DROP POLICY IF EXISTS "Admins can manage all notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Admins can manage all bank lines" ON public.lignes_bancaires;
DROP POLICY IF EXISTS "Admins can manage all financements" ON public.financements;
DROP POLICY IF EXISTS "Admins can manage all bank movements" ON public.mouvements_bancaires;
DROP POLICY IF EXISTS "Admins can manage invoice sequences" ON public.sequences_factures;
DROP POLICY IF EXISTS "Admins can manage all invoices" ON public.factures;
DROP POLICY IF EXISTS "Admins can manage all invoice lines" ON public.lignes_facture;
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.paiements_factures;
DROP POLICY IF EXISTS "Admins can manage references" ON public.references_factures;

-- Now drop the problematic function
DROP FUNCTION IF EXISTS public.get_current_user_role();