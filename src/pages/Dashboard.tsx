import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Ship, TrendingUp, Users, DollarSign, Activity, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  totalNavires: number;
  totalVentes: number;
  totalVolume: number;
  totalValue: number;
  couvertureRate: number;
  activeClients: number;
}

interface NavireWithStats {
  id: string;
  nom: string;
  produit: string;
  quantite_totale: number;
  date_arrivee: string;
  fournisseur: string;
  volumeVendu: number;
  nombreClients: number;
  prochaineCouverture: number;
}

interface ClientData {
  role: 'admin' | 'client';
  nom: string;
  id: string;
}

interface VenteWithDetails {
  id: string;
  volume: number;
  type_deal: 'prime' | 'flat';
  prime_vente: number | null;
  prix_flat: number | null;
  date_deal: string;
  prix_reference: string | null;
  navire: {
    nom: string;
    produit: string;
  };
  volumeCouvert: number;
  pru: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalNavires: 0,
    totalVentes: 0,
    totalVolume: 0,
    totalValue: 0,
    couvertureRate: 0,
    activeClients: 0
  });
  const [navires, setNavires] = useState<NavireWithStats[]>([]);
  const [ventes, setVentes] = useState<VenteWithDetails[]>([]);
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get current user and role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientData } = await supabase
        .from('clients')
        .select('id, nom, role')
        .eq('user_id', user.id)
        .single();

      if (!clientData) return;
      setClient(clientData);

      if (clientData.role === 'admin') {
        await fetchAdminDashboard();
      } else {
        await fetchClientDashboard(clientData.id);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données du tableau de bord.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminDashboard = async () => {
    // Fetch navires with stats
    const { data: naviresData } = await supabase
      .from('navires')
      .select(`
        id,
        nom,
        produit,
        quantite_totale,
        date_arrivee,
        fournisseur,
        ventes (
          volume,
          client_id
        )
      `);

    if (naviresData) {
      const naviresWithStats = naviresData.map(navire => ({
        ...navire,
        volumeVendu: navire.ventes.reduce((sum, vente) => sum + vente.volume, 0),
        nombreClients: new Set(navire.ventes.map(vente => vente.client_id)).size,
        prochaineCouverture: Math.max(0, navire.quantite_totale - navire.ventes.reduce((sum, vente) => sum + vente.volume, 0))
      }));
      setNavires(naviresWithStats);

      // Calculate stats
      const totalNavires = naviresData.length;
      const totalVentes = naviresData.reduce((sum, navire) => sum + navire.ventes.length, 0);
      const totalVolume = naviresData.reduce((sum, navire) => 
        sum + navire.ventes.reduce((vSum, vente) => vSum + vente.volume, 0), 0
      );

      setStats({
        totalNavires,
        totalVentes,
        totalVolume,
        totalValue: totalVolume * 250, // Mock calculation
        couvertureRate: 75, // Mock calculation
        activeClients: 12 // Mock calculation
      });
    }
  };

  const fetchClientDashboard = async (clientId: string) => {
    // Fetch client's ventes
    const { data: ventesData } = await supabase
      .from('ventes')
      .select(`
        id,
        volume,
        type_deal,
        prime_vente,
        prix_flat,
        date_deal,
        prix_reference,
        navire:navires (
          nom,
          produit
        ),
        couvertures (
          volume_couvert
        )
      `)
      .eq('client_id', clientId);

    if (ventesData) {
      const ventesWithDetails = ventesData.map(vente => ({
        ...vente,
        volumeCouvert: vente.couvertures.reduce((sum, couv) => sum + couv.volume_couvert, 0),
        pru: vente.type_deal === 'flat' ? vente.prix_flat || 0 : 300 // Mock PRU calculation
      }));
      setVentes(ventesWithDetails);

      // Calculate client stats
      const totalVolume = ventesData.reduce((sum, vente) => sum + vente.volume, 0);
      const totalCouvert = ventesData.reduce((sum, vente) => 
        sum + vente.couvertures.reduce((cSum, couv) => cSum + couv.volume_couvert, 0), 0
      );

      setStats({
        totalNavires: new Set(ventesData.map(vente => vente.navire?.nom)).size,
        totalVentes: ventesData.length,
        totalVolume,
        totalValue: totalVolume * 250,
        couvertureRate: totalVolume > 0 ? (totalCouvert / totalVolume) * 100 : 0,
        activeClients: 1
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getProductBadgeColor = (produit: string) => {
    switch (produit) {
      case 'mais': return 'bg-yellow-100 text-yellow-800';
      case 'tourteau_soja': return 'bg-green-100 text-green-800';
      case 'ble': return 'bg-orange-100 text-orange-800';
      case 'orge': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">
          {client?.role === 'admin' ? 'Tableau de bord Administrateur' : 'Mon Tableau de bord'}
        </h1>
        <Badge variant="secondary" className="text-sm">
          {client?.nom}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {client?.role === 'admin' ? 'Navires actifs' : 'Navires'}
                </p>
                <p className="text-2xl font-bold">{stats.totalNavires}</p>
              </div>
              <Ship className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Deals</p>
                <p className="text-2xl font-bold">{stats.totalVentes}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Volume Total</p>
                <p className="text-2xl font-bold">{stats.totalVolume.toLocaleString()} MT</p>
              </div>
              <Activity className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taux Couverture</p>
                <p className="text-2xl font-bold">{stats.couvertureRate.toFixed(1)}%</p>
              </div>
              <div className="flex flex-col items-end">
                <AlertCircle className={`h-8 w-8 ${stats.couvertureRate >= 80 ? 'text-success' : 'text-warning'}`} />
                <Progress value={stats.couvertureRate} className="w-16 mt-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content based on role */}
      {client?.role === 'admin' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Ship className="h-5 w-5 mr-2" />
                Navires Récents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {navires.slice(0, 5).map((navire) => (
                  <div key={navire.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{navire.nom}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge className={getProductBadgeColor(navire.produit)}>
                          {navire.produit}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {navire.quantite_totale} MT
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {navire.volumeVendu} / {navire.quantite_totale} MT
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {navire.nombreClients} clients
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Activité Récente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Deal #{i}</p>
                      <p className="text-sm text-muted-foreground">
                        Il y a {i} heure{i > 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {i % 2 === 0 ? 'Prime' : 'Flat'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Mes Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ventes.map((vente) => (
                <div key={vente.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{vente.navire?.nom}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge className={getProductBadgeColor(vente.navire?.produit || '')}>
                        {vente.navire?.produit}
                      </Badge>
                      <Badge variant={vente.type_deal === 'prime' ? 'default' : 'secondary'}>
                        {vente.type_deal}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {vente.volume} MT
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Couvert: {vente.volumeCouvert} MT ({((vente.volumeCouvert / vente.volume) * 100).toFixed(1)}%)
                    </p>
                    <p className="text-xs text-success">
                      PRU: {formatCurrency(vente.pru)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}