import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Shield, Plus } from 'lucide-react';
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
  const [newCouverture, setNewCouverture] = useState({
    date_couverture: new Date().toISOString().split('T')[0],
    prix_futures: '',
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

    try {
      const { error } = await supabase
        .from('couvertures_achat')
        .insert({
          navire_id: navireId,
          date_couverture: newCouverture.date_couverture,
          prix_futures: parseFloat(newCouverture.prix_futures),
          volume_couvert: parseFloat(newCouverture.volume_couvert)
        });

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Couverture d\'achat ajoutée avec succès'
      });

      setNewCouverture({
        date_couverture: new Date().toISOString().split('T')[0],
        prix_futures: '',
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
                  <p className="text-xs text-muted-foreground mt-1">
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                      <div>
                        <div className="text-xs text-muted-foreground">Date</div>
                        <div className="font-medium">{formatDate(couverture.date_couverture)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Volume</div>
                        <div className="font-medium">{couverture.volume_couvert} MT</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Prix futures</div>
                        <div className="font-medium">{formatPrice(couverture.prix_futures)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Pourcentage</div>
                        <div className="font-medium">
                          {((couverture.volume_couvert / navire.quantite_totale) * 100).toFixed(1)}%
                        </div>
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
    </Card>
  );
}