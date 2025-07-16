import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { getLatestPricesForMaturities } from '@/lib/priceUtils';
import { Ship, Shield, TrendingUp, DollarSign, Package, AlertCircle } from 'lucide-react';

interface ClientPortfolioData {
  id: string;
  nom: string;
  produit: string;
  positions: Array<{
    id: string;
    contrat_reference: string;
    volume_achete: number;
    prime_payee: number;
    type_deal: 'prime' | 'flat';
    prix_flat: number | null;
    date_deal: string;
    couvertures: Array<{
      id: string;
      volume_couvert: number;
      prix_futures: number;
      date_couverture: string;
    }>;
    volume_non_couvert: number;
    prix_cbot_actuel: number;
    pru: number;
  }>;
  volume_total: number;
  volume_couvert_total: number;
  volume_non_couvert_total: number;
  prime_moyenne: number;
  pru_moyen: number;
}

interface PrixMarche {
  echeance_id: string;
  prix: number;
  created_at: string;
  echeance?: {
    nom: string;
    active: boolean;
  };
}

export default function ClientPortfolio() {
  const [portfolioData, setPortfolioData] = useState<ClientPortfolioData[]>([]);
  const [prixMarche, setPrixMarche] = useState<PrixMarche[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNavire, setActiveNavire] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      await fetchPrixMarche();
      await fetchClientPortfolio();
    };
    loadData();
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
      console.log('User:', user);
      if (!user) return;

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      console.log('Client data:', clientData, 'Error:', clientError);
      if (!clientData) return;

      // Récupérer les navires avec les ventes du client
      const { data: naviresData, error } = await supabase
        .from('navires')
        .select(`
          id,
          nom,
          produit,
          ventes!inner (
            id,
            volume,
            prime_vente,
            prix_reference,
            type_deal,
            prix_flat,
            client_id,
            couvertures (
              id,
              volume_couvert,
              prix_futures,
              date_couverture
            )
          )
        `)
        .eq('ventes.client_id', clientData.id);

      console.log('Navires data:', naviresData, 'Error:', error);
      if (error) throw error;

      // Récupérer les prix du marché les plus récents
      const { data: prixMarcheData } = await supabase
        .from('prix_marche')
        .select('echeance_id, prix, created_at, echeance:echeances!inner(nom, active)')
        .eq('echeance.active', true)
        .order('created_at', { ascending: false });

      const latestPrices = getLatestPricesForMaturities(prixMarcheData || []);

      // Regrouper les ventes par navire
      const naviresGroupes = new Map<string, any>();
      
      (naviresData || []).forEach(navire => {
        if (!naviresGroupes.has(navire.id)) {
          naviresGroupes.set(navire.id, {
            id: navire.id,
            nom: navire.nom,
            produit: navire.produit,
            ventes: []
          });
        }
        naviresGroupes.get(navire.id)!.ventes.push(...navire.ventes);
      });

      // Transformer les données pour le portfolio client
      const portfolioData: ClientPortfolioData[] = Array.from(naviresGroupes.values()).map(navire => {
        const positions = navire.ventes.map((vente: any) => {
          const volumeCouvert = vente.couvertures.reduce((sum: number, c: any) => sum + c.volume_couvert, 0);
          const volumeNonCouvert = vente.volume - volumeCouvert;
          
          // Chercher le prix CBOT le plus récent pour le contrat de référence
          const prixCbotActuel = vente.prix_reference ? (latestPrices.get(vente.prix_reference) || 0) : 0;
          
          // Calcul PRU
          let pru = 0;
          if (vente.type_deal === 'flat') {
            pru = vente.prix_flat || 0;
          } else {
            if (volumeCouvert === 0) {
              pru = prixCbotActuel + (vente.prime_vente || 0);
            } else {
              const prixMoyenCouvert = vente.couvertures.reduce((sum: number, c: any) => 
                sum + c.prix_futures * c.volume_couvert, 0) / volumeCouvert;
              const prixMoyenPondere = (prixMoyenCouvert * volumeCouvert + prixCbotActuel * volumeNonCouvert) / vente.volume;
              pru = prixMoyenPondere + (vente.prime_vente || 0);
            }
            
            // Facteur de conversion pour les ventes prime
            const facteurConversion = navire.produit === 'mais' ? 0.3937 : 
                                     navire.produit === 'tourteau_soja' ? 0.4640 : 1;
            pru = pru * facteurConversion;
          }

          return {
            id: vente.id,
            contrat_reference: vente.prix_reference || 'N/A',
            volume_achete: vente.volume,
            prime_payee: vente.prime_vente || 0,
            type_deal: vente.type_deal,
            prix_flat: vente.prix_flat,
            date_deal: vente.date_deal,
            couvertures: vente.couvertures,
            volume_non_couvert: volumeNonCouvert,
            prix_cbot_actuel: prixCbotActuel,
            pru
          };
        });

        // Calculs agrégés pour le navire
        const volumeTotal = positions.reduce((sum, p) => sum + p.volume_achete, 0);
        const volumeCouvertTotal = positions.reduce((sum, p) => sum + (p.volume_achete - p.volume_non_couvert), 0);
        const volumeNonCouvertTotal = volumeTotal - volumeCouvertTotal;
        
        // Prime moyenne pondérée
        const primeMoyenne = positions.reduce((sum, p) => sum + (p.prime_payee * p.volume_achete), 0) / volumeTotal;
        
        // PRU moyen pondéré
        const pruMoyen = positions.reduce((sum, p) => sum + (p.pru * p.volume_achete), 0) / volumeTotal;

        return {
          id: navire.id,
          nom: navire.nom,
          produit: navire.produit,
          positions,
          volume_total: volumeTotal,
          volume_couvert_total: volumeCouvertTotal,
          volume_non_couvert_total: volumeNonCouvertTotal,
          prime_moyenne: primeMoyenne,
          pru_moyen: pruMoyen
        };
      });

      setPortfolioData(portfolioData);
      if (portfolioData.length > 0 && !activeNavire) {
        setActiveNavire(portfolioData[0].id);
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

  const formatPrice = (price: number, product?: string) => {
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
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const calculerTauxCouverture = (navire: ClientPortfolioData) => {
    return navire.volume_total > 0 ? (navire.volume_couvert_total / navire.volume_total) * 100 : 0;
  };

  const navireActif = portfolioData.find(n => n.id === activeNavire);

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
                key={navire.id}
                onClick={() => setActiveNavire(navire.id)}
                className={`w-full p-3 rounded-lg border text-left transition-colors ${
                  activeNavire === navire.id 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-card hover:bg-muted border-border'
                }`}
              >
                <div className="font-medium">{navire.nom}</div>
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
                      {navireActif.nom}
                    </CardTitle>
                    <Badge className={getProductBadgeColor(navireActif.produit)}>
                      {navireActif.produit}
                    </Badge>
                  </div>
                  <CardDescription>
                    {navireActif.positions.length} position{navireActif.positions.length > 1 ? 's' : ''} - Volume total: {navireActif.volume_total} tonnes
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Métriques principales */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                      <DollarSign className="h-4 w-4" />
                      Prime Payée
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatPrice(navireActif.prime_moyenne, navireActif.produit)}</div>
                    <div className="text-sm text-muted-foreground">Moyenne pondérée</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Prix de Marché
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatPrice(navireActif.positions[0]?.prix_cbot_actuel || 0, navireActif.produit)}</div>
                    <div className="text-sm text-muted-foreground">Prix CBOT actuel</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      PRU
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{formatPrice(navireActif.pru_moyen, navireActif.produit)}</div>
                    <div className="text-sm text-muted-foreground">Prix de revient moyen</div>
                  </CardContent>
                </Card>
              </div>

              {/* Couverture et exposition */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Statut de Couverture
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Taux de couverture</span>
                      <span className="font-medium">{calculerTauxCouverture(navireActif).toFixed(1)}%</span>
                    </div>
                    <Progress value={calculerTauxCouverture(navireActif)} className="h-2" />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Volume couvert:</span>
                        <span className="font-medium">{navireActif.volume_couvert_total.toFixed(1)} tonnes</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Volume non couvert:</span>
                        <span className="font-medium">{navireActif.volume_non_couvert_total.toFixed(1)} tonnes</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Exposition au Risque
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Volume exposé</span>
                      <span className="font-medium">{navireActif.volume_non_couvert_total.toFixed(1)} tonnes</span>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Valeur exposition (prix moyen)</div>
                      <div className="text-lg font-bold">
                        {formatPrice(navireActif.volume_non_couvert_total * (navireActif.positions[0]?.prix_cbot_actuel || 0), navireActif.produit)}
                      </div>
                    </div>
                    {navireActif.volume_non_couvert_total > 0 && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-4 w-4" />
                        Position non couverte exposée aux variations de prix
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Détail des positions */}
              <Card>
                <CardHeader>
                  <CardTitle>Détail des Positions</CardTitle>
                  <CardDescription>
                    Vue détaillée de vos positions par contrat de référence
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {navireActif.positions.map((position, index) => (
                      <div key={position.id} className="border rounded-lg p-4 bg-muted/50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium">Position #{index + 1}</div>
                            <div className="text-sm text-muted-foreground">
                              {position.contrat_reference} - {position.type_deal === 'prime' ? 'Prime' : 'Flat'}
                            </div>
                          </div>
                          <Badge variant={position.type_deal === 'prime' ? 'default' : 'secondary'}>
                            {position.type_deal === 'prime' ? 'Prime' : 'Flat'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Volume</div>
                            <div className="font-medium">{position.volume_achete} tonnes</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">
                              {position.type_deal === 'prime' ? 'Prime' : 'Prix flat'}
                            </div>
                            <div className="font-medium">
                              {formatPrice(position.type_deal === 'prime' ? position.prime_payee : (position.prix_flat || 0), navireActif.produit)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Volume couvert</div>
                            <div className="font-medium">{(position.volume_achete - position.volume_non_couvert).toFixed(1)} tonnes</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">PRU</div>
                            <div className="font-medium">{formatPrice(position.pru, navireActif.produit)}</div>
                          </div>
                        </div>

                        {/* Détail des couvertures pour cette position */}
                        {position.couvertures.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="text-sm font-medium mb-2">Couvertures:</div>
                            <div className="space-y-2">
                              {position.couvertures.map((couverture) => (
                                <div key={couverture.id} className="flex justify-between items-center text-sm bg-background p-2 rounded">
                                  <div>
                                    <span className="font-medium">{couverture.volume_couvert} tonnes</span>
                                    <span className="text-muted-foreground ml-2">le {formatDate(couverture.date_couverture)}</span>
                                  </div>
                                  <div className="font-medium">{formatPrice(couverture.prix_futures, navireActif.produit)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}