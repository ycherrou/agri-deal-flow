
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Bell, Settings } from 'lucide-react';

interface NotificationPreference {
  id: string;
  client_id: string;
  event_type: string;
  enabled: boolean;
  produit_filter?: string[];
  volume_min?: number;
  volume_max?: number;
}

const eventTypes = [
  { key: 'nouvelle_offre', label: 'Nouvelles offres sur le marché', description: 'Être notifié quand une nouvelle position est disponible' },
  { key: 'offre_acceptee', label: 'Mes offres acceptées', description: 'Être notifié quand une de mes offres est acceptée' },
  { key: 'transaction_completee', label: 'Transactions finalisées', description: 'Être notifié quand une transaction est complétée' }
];

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [currentClient, setCurrentClient] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCurrentClient();
  }, []);

  useEffect(() => {
    if (currentClient) {
      fetchPreferences();
    }
  }, [currentClient]);

  const fetchCurrentClient = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setCurrentClient(data.id);
    }
  };

  const fetchPreferences = async () => {
    if (!currentClient) return;

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('client_id', currentClient);

      if (error) throw error;

      // Créer des préférences par défaut si elles n'existent pas
      const existingTypes = data?.map(p => p.event_type) || [];
      const missingTypes = eventTypes.filter(et => !existingTypes.includes(et.key));
      
      if (missingTypes.length > 0) {
        const defaultPrefs = missingTypes.map(et => ({
          client_id: currentClient,
          event_type: et.key,
          enabled: true // Activé par défaut
        }));

        const { data: newPrefs, error: insertError } = await supabase
          .from('notification_preferences')
          .insert(defaultPrefs)
          .select();

        if (insertError) throw insertError;

        setPreferences([...(data || []), ...(newPrefs || [])]);
      } else {
        setPreferences(data || []);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des préférences:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger vos préférences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (eventType: string, enabled: boolean) => {
    if (!currentClient) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('client_id', currentClient)
        .eq('event_type', eventType);

      if (error) throw error;

      setPreferences(prev => 
        prev.map(p => 
          p.event_type === eventType ? { ...p, enabled } : p
        )
      );

      toast({
        title: "Préférences mises à jour",
        description: `Notifications ${enabled ? 'activées' : 'désactivées'} pour ${eventTypes.find(et => et.key === eventType)?.label}`,
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour vos préférences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Chargement des préférences...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Préférences de Notifications WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {eventTypes.map(eventType => {
          const preference = preferences.find(p => p.event_type === eventType.key);
          const isEnabled = preference?.enabled ?? true;

          return (
            <div key={eventType.key} className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <Label htmlFor={eventType.key} className="font-medium">
                  {eventType.label}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {eventType.description}
                </p>
              </div>
              <Switch
                id={eventType.key}
                checked={isEnabled}
                onCheckedChange={(enabled) => updatePreference(eventType.key, enabled)}
                disabled={saving}
              />
            </div>
          );
        })}

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            💡 Conseil : Vous pouvez ajuster ces préférences à tout moment depuis vos paramètres.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
