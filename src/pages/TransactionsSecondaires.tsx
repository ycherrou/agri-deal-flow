import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Euro, Users, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Transaction {
  id: string;
  revente_id: string;
  bid_id: string;
  vendeur_id: string;
  acheteur_id: string;
  prix_achat_original: number;
  prix_vente_final: number;
  volume_transige: number;
  gain_vendeur: number;
  commission_admin: number | null;
  date_transaction: string;
  statut: string;
  vendeur: {
    nom: string;
  } | null;
  acheteur: {
    nom: string;
  } | null;
  navire: {
    nom: string;
    produit: string;
  };
}

interface Bid {
  id: string;
  revente_id: string;
  client_id: string;
  prix_bid: number;
  volume_bid: number;
  date_bid: string;
  statut: string;
  accepted_at?: string;
  accepted_by_seller: boolean;
  client: {
    nom: string;
  };
  revente: {
    vente: {
      navire: {
        nom: string;
        produit: string;
      };
    };
  };
}

interface Stats {
  totalTransactions: number;
  totalGains: number;
  totalCommissions: number;
  activeReventes: number;
}

export default function TransactionsSecondaires() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingBids, setPendingBids] = useState<Bid[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTransactions: 0,
    totalGains: 0,
    totalCommissions: 0,
    activeReventes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: client } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id)
          .single();
        setCurrentUser(client);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (currentUser?.role === 'admin') {
        await Promise.all([
          fetchTransactions(),
          fetchPendingBids(),
          fetchStats(),
        ]);
      } else {
        await fetchSellerBids();
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions_marche_secondaire')
      .select('*')
      .order('date_transaction', { ascending: false });

    if (error) throw error;

    // Enrichir avec les infos navire et clients
    const enrichedTransactions = await Promise.all(
      (data || []).map(async (transaction) => {
        const [reventeResult, vendeurResult, acheteurResult] = await Promise.all([
          supabase
            .from('reventes_clients')
            .select(`
              vente:ventes(
                navire:navires(nom, produit)
              )
            `)
            .eq('id', transaction.revente_id)
            .single(),
          supabase
            .from('clients')
            .select('nom')
            .eq('id', transaction.vendeur_id)
            .single(),
          supabase
            .from('clients')
            .select('nom')
            .eq('id', transaction.acheteur_id)
            .single()
        ]);

        return {
          ...transaction,
          navire: reventeResult.data?.vente?.navire || { nom: 'N/A', produit: 'N/A' },
          vendeur: vendeurResult.data || null,
          acheteur: acheteurResult.data || null,
        };
      })
    );

    setTransactions(enrichedTransactions);
  };

  const fetchPendingBids = async () => {
    const { data, error } = await supabase
      .from('bids_marche_secondaire')
      .select(`
        *,
        client:clients(nom),
        revente:reventes_clients(
          vente:ventes(
            navire:navires(nom, produit)
          )
        )
      `)
      .eq('statut', 'active')
      .order('date_bid', { ascending: false });

    if (error) throw error;
    setPendingBids(data || []);
  };

  const fetchSellerBids = async () => {
    // Pour les vendeurs, récupérer leurs offres reçues
    const { data, error } = await supabase
      .from('bids_marche_secondaire')
      .select(`
        *,
        client:clients(nom),
        revente:reventes_clients(
          vente:ventes!inner(
            client_id,
            navire:navires(nom, produit)
          )
        )
      `)
      .eq('revente.vente.client_id', currentUser.id)
      .eq('statut', 'active');

    if (error) throw error;
    setPendingBids(data || []);
  };

  const fetchStats = async () => {
    const { data: transactionStats } = await supabase
      .from('transactions_marche_secondaire')
      .select('gain_vendeur, commission_admin');

    const { data: reventeStats } = await supabase
      .from('reventes_clients')
      .select('id')
      .eq('etat', 'vendu')
      .eq('validated_by_admin', true);

    const totalGains = transactionStats?.reduce((sum, t) => sum + (t.gain_vendeur || 0), 0) || 0;
    const totalCommissions = transactionStats?.reduce((sum, t) => sum + (t.commission_admin || 0), 0) || 0;

    setStats({
      totalTransactions: transactionStats?.length || 0,
      totalGains,
      totalCommissions,
      activeReventes: reventeStats?.length || 0,
    });
  };

  const acceptBid = async (bidId: string) => {
    try {
      const { data, error } = await supabase.rpc('accept_bid_and_create_transaction', {
        bid_id_param: bidId,
        seller_client_id: currentUser.id,
      });

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Offre acceptée et transaction créée !",
      });

      fetchData();
    } catch (error) {
      console.error('Erreur lors de l\'acceptation:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'accepter l'offre.",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: number, produit: string) => {
    const currency = produit === 'mais' ? '€/T' : '€/T';
    return `${price.toFixed(2)} ${currency}`;
  };

  const formatGain = (gain: number) => {
    const color = gain >= 0 ? 'text-green-600' : 'text-red-600';
    const symbol = gain >= 0 ? '+' : '';
    return <span className={color}>{symbol}{gain.toFixed(2)} €</span>;
  };

  if (loading) {
    return <div className="p-6">Chargement...</div>;
  }

  if (currentUser?.role === 'admin') {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Transactions Marché Secondaire</h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTransactions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gains Totaux</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.totalGains.toFixed(2)} €
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commissions</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCommissions.toFixed(2)} €</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reventes Actives</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeReventes}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="pending">Offres en Attente</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            <div className="grid gap-4">
              {transactions.map((transaction) => (
                <Card key={transaction.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">{transaction.navire.nom}</h3>
                          <Badge variant="outline">{transaction.navire.produit}</Badge>
                          <Badge variant="default">{transaction.statut}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.vendeur?.nom || 'N/A'} → {transaction.acheteur?.nom || 'N/A'}
                        </div>
                        <div className="text-sm">
                          Volume: {transaction.volume_transige.toFixed(2)} T
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm text-muted-foreground">
                          Prix: {formatPrice(transaction.prix_vente_final, transaction.navire.produit)}
                        </div>
                        <div className="font-semibold">
                          Gain: {formatGain(transaction.gain_vendeur)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(transaction.date_transaction).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            <div className="grid gap-4">
              {pendingBids.map((bid) => (
                <Card key={bid.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">{bid.revente.vente.navire.nom}</h3>
                          <Badge variant="outline">{bid.revente.vente.navire.produit}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Offre de: {bid.client.nom}
                        </div>
                        <div className="text-sm">
                          Volume: {bid.volume_bid.toFixed(2)} T
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className="font-semibold">
                          {formatPrice(bid.prix_bid, bid.revente.vente.navire.produit)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(bid.date_bid).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Interface vendeur
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mes Offres Reçues</h1>
      </div>

      <div className="grid gap-4">
        {pendingBids.map((bid) => (
          <Card key={bid.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold">{bid.revente.vente.navire.nom}</h3>
                    <Badge variant="outline">{bid.revente.vente.navire.produit}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Offre de: {bid.client.nom}
                  </div>
                  <div className="text-sm">
                    Volume: {bid.volume_bid.toFixed(2)} T
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatPrice(bid.prix_bid, bid.revente.vente.navire.produit)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(bid.date_bid).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <Button 
                    onClick={() => acceptBid(bid.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Accepter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {pendingBids.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Aucune offre reçue pour le moment.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}