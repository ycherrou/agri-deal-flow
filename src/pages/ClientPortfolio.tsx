import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Ship, Shield, TrendingUp, DollarSign, Package, AlertCircle } from 'lucide-react';

interface ClientPortfolioData {
  id: string;
  nom: string;
  produit: string;
  contrat_reference: string;
  volume_achete: number;
  prime_payee: number;
  couvertures: Array<{
    id: string;
    volume_couvert: number;
    prix_futures: number;
    date_couverture: string;
  }>;
  volume_non_couvert: number;
  prix_cbot_actuel: number;
  pru: number;
}

interface PrixMarche {
  echeance: string;
  prix: number;
  date_maj: string;
}

export default function ClientPortfolio() {
  const [portfolioData, setPortfolioData] = useState<ClientPortfolioData[]>([]);
  const [prixMarche, setPrixMarche] = useState<PrixMarche[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNavire, setActiveNavire] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchClientPortfolio();
    fetchPrixMarche();
  }, []);

  const fetchPrixMarche = async () => {
    try {
      const { data, error } = await supabase
        .from('prix_marche')
        .select('echeance, prix, date_maj')
        .order('date_maj', { ascending: false });

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

      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

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

      if (error) throw error;

      // Transformer les données pour le portfolio client
      const portfolioData: ClientPortfolioData[] = (naviresData || []).flatMap(navire => 
        navire.ventes.map(vente => {
          const volumeCouvert = vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
          const volumeNonCouvert = vente.volume - volumeCouvert;
          const prixCbotActuel = prixMarche.find(p => p.echeance === vente.prix_reference)?.prix || 0;
          
          // Calcul PRU
          let pru = 0;
          if (vente.type_deal === 'flat') {
            pru = vente.prix_flat || 0;
          } else {
            if (volumeCouvert === 0) {
              pru = prixCbotActuel + (vente.prime_vente || 0);
            } else {
              const prixMoyenCouvert = vente.couvertures.reduce((sum, c) => 
                sum + c.prix_futures * c.volume_couvert, 0) / volumeCouvert;
              const prixMoyenPondere = (prixMoyenCouvert * volumeCouvert + prixCbotActuel * volumeNonCouvert) / vente.volume;
              pru = prixMoyenPondere + (vente.prime_vente || 0);
            }
          }

          return {
            id: navire.id,
            nom: navire.nom,
            produit: navire.produit,
            contrat_reference: vente.prix_reference || 'N/A',
            volume_achete: vente.volume,
            prime_payee: vente.prime_vente || 0,
            couvertures: vente.couvertures,
            volume_non_couvert: volumeNonCouvert,
            prix_cbot_actuel: prixCbotActuel,
            pru
          };
        })
      );

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
    return navire.volume_achete > 0 ? ((navire.volume_achete - navire.volume_non_couvert) / navire.volume_achete) * 100 : 0;
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
                  {navire.produit} - {navire.volume_achete} MT
                </div>
                <div className="text-xs opacity-60">
                  {navire.contrat_reference}
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
                    Contrat de référence: {navireActif.contrat_reference}
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
                    <div className="text-2xl font-bold">{navireActif.volume_achete} MT</div>
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
                    <div className="text-2xl font-bold">{formatPrice(navireActif.prime_payee, navireActif.produit)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Prix CBOT Actuel
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatPrice(navireActif.prix_cbot_actuel, navireActif.produit)}</div>
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
                    <div className="text-2xl font-bold text-primary">{formatPrice(navireActif.pru, navireActif.produit)}</div>
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
                        <span className="font-medium">{(navireActif.volume_achete - navireActif.volume_non_couvert).toFixed(1)} MT</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Volume non couvert:</span>
                        <span className="font-medium">{navireActif.volume_non_couvert.toFixed(1)} MT</span>
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
                      <span className="font-medium">{navireActif.volume_non_couvert.toFixed(1)} MT</span>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">Valeur exposition (prix actuel)</div>
                      <div className="text-lg font-bold">
                        {formatPrice(navireActif.volume_non_couvert * navireActif.prix_cbot_actuel, navireActif.produit)}
                      </div>
                    </div>
                    {navireActif.volume_non_couvert > 0 && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-4 w-4" />
                        Position non couverte exposée aux variations de prix
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Détail des couvertures */}
              {navireActif.couvertures.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Détail des Couvertures</CardTitle>
                    <CardDescription>
                      Historique de vos opérations de couverture
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {navireActif.couvertures.map((couverture) => (
                        <div key={couverture.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="space-y-1">
                            <div className="font-medium">{couverture.volume_couvert} MT</div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(couverture.date_couverture)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatPrice(couverture.prix_futures, navireActif.produit)}</div>
                            <div className="text-sm text-muted-foreground">Prix futures</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}