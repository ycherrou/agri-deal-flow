import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, Settings } from 'lucide-react';

interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  event_type: string;
  description?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface NotificationHistory {
  id: string;
  client_id: string;
  phone_number: string;
  template_name: string;
  message_content: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  error_message?: string | null;
  clients: {
    nom: string;
  } | null;
}

export default function WhatsAppNotifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    content: '',
    event_type: 'nouvelle_offre',
    active: true
  });
  const [testMessage, setTestMessage] = useState({
    client_id: '',
    phone_number: '',
    template_name: '',
    variables: ''
  });

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WhatsAppTemplate[];
    }
  });

  // Fetch notification history
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['notifications-history'],
    queryFn: async () => {
      const { data: notifications, error } = await supabase
        .from('notifications_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      // Get client names for notifications
      const clientIds = [...new Set(notifications?.map(n => n.client_id) || [])];
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, nom')
        .in('id', clientIds);
      
      if (clientsError) throw clientsError;

      // Map client names to notifications
      const clientsMap = new Map(clientsData?.map(c => [c.id, c.nom]) || []);
      
      return notifications?.map(notification => ({
        ...notification,
        clients: { nom: clientsMap.get(notification.client_id) || 'Client inconnu' }
      })) || [];
    }
  });

  // Fetch clients for test dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nom, telephone')
        .order('nom');
      if (error) throw error;
      return data;
    }
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (template: typeof newTemplate) => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .insert([template])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      setNewTemplate({
        name: '',
        content: '',
        event_type: 'nouvelle_offre',
        active: true
      });
      toast({
        title: "Template créé",
        description: "Le template WhatsApp a été créé avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WhatsAppTemplate> }) => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast({
        title: "Template mis à jour",
        description: "Le template WhatsApp a été mis à jour avec succès.",
      });
    }
  });

  // Send test message mutation
  const sendTestMessageMutation = useMutation({
    mutationFn: async (message: typeof testMessage) => {
      const variables = message.variables ? JSON.parse(message.variables) : {};
      const { data, error } = await supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          client_id: message.client_id,
          template_name: message.template_name,
          variables,
          phone_number: message.phone_number || undefined
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-history'] });
      setTestMessage({
        client_id: '',
        phone_number: '',
        template_name: '',
        variables: ''
      });
      toast({
        title: "Message envoyé",
        description: "Le message WhatsApp de test a été envoyé avec succès.",
      });
    },
    onError: (error: any) => {
      let errorMessage = error.message;
      
      // Handle specific error messages from the edge function
      if (error.message?.includes('No phone number available')) {
        errorMessage = "Le client sélectionné n'a pas de numéro de téléphone configuré. Veuillez saisir un numéro dans le champ 'Téléphone' ou choisir un autre client.";
      } else if (error.message?.includes('Template not found')) {
        errorMessage = "Le template sélectionné n'a pas été trouvé ou n'est pas actif.";
      } else if (error.message?.includes('Client not found')) {
        errorMessage = "Le client sélectionné n'a pas été trouvé.";
      }
      
      toast({
        title: "Erreur d'envoi",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  const handleCreateTemplate = () => {
    if (!newTemplate.name || !newTemplate.content) {
      toast({
        title: "Champs requis",
        description: "Le nom et le message sont obligatoires.",
        variant: "destructive"
      });
      return;
    }
    createTemplateMutation.mutate(newTemplate);
  };

  const toggleTemplateActive = (template: WhatsAppTemplate) => {
    updateTemplateMutation.mutate({
      id: template.id,
      updates: { active: !template.active }
    });
  };

  const handleSendTestMessage = () => {
    if (!testMessage.client_id || !testMessage.template_name) {
      toast({
        title: "Champs requis",
        description: "Le client et le template sont obligatoires.",
        variant: "destructive"
      });
      return;
    }
    sendTestMessageMutation.mutate(testMessage);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Notifications WhatsApp</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Templates Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Gestion des Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="template-name">Nom du template</Label>
                <Input
                  id="template-name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: nouvelle_offre_marche"
                />
              </div>
              
              <div>
                <Label htmlFor="event-type">Type d'événement</Label>
                <Select
                  value={newTemplate.event_type}
                  onValueChange={(value) => setNewTemplate(prev => ({ ...prev, event_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nouvelle_offre">Nouvelle offre</SelectItem>
                    <SelectItem value="offre_acceptee">Offre acceptée</SelectItem>
                    <SelectItem value="transaction_completee">Transaction complétée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="message-template">Message template</Label>
                <Textarea
                  id="message-template"
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Bonjour {{client_nom}}, votre offre de {{prix}}$/T pour {{volume}}T de {{produit}} a été acceptée."
                  rows={4}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Variables disponibles: client_nom, prix, volume, produit, gain
                </p>
              </div>
              
              <Button 
                onClick={handleCreateTemplate}
                disabled={createTemplateMutation.isPending}
                className="w-full"
              >
                {createTemplateMutation.isPending ? 'Création...' : 'Créer Template'}
              </Button>
            </div>

            {/* Templates List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {templatesLoading ? (
                <p className="text-muted-foreground">Chargement des templates...</p>
              ) : templates.length === 0 ? (
                <p className="text-muted-foreground">Aucun template trouvé.</p>
              ) : (
                templates.map((template) => (
                  <div key={template.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{template.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={template.active ? 'default' : 'secondary'}>
                          {template.active ? 'Actif' : 'Inactif'}
                        </Badge>
                        <Switch
                          checked={template.active}
                          onCheckedChange={() => toggleTemplateActive(template)}
                          disabled={updateTemplateMutation.isPending}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {template.content}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {template.event_type}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Test Message */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Test de Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="test-client">Client</Label>
              <Select
                value={testMessage.client_id}
                onValueChange={(value) => setTestMessage(prev => ({ ...prev, client_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem 
                      key={client.id} 
                      value={client.id}
                      disabled={!client.telephone}
                    >
                      {client.nom} {client.telephone ? `(${client.telephone})` : '(Pas de téléphone)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="test-phone">Téléphone (optionnel)</Label>
              <Input
                id="test-phone"
                value={testMessage.phone_number}
                onChange={(e) => setTestMessage(prev => ({ ...prev, phone_number: e.target.value }))}
                placeholder="+33123456789"
              />
            </div>

            <div>
              <Label htmlFor="test-template">Template</Label>
              <Select
                value={testMessage.template_name}
                onValueChange={(value) => setTestMessage(prev => ({ ...prev, template_name: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.filter(t => t.active).map((template) => (
                    <SelectItem key={template.id} value={template.name}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="test-variables">Variables (JSON)</Label>
              <Textarea
                id="test-variables"
                value={testMessage.variables}
                onChange={(e) => setTestMessage(prev => ({ ...prev, variables: e.target.value }))}
                placeholder='{"prix": "250", "volume": "100", "produit": "mais"}'
                rows={3}
              />
            </div>

            <Button 
              onClick={handleSendTestMessage}
              disabled={sendTestMessageMutation.isPending}
              className="w-full"
            >
              {sendTestMessageMutation.isPending ? 'Envoi...' : 'Envoyer Test'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Notification History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <p className="text-muted-foreground">Chargement de l'historique...</p>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground">Aucune notification envoyée.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {history.map((notification) => (
                <div key={notification.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{notification.clients?.nom}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(notification.status)}>
                        {notification.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(notification.sent_at || notification.created_at).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {notification.phone_number} • {notification.template_name}
                  </p>
                  <p className="text-sm">{notification.message_content}</p>
                  {notification.error_message && (
                    <p className="text-sm text-destructive mt-1">
                      Erreur: {notification.error_message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}