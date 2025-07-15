import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Shield, Plus, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface CouvertureAchat {
  id: string;
  navire_id: string;
  date_couverture: string;
  prix_futures: number;
  volume_couvert: number;
  created_at: string;
}

interface Navire {
  id: string;
  nom: string;
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
  const [inputMode, setInputMode] = useState<'volume' | 'futures'>('volume');
  const [editInputMode, setEditInputMode] = useState<'volume' | 'futures'>('volume');
  const [newCouverture, setNewCouverture] = useState({
    date_couverture: new Date().toISOString().split('T')[0],
    prix_futures: '',
    volume_couvert: '',
    nombre_futures: ''
  });
  const [editCouverture, setEditCouverture] = useState({
    date_couverture: '',
    prix_futures: '',
    volume_couvert: '',
    nombre_futures: ''
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
        .select('id, nom, quantite_totale, prime_achat, reference_cbot')
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
    if (!navireId) return;

    // Calculer le volume selon le mode de saisie
    let volumeCouvert: number;
    if (inputMode === 'futures') {
      // 1 future = 127.006 MT pour le maïs (5000 bushels * 25.4 kg/bushel / 1000)
      volumeCouvert = parseFloat(newCouverture.nombre_futures) * 127.006;
    } else {
      volumeCouvert = parseFloat(newCouverture.volume_couvert);
    }

    try {
      const { error } = await supabase
        .from('couvertures_achat')
        .insert({
          navire_id: navireId,
          date_couverture: newCouverture.date_couverture,
          prix_futures: parseFloat(newCouverture.prix_futures),
          volume_couvert: volumeCouvert
        });

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Couverture d\'achat ajoutée avec succès'
      });

      setNewCouverture({
        date_couverture: new Date().toISOString().split('T')[0],
        prix_futures: '',
        volume_couvert: '',
        nombre_futures: ''
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
    const nombreFutures = (couverture.volume_couvert / 127.006).toFixed(2);
    setEditCouverture({
      date_couverture: couverture.date_couverture,
      prix_futures: couverture.prix_futures.toString(),
      volume_couvert: couverture.volume_couvert.toString(),
      nombre_futures: nombreFutures
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCouverture) return;

    // Calculer le volume selon le mode de saisie
    let volumeCouvert: number;
    if (editInputMode === 'futures') {
      volumeCouvert = parseFloat(editCouverture.nombre_futures) * 127.006;
    } else {
      volumeCouvert = parseFloat(editCouverture.volume_couvert);
    }

    try {
      const { error } = await supabase
        .from('couvertures_achat')
        .update({
          date_couverture: editCouverture.date_couverture,
          prix_futures: parseFloat(editCouverture.prix_futures),
          volume_couvert: volumeCouvert
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
    return `${price.toFixed(2)} cts/bu`;
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
              Gestion des couvertures pour la position d'achat totale ({navire.quantite_totale} MT)
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
                  <Label htmlFor="prix_futures">Prix futures (cts/bu)</Label>
                  <Input
                    id="prix_futures"
                    type="number"
                    step="0.01"
                    placeholder="Prix en cents par bushel"
                    value={newCouverture.prix_futures}
                    onChange={(e) => setNewCouverture(prev => ({ ...prev, prix_futures: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label>Mode de saisie</Label>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="input-mode" className="text-sm">Volume (MT)</Label>
                      <Switch
                        id="input-mode"
                        checked={inputMode === 'futures'}
                        onCheckedChange={(checked) => setInputMode(checked ? 'futures' : 'volume')}
                      />
                      <Label htmlFor="input-mode" className="text-sm">Nombre de futures</Label>
                    </div>
                  </div>
                  
                  {inputMode === 'volume' ? (
                    <div>
                      <Label htmlFor="volume_couvert">Volume couvert (MT)</Label>
                      <Input
                        id="volume_couvert"
                        type="number"
                        step="0.01"
                        placeholder="Volume en tonnes métriques"
                        value={newCouverture.volume_couvert}
                        onChange={(e) => setNewCouverture(prev => ({ ...prev, volume_couvert: e.target.value }))}
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="nombre_futures">Nombre de futures</Label>
                      <Input
                        id="nombre_futures"
                        type="number"
                        step="0.01"
                        placeholder="Nombre de contrats futures"
                        value={newCouverture.nombre_futures}
                        onChange={(e) => setNewCouverture(prev => ({ ...prev, nombre_futures: e.target.value }))}
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        1 future = 127 MT (5000 bushels)
                      </p>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    Volume restant à couvrir: {volumeRestant.toLocaleString()} MT
                  </p>
                </div>
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
                  Navire: {navire.nom} • {navire.quantite_totale} MT
                </p>
                {navire.prime_achat && (
                  <p className="text-xs text-muted-foreground">
                    Prime d'achat: {navire.prime_achat} cts/bu • Référence: {navire.reference_cbot || 'Non définie'}
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
                <div className="font-medium">{navire.quantite_totale} MT</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-muted-foreground mb-1">Volume couvert</div>
                <div className="font-medium text-green-700">{volumeCouvert} MT</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="text-muted-foreground mb-1">Volume restant</div>
                <div className="font-medium text-orange-700">{volumeRestant} MT</div>
              </div>
            </div>

            {volumeRestant > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-orange-700 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Position non couverte</span>
                </div>
                <p className="text-sm text-orange-600">
                  {volumeRestant} MT restent à couvrir ({((volumeRestant / navire.quantite_totale) * 100).toFixed(1)}% du volume total)
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
                        <div className="text-xs text-muted-foreground">Volume / Futures</div>
                        <div className="font-medium">
                          {couverture.volume_couvert} MT
                          <div className="text-xs text-muted-foreground">
                            ({(couverture.volume_couvert / 127.006).toFixed(1)} futures)
                          </div>
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
                Position exposée de {navire.quantite_totale} MT
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
               <Label htmlFor="edit_prix_futures">Prix futures (cts/bu)</Label>
               <Input
                 id="edit_prix_futures"
                 type="number"
                 step="0.01"
                 placeholder="Prix en cents par bushel"
                 value={editCouverture.prix_futures}
                 onChange={(e) => setEditCouverture(prev => ({ ...prev, prix_futures: e.target.value }))}
                 required
               />
             </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Mode de saisie</Label>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="edit-input-mode" className="text-sm">Volume (MT)</Label>
                    <Switch
                      id="edit-input-mode"
                      checked={editInputMode === 'futures'}
                      onCheckedChange={(checked) => setEditInputMode(checked ? 'futures' : 'volume')}
                    />
                    <Label htmlFor="edit-input-mode" className="text-sm">Nombre de futures</Label>
                  </div>
                </div>
                
                {editInputMode === 'volume' ? (
                  <div>
                    <Label htmlFor="edit_volume_couvert">Volume couvert (MT)</Label>
                    <Input
                      id="edit_volume_couvert"
                      type="number"
                      step="0.01"
                      placeholder="Volume en tonnes métriques"
                      value={editCouverture.volume_couvert}
                      onChange={(e) => setEditCouverture(prev => ({ ...prev, volume_couvert: e.target.value }))}
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="edit_nombre_futures">Nombre de futures</Label>
                    <Input
                      id="edit_nombre_futures"
                      type="number"
                      step="0.01"
                      placeholder="Nombre de contrats futures"
                      value={editCouverture.nombre_futures}
                      onChange={(e) => setEditCouverture(prev => ({ ...prev, nombre_futures: e.target.value }))}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      1 future = 127 MT (5000 bushels)
                    </p>
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