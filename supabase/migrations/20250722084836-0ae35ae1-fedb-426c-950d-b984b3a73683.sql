-- Create notification_preferences table for WhatsApp notifications
CREATE TABLE public.notification_preferences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    produit_filter TEXT[],
    volume_min NUMERIC,
    volume_max NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(client_id, event_type)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notification preferences" 
ON public.notification_preferences 
FOR SELECT 
USING (client_id IN (
    SELECT clients.id 
    FROM clients 
    WHERE clients.user_id = auth.uid()
));

CREATE POLICY "Users can create their own notification preferences" 
ON public.notification_preferences 
FOR INSERT 
WITH CHECK (client_id IN (
    SELECT clients.id 
    FROM clients 
    WHERE clients.user_id = auth.uid()
));

CREATE POLICY "Users can update their own notification preferences" 
ON public.notification_preferences 
FOR UPDATE 
USING (client_id IN (
    SELECT clients.id 
    FROM clients 
    WHERE clients.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all notification preferences" 
ON public.notification_preferences 
FOR ALL 
USING (get_current_user_role() = 'admin'::user_role);

-- Create trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();