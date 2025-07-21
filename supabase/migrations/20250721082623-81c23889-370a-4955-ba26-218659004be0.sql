-- Créer une table pour stocker les templates de notifications WhatsApp
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  message_template TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'nouvelle_offre', 'offre_acceptee', 'transaction_completee'
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Policies pour les templates WhatsApp
CREATE POLICY "Admins can manage WhatsApp templates" 
ON public.whatsapp_templates 
FOR ALL 
USING (get_current_user_role() = 'admin'::user_role);

-- Créer une table pour l'historique des notifications envoyées
CREATE TABLE public.notifications_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  twilio_sid TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications_history ENABLE ROW LEVEL SECURITY;

-- Policies pour l'historique des notifications
CREATE POLICY "Admins can view all notifications history" 
ON public.notifications_history 
FOR SELECT 
USING (get_current_user_role() = 'admin'::user_role);

CREATE POLICY "Clients can view their own notifications" 
ON public.notifications_history 
FOR SELECT 
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Ajouter un champ téléphone aux clients s'il n'existe pas déjà
-- (le champ telephone existe déjà dans la table clients)

-- Insérer des templates par défaut
INSERT INTO public.whatsapp_templates (nom, message_template, event_type) VALUES
('nouvelle_offre_marche', 
 'Bonjour {{client_nom}}, une nouvelle offre est disponible sur le marché secondaire : {{volume}}T de {{produit}} à {{prix}}$/T. Consultez votre espace client pour plus de détails.',
 'nouvelle_offre'),
('offre_acceptee', 
 'Félicitations {{client_nom}} ! Votre offre de {{prix}}$/T pour {{volume}}T de {{produit}} a été acceptée. La transaction sera finalisée sous peu.',
 'offre_acceptee'),
('transaction_completee_vendeur',
 'Transaction finalisée ! Vous avez vendu {{volume}}T de {{produit}} à {{prix}}$/T. Gain réalisé: {{gain}}$. Merci pour votre confiance.',
 'transaction_completee'),
('transaction_completee_acheteur',
 'Transaction finalisée ! Vous avez acheté {{volume}}T de {{produit}} à {{prix}}$/T. La marchandise sera disponible selon les termes convenus.',
 'transaction_completee');

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notifications_history_updated_at
BEFORE UPDATE ON public.notifications_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();