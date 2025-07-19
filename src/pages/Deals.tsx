import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Eye, Calendar, Package, Users, Trash2, Edit, RotateCcw, Shield } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supportsContracts, volumeToContracts, contractsToVolume } from '@/lib/futuresUtils';
import type { ProductType } from '@/lib/futuresUtils';

interface Deal {
  id: string;
  date_deal: string;
  type_deal: 'prime' | 'flat';
  volume: number;
  prix_flat: number | null;
  prime_vente: number | null;
  prix_reference: string | null;
  parent_deal_id: string | null;
  client: {
    nom: string;
    email: string;
  };
  navire: {
    nom: string;
    produit: string;
    fournisseur: string;
  };
}

interface Couverture {
  vente_id: string;
  volume_couvert: number;
  prix_futures: number;
  nombre_contrats: number;
  date_couverture: string;
}

export default function Deals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [couvertures, setCouvertures] = useState<Couverture[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isCouvertureDialogOpen, setIsCouvertureDialogOpen] = useState(false);
  const [couvertureForm, setCouvertureForm] = useState({
    volume_couvert: '',
    prix_futures: '',
    nombre_contrats: '',
    date_couverture: new Date().toISOString().split('T')[0]
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const getCouverturesForDeal = (dealId: string) => {
    return couvertures.filter(c => c.vente_id === dealId);
  };

  useEffect(() => {
    fetchDeals();
    fetchCouvertures();
  }, []);

  const fetchDeals = async () => {
    try {
      const { data, error } = await supabase
        .from('ventes')
        .select(`
          id,
          date_deal,
          type_deal,
          volume,
          prix_flat,
          prime_vente,
          prix_reference,
          parent_deal_id,
          client:clients(nom, email),
          navire:navires(nom, produit, fournisseur)
        `)
        .order('date_deal', { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les deals',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCouvertures = async () => {
    try {
      const { data, error } = await supabase
        .from('couvertures')
        .select('vente_id, volume_couvert, prix_futures, nombre_contrats, date_couverture');

      if (error) throw error;
      setCouvertures(data || []);
    } catch (error) {
      console.error('Error fetching couvertures:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const handleDeleteDeal = async (dealId: string) => {
    try {
      const { error } = await supabase
        .from('ventes')
        .delete()
        .eq('id', dealId);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Deal supprimé avec succès'
      });

      // Refresh the deals list
      fetchDeals();
    } catch (error) {
      console.error('Error deleting deal:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le deal',
        variant: 'destructive'
      });
    }
  };

  const getVolumeCouvert = (dealId: string) => {
    return couvertures
      .filter(c => c.vente_id === dealId)
      .reduce((sum, c) => sum + c.volume_couvert, 0);
  };

  const getVolumeNonCouvert = (deal: Deal) => {
    return deal.volume - getVolumeCouvert(deal.id);
  };

  const canRoll = (deal: Deal) => {
    return deal.type_deal === 'prime' && getVolumeNonCouvert(deal) > 0;
  };

  const canAddCouverture = (deal: Deal) => {
    return deal.type_deal === 'prime' && getVolumeNonCouvert(deal) > 0;
  };

  const handleOpenCouvertureDialog = (deal: Deal) => {
    setSelectedDeal(deal);
    setIsCouvertureDialogOpen(true);
    setCouvertureForm({
      volume_couvert: '',
      prix_futures: '',
      nombre_contrats: '',
      date_couverture: new Date().toISOString().split('T')[0]
    });
  };

  const handleContractsChange = (value: string) => {
    if (!selectedDeal) return;
    
    const contracts = parseFloat(value) || 0;
    const produit = selectedDeal.navire.produit as ProductType;
    
    if (supportsContracts(produit)) {
      const volume = contractsToVolume(contracts, produit);
      setCouvertureForm(prev => ({
        ...prev,
        nombre_contrats: value,
        volume_couvert: volume.toString()
      }));
    }
  };

  const handleVolumeChange = (value: string) => {
    if (!selectedDeal) return;
    
    const volume = parseFloat(value) || 0;
    const produit = selectedDeal.navire.produit as ProductType;
    
    if (supportsContracts(produit)) {
      const contracts = volumeToContracts(volume, produit);
      setCouvertureForm(prev => ({
        ...prev,
        volume_couvert: value,
        nombre_contrats: contracts.toString()
      }));
    } else {
      setCouvertureForm(prev => ({
        ...prev,
        volume_couvert: value
      }));
    }
  };

  const handleSubmitCouverture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeal) return;

    try {
      const volumeCouvert = parseFloat(couvertureForm.volume_couvert);
      const volumeNonCouvert = getVolumeNonCouvert(selectedDeal);

      if (volumeCouvert > volumeNonCouvert) {
        toast({
          title: 'Erreur',
          description: `Volume max disponible: ${volumeNonCouvert} tonnes`,
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase
        .from('couvertures')
        .insert({
          vente_id: selectedDeal.id,
          volume_couvert: volumeCouvert,
          prix_futures: parseFloat(couvertureForm.prix_futures),
          nombre_contrats: parseInt(couvertureForm.nombre_contrats) || 0,
          date_couverture: couvertureForm.date_couverture
        });

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Couverture ajoutée avec succès'
      });

      setIsCouvertureDialogOpen(false);
      fetchCouvertures();
    } catch (error) {
      console.error('Error adding couverture:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter la couverture',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deals</h1>
          <p className="text-muted-foreground">
            Gestion des deals et transactions commerciales
          </p>
        </div>
        <Button onClick={() => navigate('/deals/create')}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau deal
        </Button>
      </div>

      <div className="grid gap-4">
        {deals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun deal</h3>
              <p className="text-muted-foreground text-center mb-4">
                Vous n'avez pas encore créé de deal.
              </p>
              <Button onClick={() => navigate('/deals/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Créer votre premier deal
              </Button>
            </CardContent>
          </Card>
        ) : (
          deals.map((deal) => (
            <Card key={deal.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      Deal #{deal.id.slice(0, 8)}
                    </CardTitle>
                <CardDescription>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(deal.date_deal)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {deal.client.nom}
                    </span>
                    {deal.parent_deal_id && (
                      <span className="text-xs text-muted-foreground">
                        (Dérivé de #{deal.parent_deal_id.slice(0, 8)})
                      </span>
                    )}
                  </div>
                </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={deal.type_deal === 'prime' ? 'default' : 'secondary'}>
                      {deal.type_deal === 'prime' ? 'Prime' : 'Flat'}
                    </Badge>
                    {deal.parent_deal_id && (
                      <Badge variant="outline" className="text-xs">
                        Dérivé
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/deals/edit/${deal.id}`)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    {canAddCouverture(deal) && (
                      <Button variant="ghost" size="sm" onClick={() => handleOpenCouvertureDialog(deal)} title="Ajouter une couverture">
                        <Shield className="h-4 w-4" />
                      </Button>
                    )}
                    {canRoll(deal) && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/deals/roll/${deal.id}`)} title="Changer de référence">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                          <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer ce deal ? Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteDeal(deal.id)}>
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Navire</div>
                    <div className="font-medium">{deal.navire.nom}</div>
                    <div className="text-sm text-muted-foreground">
                      {deal.navire.produit} - {deal.navire.fournisseur}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Volume</div>
                    <div className="font-medium">{deal.volume} tonnes</div>
                    {getVolumeCouvert(deal.id) > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          Couvert: {getVolumeCouvert(deal.id)} tonnes
                        </div>
                        {getCouverturesForDeal(deal.id).map((couverture, index) => (
                          <div key={index} className="text-xs text-muted-foreground pl-2 border-l-2 border-primary/20">
                            <div className="flex items-center gap-2">
                              <Shield className="h-3 w-3" />
                              <span>{couverture.volume_couvert}t à {formatPrice(couverture.prix_futures)}$/t</span>
                            </div>
                            {couverture.nombre_contrats > 0 && (
                              <div className="text-xs opacity-70">
                                {couverture.nombre_contrats} contrat{couverture.nombre_contrats > 1 ? 's' : ''} - {formatDate(couverture.date_couverture)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Prix</div>
                    <div className="font-medium">
                      {deal.type_deal === 'flat' && deal.prix_flat !== null
                        ? formatPrice(deal.prix_flat)
                        : deal.type_deal === 'prime' && deal.prime_vente !== null
                        ? `Prime: ${formatPrice(deal.prime_vente)}`
                        : 'Non défini'}
                    </div>
                  </div>
                </div>
                {deal.prix_reference && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">Référence CBOT</div>
                    <div className="text-sm">{deal.prix_reference}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog de couverture */}
      <Dialog open={isCouvertureDialogOpen} onOpenChange={setIsCouvertureDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une couverture</DialogTitle>
            <DialogDescription>
              Deal: {selectedDeal?.navire.nom} - {selectedDeal?.navire.produit}
              <br />
              Volume disponible: {selectedDeal ? getVolumeNonCouvert(selectedDeal) : 0} tonnes
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCouverture} className="space-y-4">
            {selectedDeal && supportsContracts(selectedDeal.navire.produit as ProductType) ? (
              <div className="space-y-2">
                <Label htmlFor="nombre_contrats">Nombre de contrats</Label>
                <Input
                  id="nombre_contrats"
                  type="number"
                  step="1"
                  min="0"
                  value={couvertureForm.nombre_contrats}
                  onChange={(e) => handleContractsChange(e.target.value)}
                  placeholder="Nombre de contrats"
                />
                <div className="text-sm text-muted-foreground">
                  Volume équivalent: {couvertureForm.volume_couvert} tonnes
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="volume_couvert">Volume à couvrir (tonnes)</Label>
                <Input
                  id="volume_couvert"
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedDeal ? getVolumeNonCouvert(selectedDeal) : undefined}
                  value={couvertureForm.volume_couvert}
                  onChange={(e) => handleVolumeChange(e.target.value)}
                  placeholder="Volume en tonnes"
                  required
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="prix_futures">Prix futures ($/tonne)</Label>
              <Input
                id="prix_futures"
                type="number"
                step="0.01"
                min="0"
                value={couvertureForm.prix_futures}
                onChange={(e) => setCouvertureForm(prev => ({ ...prev, prix_futures: e.target.value }))}
                placeholder="Prix futures"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date_couverture">Date de couverture</Label>
              <Input
                id="date_couverture"
                type="date"
                value={couvertureForm.date_couverture}
                onChange={(e) => setCouvertureForm(prev => ({ ...prev, date_couverture: e.target.value }))}
                required
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCouvertureDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                Ajouter la couverture
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}