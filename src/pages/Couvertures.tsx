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
import { 
  getContractSize, 
  supportsContracts, 
  volumeToContracts, 
  contractsToVolume, 
  formatContractsWithVolume,
  calculateOvercoverage
} from '@/lib/futuresUtils';
import type { ProductType } from '@/lib/futuresUtils';

interface Vente {
  id: string;
  volume: number;
  type_deal: 'prime' | 'flat';
  prime_vente: number | null;
  prix_reference: string | null;
  date_deal: string;
  navire: {
    nom: string;
    produit: ProductType;
  };
  client: {
    nom: string;
  };
  couvertures: Array<{
    id: string;
    volume_couvert: number;
    nombre_contrats: number;
    prix_futures: number;
    date_couverture: string;
  }>;
}

export default function Couvertures() {
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [selectedVente, setSelectedVente] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre_contrats: '',
    volume_couvert: '',
    prix_futures: '',
    date_couverture: new Date().toISOString().split('T')[0]
  });
  const [editingCouverture, setEditingCouverture] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    nombre_contrats: '',
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
          couvertures(id, volume_couvert, nombre_contrats, prix_futures, date_couverture)
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
      const nombreContrats = parseInt(formData.nombre_contrats);
      
      if (!supportsContracts(venteSelected.navire.produit)) {
        throw new Error('Les contrats futures ne sont pas supportés pour ce produit');
      }

      const volumeEquivalent = contractsToVolume(nombreContrats, venteSelected.navire.produit);
      
      if (volumeEquivalent > volumeRestant) {
        const surcouverture = volumeEquivalent - volumeRestant;
        const confirmation = window.confirm(
          `Cette couverture générera une surcouverture de ${surcouverture} tonnes. Voulez-vous continuer ?`
        );
        if (!confirmation) {
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase
        .from('couvertures')
        .insert([{
          vente_id: selectedVente,
          nombre_contrats: nombreContrats,
          volume_couvert: volumeEquivalent, // Sera recalculé par le trigger
          prix_futures: parseFloat(formData.prix_futures),
          date_couverture: formData.date_couverture
        }]);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Couverture ajoutée avec succès'
      });

      setFormData({
        nombre_contrats: '',
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
    return price.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const handleEditCouverture = (couverture: any, vente: Vente) => {
    setEditingCouverture({ ...couverture, vente });
    setEditFormData({
      nombre_contrats: couverture.nombre_contrats.toString(),
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
          nombre_contrats: parseInt(editFormData.nombre_contrats),
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
                        {vente.navire.nom} - {vente.client.nom} ({getVolumeRestant(vente)} restant)
                        {supportsContracts(vente.navire.produit) && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (Contrats supportés)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {venteSelectionnee && (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Volume total:</span>
                    <span className="font-medium">{venteSelectionnee.volume}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Volume restant:</span>
                    <span className="font-medium text-warning">{getVolumeRestant(venteSelectionnee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Référence:</span>
                    <span className="font-medium">{venteSelectionnee.prix_reference}</span>
                  </div>
                </div>
              )}

              {venteSelectionnee && supportsContracts(venteSelectionnee.navire.produit) ? (
                <div className="space-y-2">
                  <Label htmlFor="nombre_contrats">Nombre de contrats</Label>
                  <Input
                    id="nombre_contrats"
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Nombre de contrats"
                    value={formData.nombre_contrats}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre_contrats: e.target.value }))}
                    required
                  />
                  {formData.nombre_contrats && (
                    <div className="text-sm text-muted-foreground">
                      = {contractsToVolume(parseInt(formData.nombre_contrats) || 0, venteSelectionnee.navire.produit)} tonnes
                      {parseInt(formData.nombre_contrats) > 0 && (
                        <div className="text-xs text-orange-600">
                          Surcouverture: {calculateOvercoverage(
                            getVolumeRestant(venteSelectionnee),
                            parseInt(formData.nombre_contrats),
                            venteSelectionnee.navire.produit
                          )} tonnes
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="volume_couvert">Volume à couvrir</Label>
                  <Input
                    id="volume_couvert"
                    type="number"
                    step="0.01"
                    placeholder="Volume"
                    value={formData.volume_couvert || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, volume_couvert: e.target.value }))}
                    max={venteSelectionnee ? getVolumeRestant(venteSelectionnee) : undefined}
                    required
                  />
                  <div className="text-xs text-muted-foreground">
                    Contrats futures non supportés pour ce produit
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="prix_futures">Prix futures</Label>
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
                          <div className="font-medium">{vente.volume}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Volume restant:</span>
                          <div className="font-medium">{volumeRestant}</div>
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
                                  {supportsContracts(vente.navire.produit) ? (
                                    <span>
                                      {formatContractsWithVolume(couv.nombre_contrats, vente.navire.produit)} @ {formatPrice(couv.prix_futures, vente.navire.produit)}
                                    </span>
                                  ) : (
                                    <span>{couv.volume_couvert} @ {formatPrice(couv.prix_futures, vente.navire.produit)}</span>
                                  )}
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
              <Label htmlFor="edit_nombre_contrats">Nombre de contrats</Label>
              <Input
                id="edit_nombre_contrats"
                type="number"
                step="1"
                min="1"
                value={editFormData.nombre_contrats}
                onChange={(e) => setEditFormData(prev => ({ ...prev, nombre_contrats: e.target.value }))}
                required
              />
              {editFormData.nombre_contrats && editingCouverture && (
                <div className="text-sm text-muted-foreground">
                  = {contractsToVolume(parseInt(editFormData.nombre_contrats) || 0, editingCouverture.vente.navire.produit)} tonnes
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_prix_futures">Prix futures</Label>
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