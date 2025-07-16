import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Shield, Plus, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  getContractSize, 
  supportsContracts, 
  volumeToContracts, 
  contractsToVolume, 
  formatContractsWithVolume,
  calculateOvercoverage
} from '@/lib/futuresUtils';
import type { ProductType } from '@/lib/futuresUtils';

interface CouvertureAchat {
  id: string;
  navire_id: string;
  date_couverture: string;
  prix_futures: number;
  volume_couvert: number;
  nombre_contrats: number;
  created_at: string;
}

interface Navire {
  id: string;
  nom: string;
  produit: ProductType;
  quantite_totale: number;
  prime_achat?: number;
  reference_cbot?: string;
}

interface CouverturesAchatProps {
  navireId: string | null;
}

export default function CouverturesAchat({ navireId }: CouverturesAchatProps) {
  const [couvertures, setCouvertures] = useState<CouvertureAchat[]>([]);
  const [navire, setNavire] = useState<Navire | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCouverture, setEditingCouverture] = useState<CouvertureAchat | null>(null);
  const [newCouverture, setNewCouverture] = useState({
    date_couverture: new Date().toISOString().split('T')[0],
    prix_futures: '',
    nombre_contrats: '',
    volume_couvert: ''
  });
  const [editCouverture, setEditCouverture] = useState({
    date_couverture: '',
    prix_futures: '',
    nombre_contrats: '',
    volume_couvert: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (navireId) {
      fetchCouvertures();
      fetchNavire();
    }
  }, [navireId]);

  const fetchNavire = async () => {
    if (!navireId) return;
    
    try {
      const { data, error } = await supabase
        .from('navires')
        .select('id, nom, produit, quantite_totale, prime_achat, reference_cbot')
        .eq('id', navireId)
        .single();

      if (error) throw error;
      setNavire(data);
    } catch (error) {
      console.error('Error fetching navire:', error);
    }
  };

  const fetchCouvertures = async () => {
    if (!navireId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('couvertures_achat')
        .select('*')
        .eq('navire_id', navireId)
        .order('date_couverture', { ascending: false });

      if (error) throw error;
      setCouvertures(data || []);
    } catch (error) {
      console.error('Error fetching couvertures achat:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les couvertures d\'achat',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navireId || !navire) return;

    try {
      let volumeEquivalent: number;
      let nombreContrats: number;

      if (supportsContracts(navire.produit)) {
        nombreContrats = parseInt(newCouverture.nombre_contrats);
        volumeEquivalent = contractsToVolume(nombreContrats, navire.produit);
        
        if (volumeEquivalent > volumeRestant) {
          const surcouverture = volumeEquivalent - volumeRestant;
          const confirmation = window.confirm(
            `Cette couverture générera une surcouverture de ${surcouverture} tonnes. Voulez-vous continuer ?`
          );
          if (!confirmation) return;
        }
      } else {
        volumeEquivalent = parseFloat(newCouverture.volume_couvert);
        nombreContrats = 0;
      }

      const { error } = await supabase
        .from('couvertures_achat')
        .insert({
          navire_id: navireId,
          date_couverture: newCouverture.date_couverture,
          prix_futures: parseFloat(newCouverture.prix_futures),
          nombre_contrats: nombreContrats,
          volume_couvert: volumeEquivalent
        });

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Couverture d\'achat ajoutée avec succès'
      });

      setNewCouverture({
        date_couverture: new Date().toISOString().split('T')[0],
        prix_futures: '',
        nombre_contrats: '',
        volume_couvert: ''
      });
      setIsDialogOpen(false);
      fetchCouvertures();
    } catch (error) {
      console.error('Error creating couverture:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la couverture',
        variant: 'destructive'
      });
    }
  };

  const handleEditClick = (couverture: CouvertureAchat) => {
    setEditingCouverture(couverture);
    setEditCouverture({
      date_couverture: couverture.date_couverture,
      prix_futures: couverture.prix_futures.toString(),
      nombre_contrats: couverture.nombre_contrats.toString(),
      volume_couvert: couverture.volume_couvert.toString()
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCouverture || !navire) return;

    try {
      const { error } = await supabase
        .from('couvertures_achat')
        .update({
          date_couverture: editCouverture.date_couverture,
          prix_futures: parseFloat(editCouverture.prix_futures),
          nombre_contrats: parseInt(editCouverture.nombre_contrats)
        })
        .eq('id', editingCouverture.id);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Couverture d\'achat modifiée avec succès'
      });

      setIsEditDialogOpen(false);
      setEditingCouverture(null);
      fetchCouvertures();
    } catch (error) {
      console.error('Error updating couverture:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier la couverture',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (couvertureId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette couverture ?')) return;

    try {
      const { error } = await supabase
        .from('couvertures_achat')
        .delete()
        .eq('id', couvertureId);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Couverture d\'achat supprimée avec succès'
      });

      fetchCouvertures();
    } catch (error) {
      console.error('Error deleting couverture:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la couverture',
        variant: 'destructive'
      });
    }
  };

  if (!navire) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Sélectionnez un navire pour voir les couvertures d'achat</p>
        </CardContent>
      </Card>
    );
  }

  const volumeCouvert = couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
  const volumeRestant = navire.quantite_totale - volumeCouvert;
  const tauxCouverture = (volumeCouvert / navire.quantite_totale) * 100;

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Couvertures d'Achat - {navire.nom}</CardTitle>
            <CardDescription>
              Gestion des couvertures pour la position d'achat totale ({navire.quantite_totale})
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une couverture
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvelle couverture d'achat</DialogTitle>
                <DialogDescription>
                  Ajouter une couverture pour {navire.nom}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="date_couverture">Date de couverture</Label>
                  <Input
                    id="date_couverture"
                    type="date"
                    value={newCouverture.date_couverture}
                    onChange={(e) => setNewCouverture(prev => ({ ...prev, date_couverture: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="prix_futures">Prix futures</Label>
                  <Input
                    id="prix_futures"
                    type="number"
                    step="0.01"
                    placeholder="Prix futures"
                    value={newCouverture.prix_futures}
                    onChange={(e) => setNewCouverture(prev => ({ ...prev, prix_futures: e.target.value }))}
                    required
                  />
                </div>
                {navire && supportsContracts(navire.produit) ? (
                  <div>
                    <Label htmlFor="nombre_contrats">Nombre de contrats</Label>
                    <Input
                      id="nombre_contrats"
                      type="number"
                      step="1"
                      min="1"
                      placeholder="Nombre de contrats"
                      value={newCouverture.nombre_contrats}
                      onChange={(e) => setNewCouverture(prev => ({ ...prev, nombre_contrats: e.target.value }))}
                      required
                    />
                    {newCouverture.nombre_contrats && (
                      <div className="text-sm text-muted-foreground mt-1">
                        = {contractsToVolume(parseInt(newCouverture.nombre_contrats) || 0, navire.produit)} tonnes
                        {parseInt(newCouverture.nombre_contrats) > 0 && (
                          <div className="text-xs text-orange-600">
                            Surcouverture: {calculateOvercoverage(
                              volumeRestant,
                              parseInt(newCouverture.nombre_contrats),
                              navire.produit
                            )} tonnes
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Volume restant à couvrir: {volumeRestant.toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="volume_couvert">Volume couvert</Label>
                    <Input
                      id="volume_couvert"
                      type="number"
                      step="0.01"
                      placeholder="Volume"
                      value={newCouverture.volume_couvert}
                      onChange={(e) => setNewCouverture(prev => ({ ...prev, volume_couvert: e.target.value }))}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Volume restant à couvrir: {volumeRestant.toLocaleString()}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      Contrats futures non supportés pour ce produit
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit">Ajouter</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Résumé de la couverture */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium">Position d'achat totale</h4>
                <p className="text-sm text-muted-foreground">
                  Navire: {navire.nom} • {navire.quantite_totale}
                </p>
                {navire.prime_achat && (
                  <p className="text-xs text-muted-foreground">
                    Prime d'achat: {navire.prime_achat} • Référence: {navire.reference_cbot || 'Non définie'}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{tauxCouverture.toFixed(1)}%</span>
                </div>
                <Progress value={tauxCouverture} className="h-2 w-24" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-muted-foreground mb-1">Volume total</div>
                <div className="font-medium">{navire.quantite_totale}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-muted-foreground mb-1">Volume couvert</div>
                <div className="font-medium text-green-700">{volumeCouvert}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="text-muted-foreground mb-1">Volume restant</div>
                <div className="font-medium text-orange-700">{volumeRestant}</div>
              </div>
            </div>

            {volumeRestant > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-orange-700 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Position non couverte</span>
                </div>
                <p className="text-sm text-orange-600">
                  {volumeRestant} restent à couvrir ({((volumeRestant / navire.quantite_totale) * 100).toFixed(1)}% du volume total)
                </p>
              </div>
            )}
          </div>

          {/* Liste des couvertures */}
          {couvertures.length > 0 ? (
            <div>
              <h5 className="font-medium mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Couvertures existantes ({couvertures.length})
              </h5>
              <div className="space-y-2">
                {couvertures.map((couverture) => (
                  <div key={couverture.id} className="border rounded-lg p-3 bg-card">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                      <div>
                        <div className="text-xs text-muted-foreground">Date</div>
                        <div className="font-medium">{formatDate(couverture.date_couverture)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Volume</div>
                        <div className="font-medium">
                          {supportsContracts(navire.produit) ? 
                            formatContractsWithVolume(couverture.nombre_contrats, navire.produit) :
                            couverture.volume_couvert
                          }
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Prix futures</div>
                        <div className="font-medium">{formatPrice(couverture.prix_futures)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Pourcentage</div>
                        <div className="font-medium">
                          {((couverture.volume_couvert / navire.quantite_totale) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditClick(couverture)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(couverture.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/20 rounded-lg">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune couverture d'achat</p>
              <p className="text-xs text-muted-foreground mt-1">
                Position exposée de {navire.quantite_totale}
              </p>
            </div>
           )}
         </div>
       </CardContent>

       {/* Dialog d'édition */}
       <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Modifier la couverture d'achat</DialogTitle>
             <DialogDescription>
               Modifier les détails de la couverture pour {navire.nom}
             </DialogDescription>
           </DialogHeader>
           <form onSubmit={handleEditSubmit} className="space-y-4">
             <div>
               <Label htmlFor="edit_date_couverture">Date de couverture</Label>
               <Input
                 id="edit_date_couverture"
                 type="date"
                 value={editCouverture.date_couverture}
                 onChange={(e) => setEditCouverture(prev => ({ ...prev, date_couverture: e.target.value }))}
                 required
               />
             </div>
             <div>
               <Label htmlFor="edit_prix_futures">Prix futures</Label>
               <Input
                 id="edit_prix_futures"
                 type="number"
                 step="0.01"
                 placeholder="Prix futures"
                 value={editCouverture.prix_futures}
                 onChange={(e) => setEditCouverture(prev => ({ ...prev, prix_futures: e.target.value }))}
                 required
               />
             </div>
              <div>
                <Label htmlFor="edit_nombre_contrats">Nombre de contrats</Label>
                <Input
                  id="edit_nombre_contrats"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="Nombre de contrats"
                  value={editCouverture.nombre_contrats}
                  onChange={(e) => setEditCouverture(prev => ({ ...prev, nombre_contrats: e.target.value }))}
                  required
                />
                {editCouverture.nombre_contrats && navire && (
                  <div className="text-sm text-muted-foreground mt-1">
                    = {contractsToVolume(parseInt(editCouverture.nombre_contrats) || 0, navire.produit)} tonnes
                  </div>
                )}
              </div>
             <div className="flex justify-end gap-2">
               <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                 Annuler
               </Button>
               <Button type="submit">Modifier</Button>
             </div>
           </form>
         </DialogContent>
       </Dialog>
     </Card>
   );
}