import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Ship, Shield, Package, AlertCircle, Anchor, Calendar, ShoppingCart, ShieldAlert, AlertTriangle, BarChart3 } from 'lucide-react';
import ReventeCreationDialog from '@/components/ReventeCreationDialog';
import NavireGanttChart from '@/components/NavireGanttChart';

interface NavirePortfolioData {
  navire_id: string;
  navire_nom: string;
  produit: string;
  date_arrivee: string;
  fournisseur: string;
  quantite_totale: number;
  positions: Array<{
    id: string;
    volume_achete: number;
    prime_payee: number;
    type_deal: 'prime' | 'flat';
    prix_flat: number | null;
    prix_reference: string | null;
    date_deal: string;
    couvertures: Array<{
      id: string;
      volume_couvert: number;
      prix_futures: number;
      date_couverture: string;
    }>;
    volume_non_couvert: number;
  }>;
  volume_total: number;
  volume_couvert_total: number;
  volume_non_couvert_total: number;
  prime_moyenne: number;
}

export default function ClientPortfolio() {
  const [portfolioData, setPortfolioData] = useState<NavirePortfolioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNavire, setActiveNavire] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>('');
  const [reventeDialog, setReventeDialog] = useState<{open: boolean, position: any}>({open: false, position: null});
  const [prixMarche, setPrixMarche] = useState<Array<{
    echeance_id: string;
    prix: number;
    created_at: string;
    echeance?: {
      nom: string;
      active: boolean;
    };
  }>>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchClientPortfolio();
    fetchPrixMarche();
  }, []);

  const fetchPrixMarche = async () => {
    try {
      const { data, error } = await supabase
        .from('prix_marche')
        .select('echeance_id, prix, created_at, echeance:echeances!inner(nom, active)')
        .eq('echeance.active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPrixMarche(data || []);
    } catch (error) {
      console.error('Error fetching prix marché:', error);
    }
  };

  const fetchClientPortfolio = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!clientData) return;
      setClientId(clientData.id);

      // Récupérer les navires avec les ventes du client
      const { data: naviresData, error } = await supabase
        .from('navires')
        .select(`
          id,
          nom,
          produit,
          date_arrivee,
          fournisseur,
          quantite_totale,
          ventes!inner (
            id,
            volume,
            prime_vente,
            prix_reference,
            type_deal,
            prix_flat,
            date_deal,
            client_id,
            clients (
              id,
              nom,
              email,
              telephone
            ),
            couvertures (
              id,
              volume_couvert,
              prix_futures,
              date_couverture
            )
          )
        `)
        .eq('ventes.client_id', clientData.id);

      if (error) throw error;

      // Transformer les données pour le portfolio client basé sur les navires
      const portfolioData: NavirePortfolioData[] = (naviresData || []).map(navire => {
        const positions = navire.ventes.map((vente: any) => {
          const volumeCouvert = vente.couvertures.reduce((sum: number, c: any) => sum + c.volume_couvert, 0);
          const volumeNonCouvert = vente.volume - volumeCouvert;

          return {
            id: vente.id,
            volume_achete: vente.volume,
            prime_payee: vente.prime_vente || 0,
            type_deal: vente.type_deal,
            prix_flat: vente.prix_flat,
            prix_reference: vente.prix_reference,
            date_deal: vente.date_deal,
            couvertures: vente.couvertures,
            volume_non_couvert: volumeNonCouvert,
          };
        });

        // Calculs agrégés pour le navire
        const volumeTotal = positions.reduce((sum, p) => sum + p.volume_achete, 0);
        const volumeCouvertTotal = positions.reduce((sum, p) => sum + (p.volume_achete - p.volume_non_couvert), 0);
        const volumeNonCouvertTotal = volumeTotal - volumeCouvertTotal;
        
        // Prime moyenne pondérée (seulement pour les deals à prime)
        const dealsAPrime = positions.filter(p => p.type_deal === 'prime');
        const volumeTotalPrime = dealsAPrime.reduce((sum, p) => sum + p.volume_achete, 0);
        const primeMoyenne = volumeTotalPrime > 0 
          ? dealsAPrime.reduce((sum, p) => sum + (p.prime_payee * p.volume_achete), 0) / volumeTotalPrime
          : 0;

        return {
          navire_id: navire.id,
          navire_nom: navire.nom,
          produit: navire.produit,
          date_arrivee: navire.date_arrivee,
          fournisseur: navire.fournisseur,
          quantite_totale: navire.quantite_totale,
          positions,
          volume_total: volumeTotal,
          volume_couvert_total: volumeCouvertTotal,
          volume_non_couvert_total: volumeNonCouvertTotal,
          prime_moyenne: primeMoyenne,
        };
      });

      console.log('Portfolio data:', portfolioData);
      setPortfolioData(portfolioData);
      if (portfolioData.length > 0 && !activeNavire) {
        setActiveNavire(portfolioData[0].navire_id);
      }
    } catch (error) {
      console.error('Error fetching client portfolio:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger votre portfolio',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getPositionsAvailableForResale = () => {
    if (!navireActif) return [];
    // Toutes les positions peuvent être revendues (couvertes ET non couvertes)
    return navireActif.positions;
  };

  const getVolumeCouvert = (position: any) => {
    // Les ventes flat sont considérées comme 100% couvertes
    if (position.type_deal === 'flat') {
      return position.volume_achete;
    }
    // Pour les ventes prime, on compte les couvertures réelles
    return position.couvertures.reduce((total: number, couv: any) => total + couv.volume_couvert, 0);
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getProductBadgeColor = (produit: string) => {
    switch (produit) {
      case 'mais':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'tourteau_soja':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'ble':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'orge':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'ddgs':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'ferrailles':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const calculerTauxCouverture = (navire: NavirePortfolioData) => {
    return navire.volume_total > 0 ? (navire.volume_couvert_total / navire.volume_total) * 100 : 0;
  };

  const navireActif = portfolioData.find(n => n.navire_id === activeNavire);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (portfolioData.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mon Portfolio</h1>
          <p className="text-muted-foreground">Vos positions par navire</p>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucune position</h3>
            <p className="text-muted-foreground">Vous n'avez aucune position active pour le moment.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mon Portfolio</h1>
        <p className="text-muted-foreground">Vos positions par navire</p>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Vue Détaillée
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Vue Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Navigation */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ship className="h-5 w-5" />
                  Mes Navires
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {portfolioData.map(navire => (
                  <button
                    key={navire.navire_id}
                    onClick={() => setActiveNavire(navire.navire_id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      activeNavire === navire.navire_id 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-card hover:bg-muted border-border'
                    }`}
                  >
                    <div className="font-medium">{navire.navire_nom}</div>
                    <div className="text-sm opacity-75">
                      {navire.produit} - {navire.volume_total} tonnes
                    </div>
                    <div className="text-xs opacity-60">
                      {navire.positions.length} position{navire.positions.length > 1 ? 's' : ''}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Main Content */}
            <div className="lg:col-span-3">
              {navireActif && (
                <div className="space-y-6">
                  {/* Header avec informations générales */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Ship className="h-5 w-5" />
                          {navireActif.navire_nom}
                        </CardTitle>
                        <Badge className={getProductBadgeColor(navireActif.produit)}>
                          {navireActif.produit}
                        </Badge>
                      </div>
                      <CardDescription>
                        <span className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Arrivée: {formatDate(navireActif.date_arrivee)}
                          </span>
                        </span>
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  {/* Informations du navire */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Capacité Totale
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{navireActif.quantite_totale} tonnes</div>
                        <div className="text-sm text-muted-foreground">Capacité du navire</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Volume Acheté
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{navireActif.volume_total} tonnes</div>
                        <div className="text-sm text-muted-foreground">
                          Couvert: {navireActif.volume_couvert_total} | Non couvert: {navireActif.volume_non_couvert_total}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Prime Moyenne
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatPrice(navireActif.prime_moyenne)}</div>
                        <div className="text-sm text-muted-foreground">Moyenne pondérée</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Détail des positions */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Détail des Positions</CardTitle>
                      <CardDescription>Liste de toutes vos positions sur ce navire</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {navireActif.positions.map((position, index) => (
                          <div key={position.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">Position #{index + 1}</div>
                                <div className="text-sm text-muted-foreground">
                                  {formatDate(position.date_deal)} - {position.type_deal === 'prime' ? 'Prime' : 'Flat'}
                                </div>
                                {position.prix_reference && (
                                  <div className="text-xs text-muted-foreground">
                                    Référence: {position.prix_reference}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold">{position.volume_achete} tonnes</div>
                                <div className="text-sm text-muted-foreground">
                                  Couvert: {position.volume_achete - position.volume_non_couvert} tonnes
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section Revente */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Revente de positions
                      </CardTitle>
                      <CardDescription>
                        Remettez en vente vos positions sur le marché secondaire
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {getPositionsAvailableForResale().length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                          Aucune position disponible pour la revente.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {getPositionsAvailableForResale().map((pos, idx) => {
                            const volumeCouvert = getVolumeCouvert(pos);
                            
                            return (
                              <div key={pos.id} className="border rounded-lg p-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium">Position #{idx + 1}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {navireActif?.navire_nom} - {formatDate(pos.date_deal)}
                                    </div>
                                  </div>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setReventeDialog({open: true, position: pos})}
                                  >
                                    <ShoppingCart className="h-4 w-4 mr-2" />
                                    Mettre en vente
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Timeline des Navires
              </CardTitle>
              <CardDescription>
                Visualisation temporelle de vos navires et dates d'arrivée
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NavireGanttChart
                navires={portfolioData.map(navire => ({
                  navire_id: navire.navire_id,
                  navire_nom: navire.navire_nom,
                  produit: navire.produit,
                  date_arrivee: navire.date_arrivee,
                  volume_total: navire.volume_total,
                  fournisseur: navire.fournisseur,
                }))}
                onNavireClick={(navireId) => setActiveNavire(navireId)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReventeCreationDialog
        open={reventeDialog.open}
        onClose={() => setReventeDialog({open: false, position: null})}
        position={reventeDialog.position}
        navireNom={navireActif?.navire_nom || ''}
        produit={navireActif?.produit || ''}
      />
    </div>
  );
}