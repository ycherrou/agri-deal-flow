
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, RefreshCw, PieChart, Calculator } from 'lucide-react';
import { calculatePortfolioPnL, formatPnL, getPnLColor, calculatePnLByClient, NavirePnLByClient } from '@/lib/pnlUtils';
import { formatPriceDisplay, ProductType, PriceType } from '@/lib/priceUtils';
import { volumeToContracts, supportsContracts } from '@/lib/futuresUtils';
import { PortfolioPnL, PnLData } from '@/types/index';
import { supabase } from '@/integrations/supabase/client';
import PnLPieCharts from '@/components/PnLPieCharts';

export default function PnL() {
  const [portfolioPnL, setPortfolioPnL] = useState<PortfolioPnL | null>(null);
  const [pnlByClient, setPnlByClient] = useState<NavirePnLByClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'client'>('admin');
  const { toast } = useToast();

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchPnLData();
    }
  }, [userRole]);

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: client } = await supabase
          .from('clients')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (client) {
          setUserRole(client.role);
        }
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  const fetchPnLData = async () => {
    setLoading(true);
    try {
      const [data, clientData] = await Promise.all([
        calculatePortfolioPnL(userRole),
        calculatePnLByClient(userRole)
      ]);
      setPortfolioPnL(data);
      setPnlByClient(clientData);
    } catch (error) {
      console.error('Error fetching P&L data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données P&L',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getProductBadge = (produit: string) => {
    const colors = {
      mais: 'bg-yellow-100 text-yellow-800',
      tourteau_soja: 'bg-green-100 text-green-800',
      ble: 'bg-orange-100 text-orange-800',
      orge: 'bg-purple-100 text-purple-800'
    };
    
    const labels = {
      mais: 'Maïs',
      tourteau_soja: 'Tourteau Soja',
      ble: 'Blé',
      orge: 'Orge'
    };

    return (
      <Badge className={colors[produit as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {labels[produit as keyof typeof labels] || produit}
      </Badge>
    );
  };

  // Helper function to format price display in table
  const formatTablePrice = (price: number, product: string, isFlat: boolean = false) => {
    if (isFlat) {
      return `${price.toFixed(2)} USD/MT`;
    }
    // Pour les primes : Cts/Bu pour maïs/tourteau, USD/MT pour blé/orge
    const unit = (product === 'mais' || product === 'tourteau_soja') ? 'Cts/Bu' : 'USD/MT';
    return `${price.toFixed(2)} ${unit}`;
  };

  // Helper function to format volume display in contracts or tonnes
  const formatVolumeDisplay = (volumeCouvert: number, volumeTotal: number, produit: string) => {
    const productType = produit as ProductType;
    
    if (supportsContracts(productType)) {
      const contratsCouverts = volumeToContracts(volumeCouvert, productType);
      const contratsTotal = volumeToContracts(volumeTotal, productType);
      
      return (
        <div className="text-sm">
          <div>{contratsCouverts.toLocaleString('fr-FR')} contrats</div>
          <div className="text-muted-foreground text-xs">
            / {contratsTotal.toLocaleString('fr-FR')} contrats
          </div>
        </div>
      );
    } else {
      return (
        <div className="text-sm">
          <div>{volumeCouvert.toLocaleString('fr-FR')}t</div>
          <div className="text-muted-foreground text-xs">
            / {volumeTotal.toLocaleString('fr-FR')}t (N/A contrats)
          </div>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!portfolioPnL) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Aucune donnée P&L disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profit & Loss</h1>
          <p className="text-muted-foreground">
            Analyse des performances par différentiel de primes et futures
          </p>
        </div>
        <Button onClick={fetchPnLData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Résumé P&L */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P&L Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPnLColor(portfolioPnL.pnl_total)}`}>
              {formatPnL(portfolioPnL.pnl_total)}
            </div>
            <p className="text-xs text-muted-foreground">
              {portfolioPnL.nombre_navires} navires
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P&L Prime</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPnLColor(portfolioPnL.pnl_prime_total)}`}>
              {formatPnL(portfolioPnL.pnl_prime_total)}
            </div>
            <p className="text-xs text-muted-foreground">
              Différentiel prime
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P&L Flat</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPnLColor(portfolioPnL.pnl_flat_total)}`}>
              {formatPnL(portfolioPnL.pnl_flat_total)}
            </div>
            <p className="text-xs text-muted-foreground">
              Différentiel flat
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P&L Futures</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPnLColor(portfolioPnL.pnl_futures_total)}`}>
              {formatPnL(portfolioPnL.pnl_futures_total)}
            </div>
            <p className="text-xs text-muted-foreground">
              Moyenne pondérée
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume Total</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portfolioPnL.volume_total.toLocaleString('fr-FR')}
            </div>
            <p className="text-xs text-muted-foreground">
              tonnes traitées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Système d'onglets */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="client-charts">Répartition par client</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {/* Détail par navire */}
          <Card>
            <CardHeader>
              <CardTitle>Détail P&L par Navire</CardTitle>
              <CardDescription>
                Analyse détaillée des performances par navire
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Navire</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Achat CFR</TableHead>
                      <TableHead className="text-right">Vente Moy.</TableHead>
                      <TableHead className="text-right">P&L Prime</TableHead>
                      <TableHead className="text-right">P&L Flat</TableHead>
                      <TableHead className="text-right">Futures Achat Moy.</TableHead>
                      <TableHead className="text-right">Futures Vente Moy.</TableHead>
                      <TableHead className="text-right">P&L Futures</TableHead>
                      <TableHead className="text-right">P&L Total</TableHead>
                      <TableHead className="text-right">Contrats</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolioPnL.navires.map((navire) => (
                      <TableRow key={navire.navire_id}>
                        <TableCell className="font-medium">{navire.navire_nom}</TableCell>
                        <TableCell>{getProductBadge(navire.produit)}</TableCell>
                        <TableCell className="text-right">
                          {formatTablePrice(navire.prime_achat, navire.produit, true)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatTablePrice(navire.prime_vente_moyenne, navire.produit, true)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${getPnLColor(navire.pnl_prime)}`}>
                          {formatPnL(navire.pnl_prime)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${getPnLColor(navire.pnl_flat)}`}>
                          {formatPnL(navire.pnl_flat)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatTablePrice(navire.prix_futures_achat_moyen, navire.produit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatTablePrice(navire.prix_futures_vente_moyen, navire.produit)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${getPnLColor(navire.pnl_futures)}`}>
                          {formatPnL(navire.pnl_futures)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${getPnLColor(navire.pnl_total)}`}>
                          {formatPnL(navire.pnl_total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatVolumeDisplay(navire.volume_couvert_achat, navire.volume_total_achete, navire.produit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Répartition P&L */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Répartition P&L par Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">P&L Prime</span>
                    <span className={`text-sm font-bold ${getPnLColor(portfolioPnL.pnl_prime_total)}`}>
                      {formatPnL(portfolioPnL.pnl_prime_total)}
                    </span>
                  </div>
                  <Progress 
                    value={Math.abs(portfolioPnL.pnl_prime_total) / Math.abs(portfolioPnL.pnl_total) * 100} 
                    className="h-2" 
                  />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">P&L Flat</span>
                    <span className={`text-sm font-bold ${getPnLColor(portfolioPnL.pnl_flat_total)}`}>
                      {formatPnL(portfolioPnL.pnl_flat_total)}
                    </span>
                  </div>
                  <Progress 
                    value={Math.abs(portfolioPnL.pnl_flat_total) / Math.abs(portfolioPnL.pnl_total) * 100} 
                    className="h-2" 
                  />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">P&L Futures</span>
                    <span className={`text-sm font-bold ${getPnLColor(portfolioPnL.pnl_futures_total)}`}>
                      {formatPnL(portfolioPnL.pnl_futures_total)}
                    </span>
                  </div>
                  <Progress 
                    value={Math.abs(portfolioPnL.pnl_futures_total) / Math.abs(portfolioPnL.pnl_total) * 100} 
                    className="h-2" 
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance par Produit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(
                    portfolioPnL.navires.reduce((acc, navire) => {
                      if (!acc[navire.produit]) {
                        acc[navire.produit] = { pnl: 0, volume: 0 };
                      }
                      acc[navire.produit].pnl += navire.pnl_total;
                      acc[navire.produit].volume += navire.volume_total_achete;
                      return acc;
                    }, {} as Record<string, { pnl: number; volume: number }>)
                  ).map(([produit, data]) => (
                    <div key={produit} className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        {getProductBadge(produit)}
                        <span className="text-sm text-muted-foreground">
                          {data.volume.toLocaleString('fr-FR')}t
                        </span>
                      </div>
                      <span className={`text-sm font-bold ${getPnLColor(data.pnl)}`}>
                        {formatPnL(data.pnl)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="client-charts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Camemberts par navire
              </CardTitle>
              <CardDescription>
                Répartition des P&L et volumes par client dans chaque navire
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PnLPieCharts navires={pnlByClient} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
