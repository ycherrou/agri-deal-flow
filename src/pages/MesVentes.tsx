import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, TrendingUp, CalendarDays, Package } from 'lucide-react';

interface Transaction {
  id: string;
  prix_achat_original: number;
  prix_vente_final: number;
  volume_transige: number;
  gain_vendeur: number;
  date_transaction: string;
  pnl_paye: boolean;
  date_paiement_pnl: string | null;
  revente: {
    id: string;
    prime_demandee: number | null;
    type_position: string;
    vente: {
      id: string;
      type_deal: string;
      prime_vente: number | null;
      navire: {
        nom: string;
        produit: string;
        prime_achat: number | null;
      };
    };
  };
  acheteur: {
    nom: string;
  };
}

export default function MesVentes() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalGain: 0,
    totalVolume: 0,
    nombreTransactions: 0,
    gainMoyen: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      // Récupérer l'ID du client connecté
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (clientError) throw clientError;

      // Récupérer les transactions où le client est vendeur
      const { data, error } = await supabase
        .from('transactions_marche_secondaire')
        .select(`
          id,
          prix_achat_original,
          prix_vente_final,
          volume_transige,
          gain_vendeur,
          date_transaction,
          pnl_paye,
          date_paiement_pnl,
          revente_id,
          acheteur_id
        `)
        .eq('vendeur_id', clientData.id)
        .order('date_transaction', { ascending: false });

      if (error) throw error;

      // Enrichir avec les données de revente, navire et acheteur
      const enrichedTransactions = await Promise.all(
        (data || []).map(async (transaction) => {
          // Récupérer les données de la revente et du navire
          const { data: reventeData } = await supabase
            .from('reventes_clients')
            .select(`
              id,
              vente_id,
              prime_demandee,
              type_position,
              ventes!inner(
                id,
                type_deal,
                prime_vente,
                navires!inner(
                  nom,
                  produit,
                  prime_achat
                )
              )
            `)
            .eq('id', transaction.revente_id)
            .single();

          // Récupérer les données de l'acheteur
          const { data: acheteurData } = await supabase
            .from('clients')
            .select('nom')
            .eq('id', transaction.acheteur_id)
            .single();

           return {
            ...transaction,
            revente: {
              id: reventeData?.id || '',
              prime_demandee: reventeData?.prime_demandee || null,
              type_position: reventeData?.type_position || '',
              vente: {
                id: reventeData?.ventes?.id || '',
                type_deal: reventeData?.ventes?.type_deal || '',
                prime_vente: reventeData?.ventes?.prime_vente || null,
                navire: {
                  nom: reventeData?.ventes?.navires?.nom || '',
                  produit: reventeData?.ventes?.navires?.produit || '',
                  prime_achat: reventeData?.ventes?.navires?.prime_achat || null
                }
              }
            },
            acheteur: acheteurData || { nom: '' }
           };
        })
      );

      setTransactions(enrichedTransactions);

      // Calculer les statistiques
      const totalGain = enrichedTransactions.reduce((sum, t) => sum + t.gain_vendeur, 0);
      const totalVolume = enrichedTransactions.reduce((sum, t) => sum + t.volume_transige, 0);
      const nombreTransactions = enrichedTransactions.length;
      const gainMoyen = nombreTransactions > 0 ? totalGain / nombreTransactions : 0;

      setStats({
        totalGain,
        totalVolume,
        nombreTransactions,
        gainMoyen
      });

    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger vos ventes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mes ventes</h1>
          <p className="text-muted-foreground">Vos transactions réalisées sur le marché secondaire</p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gain total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(stats.totalGain)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVolume.toLocaleString('fr-FR')} MT</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.nombreTransactions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gain moyen</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(stats.gainMoyen)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des ventes</CardTitle>
          <CardDescription>
            Détail de toutes vos ventes sur le marché secondaire
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Aucune vente réalisée sur le marché secondaire</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium">
                        {transaction.revente.vente.navire.nom}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {transaction.revente.vente.navire.produit.toUpperCase()} • {transaction.volume_transige} MT
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        +{formatPrice(transaction.gain_vendeur)}
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {formatDate(transaction.date_transaction)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Prime achat originale:</span>
                      <div className="font-medium">
                        {transaction.revente.type_position === 'prime' 
                          ? `${(transaction.revente.prime_demandee || 0).toFixed(2)} cts/bu`
                          : `${transaction.prix_achat_original.toFixed(2)} $/MT`
                        }
                      </div>
                      {transaction.revente.type_position === 'prime' && (
                        <div className="text-xs text-muted-foreground">
                          PRU calculé: {transaction.prix_achat_original.toFixed(2)} $/MT
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prime vente:</span>
                      <div className="font-medium">
                        {transaction.revente.vente.type_deal === 'prime' 
                          ? `${transaction.revente.vente.prime_vente || 0} cts/bu`
                          : `${transaction.prix_vente_final.toFixed(2)} $/MT`
                        }
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Marge:</span>
                      <div className="font-medium">
                        {transaction.revente.type_position === 'prime' 
                          ? `${((transaction.revente.vente.prime_vente || 0) - (transaction.revente.prime_demandee || 0)).toFixed(2)} cts/bu`
                          : `${(transaction.prix_vente_final - transaction.prix_achat_original).toFixed(2)} $/MT`
                        }
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Statut P&L:</span>
                      <div>
                        <Badge variant={transaction.pnl_paye ? 'default' : 'secondary'}>
                          {transaction.pnl_paye ? 'Payé' : 'En attente'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {transaction.pnl_paye && transaction.date_paiement_pnl && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      P&L payé le {formatDate(transaction.date_paiement_pnl)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}