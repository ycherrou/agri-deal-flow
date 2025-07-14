import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Users, Mail, Phone, Calendar, Shield } from 'lucide-react';

interface Client {
  id: string;
  user_id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  role: 'admin' | 'client';
  created_at: string;
  updated_at: string;
  ventes?: Array<{
    id: string;
    volume: number;
    date_deal: string;
  }>;
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    telephone: '',
    role: 'client' as 'admin' | 'client',
    password: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          user_id,
          nom,
          email,
          telephone,
          role,
          created_at,
          updated_at,
          ventes:ventes(id, volume, date_deal)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les clients',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingClient) {
        // Modifier un client existant
        const { error } = await supabase
          .from('clients')
          .update({
            nom: formData.nom,
            email: formData.email || null,
            telephone: formData.telephone || null,
            role: formData.role
          })
          .eq('id', editingClient.id);

        if (error) throw error;

        toast({
          title: 'Succès',
          description: 'Client modifié avec succès'
        });
      } else {
        // Créer un nouveau client
        if (!formData.email || !formData.password) {
          throw new Error('Email et mot de passe requis pour un nouveau client');
        }

        // Créer l'utilisateur dans auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          user_metadata: {
            nom: formData.nom,
            role: formData.role
          }
        });

        if (authError) throw authError;

        // Créer le client dans la table clients
        const { error: clientError } = await supabase
          .from('clients')
          .insert([{
            user_id: authData.user.id,
            nom: formData.nom,
            email: formData.email,
            telephone: formData.telephone || null,
            role: formData.role
          }]);

        if (clientError) {
          // Si erreur lors de la création du client, supprimer l'utilisateur auth
          await supabase.auth.admin.deleteUser(authData.user.id);
          throw clientError;
        }

        toast({
          title: 'Succès',
          description: 'Client créé avec succès'
        });
      }

      setFormData({
        nom: '',
        email: '',
        telephone: '',
        role: 'client',
        password: ''
      });
      setEditingClient(null);
      setIsDialogOpen(false);
      fetchClients();
    } catch (error: any) {
      console.error('Error saving client:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de sauvegarder le client',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (client: Client) => {
    setFormData({
      nom: client.nom,
      email: client.email || '',
      telephone: client.telephone || '',
      role: client.role,
      password: ''
    });
    setEditingClient(client);
    setIsDialogOpen(true);
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le client ${client.nom} ? Cette action est irréversible.`)) {
      return;
    }

    try {
      setLoading(true);

      // Supprimer d'abord le client de la table clients
      const { error: clientError } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (clientError) throw clientError;

      // Ensuite supprimer l'utilisateur de auth
      const { error: authError } = await supabase.auth.admin.deleteUser(client.user_id);
      if (authError) console.warn('Erreur lors de la suppression de l\'utilisateur auth:', authError);

      toast({
        title: 'Succès',
        description: 'Client supprimé avec succès'
      });

      fetchClients();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer le client',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      email: '',
      telephone: '',
      role: 'client',
      password: ''
    });
    setEditingClient(null);
  };

  const filteredClients = clients.filter(client =>
    client.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getTotalVolume = (client: Client) => {
    return client.ventes?.reduce((sum, vente) => sum + vente.volume, 0) || 0;
  };

  if (loading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion des clients</h1>
          <p className="text-muted-foreground">
            Créer et gérer les comptes clients et administrateurs
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? 'Modifier le client' : 'Nouveau client'}
              </DialogTitle>
              <DialogDescription>
                {editingClient 
                  ? 'Modifier les informations du client'
                  : 'Créer un nouveau compte client ou administrateur'
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom complet *</Label>
                <Input
                  id="nom"
                  placeholder="Nom et prénom"
                  value={formData.nom}
                  onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemple.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!!editingClient}
                  required
                />
                {editingClient && (
                  <p className="text-xs text-muted-foreground">
                    L'email ne peut pas être modifié après création
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input
                  id="telephone"
                  placeholder="+33 1 23 45 67 89"
                  value={formData.telephone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Rôle *</Label>
                <Select value={formData.role} onValueChange={(value: 'admin' | 'client') => setFormData(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="admin">Administrateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!editingClient && (
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mot de passe sécurisé"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Sauvegarde...' : editingClient ? 'Modifier' : 'Créer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barre de recherche */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total clients</p>
                <p className="text-2xl font-bold">{clients.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Administrateurs</p>
                <p className="text-2xl font-bold">{clients.filter(c => c.role === 'admin').length}</p>
              </div>
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Clients actifs</p>
                <p className="text-2xl font-bold">{clients.filter(c => c.ventes && c.ventes.length > 0).length}</p>
              </div>
              <Users className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des clients */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des clients</CardTitle>
          <CardDescription>
            {filteredClients.length} client(s) trouvé(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredClients.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? 'Aucun client trouvé pour cette recherche' : 'Aucun client enregistré'}
                </p>
              </div>
            ) : (
              filteredClients.map((client) => (
                <div key={client.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{client.nom}</h3>
                        <Badge variant={client.role === 'admin' ? 'default' : 'secondary'}>
                          {client.role === 'admin' ? 'Admin' : 'Client'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{client.email || 'Non renseigné'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{client.telephone || 'Non renseigné'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Créé le {formatDate(client.created_at)}</span>
                        </div>
                      </div>

                      {client.ventes && client.ventes.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Activité: </span>
                            <span className="font-medium">
                              {client.ventes.length} vente(s) - {getTotalVolume(client)} MT total
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(client)}
                        disabled={loading}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(client)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}