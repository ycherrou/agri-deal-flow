import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Calendar, DollarSign, TrendingUp } from 'lucide-react';

interface PrixMarche {
  id: string;
  echeance: string;
  prix: number;
  date_maj: string;
}

export default function PrixMarche() {
  const [prixMarche, setPrixMarche] = useState<PrixMarche[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    echeance: '',
    prix: '',
    date_maj: new Date().toISOString().split('T')[0]
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPrixMarche();
  }, []);

  const fetchPrixMarche = async () => {
    try {
      const { data, error } = await supabase
        .from('prix_marche')
        .select('*')
        .order('echeance');

      if (error) throw error;
      setPrixMarche(data || []);
    } catch (error) {
      console.error('Error fetching prix marché:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les prix marché',
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
      const prixData = {
        echeance: formData.echeance,
        prix: parseFloat(formData.prix),
        date_maj: formData.date_maj
      };

      if (editingId) {
        const { error } = await supabase
          .from('prix_marche')
          .update(prixData)
          .eq('id', editingId);

        if (error) throw error;
        
        toast({
          title: 'Succès',
          description: 'Prix marché mis à jour avec succès'
        });
      } else {
        const { error } = await supabase
          .from('prix_marche')
          .insert([prixData]);

        if (error) throw error;
        
        toast({
          title: 'Succès',
          description: 'Prix marché créé avec succès'
        });
      }

      setFormData({
        echeance: '',
        prix: '',
        date_maj: new Date().toISOString().split('T')[0]
      });
      setIsEditing(false);
      setEditingId(null);
      fetchPrixMarche();
    } catch (error) {
      console.error('Error saving prix marché:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder le prix marché',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (prix: PrixMarche) => {
    setFormData({
      echeance: prix.echeance,
      prix: prix.prix.toString(),
      date_maj: prix.date_maj
    });
    setEditingId(prix.id);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce prix marché ?')) return;

    try {
      const { error } = await supabase
        .from('prix_marche')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Succès',
        description: 'Prix marché supprimé avec succès'
      });
      
      fetchPrixMarche();
    } catch (error) {
      console.error('Error deleting prix marché:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le prix marché',
        variant: 'destructive'
      });
    }
  };

  const handleCancel = () => {
    setFormData({
      echeance: '',
      prix: '',
      date_maj: new Date().toISOString().split('T')[0]
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const formatPrice = (price: number, echeance?: string) => {
    return price.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  if (loading && !isEditing) {
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
          <h1 className="text-2xl font-bold text-foreground">Prix marché CBOT</h1>
          <p className="text-muted-foreground">
            Gestion des prix de référence par échéance
          </p>
        </div>
        <Button 
          onClick={() => setIsEditing(true)}
          disabled={isEditing}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouveau prix
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {editingId ? 'Modifier le prix' : 'Nouveau prix'}
            </CardTitle>
            <CardDescription>
              {editingId ? 'Modifier les informations du prix marché' : 'Ajouter un nouveau prix marché'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="echeance">Échéance</Label>
                <Select value={formData.echeance} onValueChange={(value) => setFormData(prev => ({ ...prev, echeance: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une échéance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZCH24">ZCH24</SelectItem>
                    <SelectItem value="ZCK24">ZCK24</SelectItem>
                    <SelectItem value="ZCN24">ZCN24</SelectItem>
                    <SelectItem value="ZCU24">ZCU24</SelectItem>
                    <SelectItem value="ZCZ24">ZCZ24</SelectItem>
                    <SelectItem value="ZCH25">ZCH25</SelectItem>
                    <SelectItem value="ZCK25">ZCK25</SelectItem>
                    <SelectItem value="ZCN25">ZCN25</SelectItem>
                    <SelectItem value="ZCU25">ZCU25</SelectItem>
                    <SelectItem value="ZCZ25">ZCZ25</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prix">Prix (cts/bu)</Label>
                <Input
                  id="prix"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 425.50"
                  value={formData.prix}
                  onChange={(e) => setFormData(prev => ({ ...prev, prix: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_maj">Date de mise à jour</Label>
                <Input
                  id="date_maj"
                  type="date"
                  value={formData.date_maj}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_maj: e.target.value }))}
                  required
                />
              </div>

              <div className="flex space-x-2">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Sauvegarde...' : editingId ? 'Modifier' : 'Créer'}
                </Button>
                {isEditing && (
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    Annuler
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Liste des prix */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Prix actuels</CardTitle>
            <CardDescription>
              Derniers prix marché CBOT enregistrés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {prixMarche.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Aucun prix marché enregistré</p>
                </div>
              ) : (
                prixMarche.map((prix) => (
                  <div key={prix.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="font-mono">
                            {prix.echeance}
                          </Badge>
                           <div className="text-lg font-bold">
                             {formatPrice(prix.prix, prix.echeance)}
                           </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          Mis à jour le {formatDate(prix.date_maj)}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(prix)}
                          disabled={isEditing}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(prix.id)}
                          disabled={isEditing}
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
    </div>
  );
}