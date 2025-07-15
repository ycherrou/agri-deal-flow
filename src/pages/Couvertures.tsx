import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Shield, TrendingUp, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Vente {
  id: string;
  volume: number;
  type_deal: 'prime' | 'flat';
  prime_vente: number | null;
  prix_reference: string | null;
  date_deal: string;
  navire: {
    nom: string;
    produit: string;
  };
  client: {
    nom: string;
  };
  couvertures: Array<{
    id: string;
    volume_couvert: number;
    prix_futures: number;
    date_couverture: string;
  }>;
}

export default function Couvertures() {
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [selectedVente, setSelectedVente] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    volume_couvert: '',
    prix_futures: '',
    date_couverture: new Date().toISOString().split('T')[0]
  });
  const [editingCouverture, setEditingCouverture] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    volume_couvert: '',
    prix_futures: '',
    date_couverture: ''
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchVentes();
  }, []);

  const fetchVentes = async () => {
    try {
      const { data, error } = await supabase
        .from('ventes')
        .select(`
          id,
          volume,
          type_deal,
          prime_vente,
          prix_reference,
          date_deal,
          navire:navires(nom, produit),
          client:clients(nom),
          couvertures(id, volume_couvert, prix_futures, date_couverture)
        `)
        .eq('type_deal', 'prime')
        .order('date_deal', { ascending: false });

      if (error) throw error;
      setVentes(data || []);
    } catch (error) {
      console.error('Error fetching ventes:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les ventes',
        variant: 'destructive'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVente) return;
    
    setLoading(true);

    try {
      const venteSelected = ventes.find(v => v.id === selectedVente);
      if (!venteSelected) throw new Error('Vente introuvable');

      const volumeDejaCouverte = venteSelected.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
      const volumeRestant = venteSelected.volume - volumeDejaCouverte;
      const nouveauVolume = parseFloat(formData.volume_couvert);

      if (nouveauVolume > volumeRestant) {
        throw new Error(`Volume maximum autorisé: ${volumeRestant} MT`);
      }

      const { error } = await supabase
        .from('couvertures')
        .insert([{
          vente_id: selectedVente,
          volume_couvert: nouveauVolume,
          prix_futures: parseFloat(formData.prix_futures),
          date_couverture: formData.date_couverture
        }]);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Couverture ajoutée avec succès'
      });

      setFormData({
        volume_couvert: '',
        prix_futures: '',
        date_couverture: new Date().toISOString().split('T')[0]
      });
      
      fetchVentes();
    } catch (error: any) {
      console.error('Error adding couverture:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'ajouter la couverture',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculerTauxCouverture = (vente: Vente) => {
    const volumeCouvert = vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
    return (volumeCouvert / vente.volume) * 100;
  };

  const getVolumeRestant = (vente: Vente) => {
    const volumeCouvert = vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
    return vente.volume - volumeCouvert;
  };

  const formatPrice = (price: number, product?: string) => {
    if (product === 'mais') {
      return `${price.toFixed(0)} cts/bu`;
    } else if (product === 'tourteau_soja') {
      return `$${price.toFixed(2)} USD/short ton`;
    } else {
      return `${price.toFixed(2)}`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const handleEditCouverture = (couverture: any, vente: Vente) => {
    setEditingCouverture({ ...couverture, vente });
    setEditFormData({
      volume_couvert: couverture.volume_couvert.toString(),
      prix_futures: couverture.prix_futures.toString(),
      date_couverture: couverture.date_couverture
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateCouverture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCouverture) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('couvertures')
        .update({
          volume_couvert: parseFloat(editFormData.volume_couvert),
          prix_futures: parseFloat(editFormData.prix_futures),
          date_couverture: editFormData.date_couverture
        })
        .eq('id', editingCouverture.id);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Couverture modifiée avec succès'
      });

      setIsEditDialogOpen(false);
      setEditingCouverture(null);
      fetchVentes();
    } catch (error: any) {
      console.error('Error updating couverture:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de modifier la couverture',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCouverture = async (couvertureId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('couvertures')
        .delete()
        .eq('id', couvertureId);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Couverture supprimée avec succès'
      });

      fetchVentes();
    } catch (error: any) {
      console.error('Error deleting couverture:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer la couverture',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const venteSelectionnee = ventes.find(v => v.id === selectedVente);

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/deals')}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion des couvertures</h1>
          <p className="text-muted-foreground">
            Ajouter et gérer les couvertures (hedging) pour les ventes à prime
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Nouvelle couverture
            </CardTitle>
            <CardDescription>
              Ajouter une couverture pour une vente à prime
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vente">Vente à couvrir</Label>
                <Select value={selectedVente} onValueChange={setSelectedVente}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une vente" />
                  </SelectTrigger>
                  <SelectContent>
                    {ventes.filter(v => getVolumeRestant(v) > 0).map((vente) => (
                      <SelectItem key={vente.id} value={vente.id}>
                        {vente.navire.nom} - {vente.client.nom} ({getVolumeRestant(vente)} MT restant)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {venteSelectionnee && (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Volume total:</span>
                    <span className="font-medium">{venteSelectionnee.volume} MT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Volume restant:</span>
                    <span className="font-medium text-warning">{getVolumeRestant(venteSelectionnee)} MT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Référence:</span>
                    <span className="font-medium">{venteSelectionnee.prix_reference}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="volume_couvert">Volume à couvrir (MT)</Label>
                <Input
                  id="volume_couvert"
                  type="number"
                  step="0.01"
                  placeholder="Volume en MT"
                  value={formData.volume_couvert}
                  onChange={(e) => setFormData(prev => ({ ...prev, volume_couvert: e.target.value }))}
                  max={venteSelectionnee ? getVolumeRestant(venteSelectionnee) : undefined}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prix_futures">Prix futures ({venteSelectionnee?.navire.produit === 'mais' ? 'cts/bu' : venteSelectionnee?.navire.produit === 'tourteau_soja' ? 'USD/short ton' : 'USD/MT'})</Label>
                <Input
                  id="prix_futures"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 425.50"
                  value={formData.prix_futures}
                  onChange={(e) => setFormData(prev => ({ ...prev, prix_futures: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_couverture">Date de couverture</Label>
                <Input
                  id="date_couverture"
                  type="date"
                  value={formData.date_couverture}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_couverture: e.target.value }))}
                  required
                />
              </div>

              <Button type="submit" disabled={loading || !selectedVente} className="w-full">
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Ajout...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Ajouter la couverture
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Liste des ventes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ventes à prime</CardTitle>
            <CardDescription>
              Ventes nécessitant une couverture avec leur statut actuel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ventes.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Aucune vente à prime trouvée</p>
                </div>
              ) : (
                ventes.map((vente) => {
                  const tauxCouverture = calculerTauxCouverture(vente);
                  const volumeRestant = getVolumeRestant(vente);
                  
                  return (
                    <div key={vente.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-medium">{vente.navire.nom}</div>
                          <div className="text-sm text-muted-foreground">
                            {vente.client.nom} - {formatDate(vente.date_deal)}
                          </div>
                        </div>
                        <Badge variant={tauxCouverture === 100 ? 'default' : volumeRestant === 0 ? 'secondary' : 'destructive'}>
                          {tauxCouverture.toFixed(1)}% couvert
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">Volume total:</span>
                          <div className="font-medium">{vente.volume} MT</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Volume restant:</span>
                          <div className="font-medium">{volumeRestant} MT</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Prime:</span>
                          <div className="font-medium">{formatPrice(vente.prime_vente || 0, vente.navire.produit)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Référence:</span>
                          <div className="font-medium">{vente.prix_reference}</div>
                        </div>
                      </div>

                      {vente.couvertures.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-sm font-medium mb-2">Couvertures existantes:</div>
                          <div className="space-y-1">
                            {vente.couvertures.map((couv) => (
                              <div key={couv.id} className="flex justify-between items-center text-xs bg-muted p-2 rounded">
                                <div className="flex-1">
                                  <span>{couv.volume_couvert} MT @ {formatPrice(couv.prix_futures, vente.navire.produit)}</span>
                                  <span className="ml-2 text-muted-foreground">{formatDate(couv.date_couverture)}</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditCouverture(couv, vente)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Supprimer la couverture</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Êtes-vous sûr de vouloir supprimer cette couverture ? Cette action est irréversible.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteCouverture(couv.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Supprimer
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog d'édition */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la couverture</DialogTitle>
            <DialogDescription>
              Modifier les détails de cette couverture
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCouverture} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_volume_couvert">Volume couvert (MT)</Label>
              <Input
                id="edit_volume_couvert"
                type="number"
                step="0.01"
                value={editFormData.volume_couvert}
                onChange={(e) => setEditFormData(prev => ({ ...prev, volume_couvert: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_prix_futures">Prix futures ({editingCouverture?.vente.navire.produit === 'mais' ? 'cts/bu' : editingCouverture?.vente.navire.produit === 'tourteau_soja' ? 'USD/short ton' : 'USD/MT'})</Label>
              <Input
                id="edit_prix_futures"
                type="number"
                step="0.01"
                value={editFormData.prix_futures}
                onChange={(e) => setEditFormData(prev => ({ ...prev, prix_futures: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_date_couverture">Date de couverture</Label>
              <Input
                id="edit_date_couverture"
                type="date"
                value={editFormData.date_couverture}
                onChange={(e) => setEditFormData(prev => ({ ...prev, date_couverture: e.target.value }))}
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Modification...' : 'Modifier'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}