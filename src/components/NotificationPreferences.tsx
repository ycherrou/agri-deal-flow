
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Bell } from 'lucide-react';

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
  { key: 'nouvelle_offre_marche', label: 'Nouvelles offres sur le marché', description: 'Être notifié quand une nouvelle position est disponible' },
  { key: 'offre_acceptee', label: 'Mes offres acceptées', description: 'Être notifié quand une de mes offres est acceptée' },
  { key: 'transaction_completee', label: 'Transactions finalisées', description: 'Être notifié quand une transaction est complétée' }
];

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);

  // Version simplifiée temporaire en attendant les types Supabase
  useEffect(() => {
    // Simuler des préférences par défaut
    const defaultPreferences: NotificationPreference[] = eventTypes.map(eventType => ({
      id: `default-${eventType.key}`,
      client_id: 'temp-client',
      event_type: eventType.key,
      enabled: true,
      produit_filter: undefined,
      volume_min: undefined,
      volume_max: undefined
    }));
    
    setPreferences(defaultPreferences);
    setLoading(false);
  }, []);

  const updatePreference = (eventType: string, enabled: boolean) => {
    setPreferences(prev => 
      prev.map(p => 
        p.event_type === eventType ? { ...p, enabled } : p
      )
    );

    toast({
      title: "Préférences mises à jour",
      description: `Notifications ${enabled ? 'activées' : 'désactivées'} pour ${eventTypes.find(et => et.key === eventType)?.label}`,
    });
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
                disabled={false}
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
