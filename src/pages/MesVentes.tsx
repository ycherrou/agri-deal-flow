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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (clientError || !clientData) {
        throw new Error('Client non trouvé');
      }

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

      // Enrichir avec les données complètes
      const enrichedTransactions = await Promise.all(
        (data || []).map(async (transaction) => {
          try {
            console.log('Enrichissement transaction:', transaction.id, 'revente_id:', transaction.revente_id);
            
            // Récupérer la revente
            const { data: reventeData, error: reventeError } = await supabase
              .from('reventes_clients')
              .select('id, vente_id, prime_demandee, type_position')
              .eq('id', transaction.revente_id)
              .maybeSingle();

            if (reventeError) {
              console.error(`Erreur récupération revente ${transaction.revente_id}:`, reventeError);
              return null;
            }

            if (!reventeData) {
              console.warn(`Revente non trouvée pour transaction ${transaction.id}, revente_id: ${transaction.revente_id}`);
              return null;
            }

            console.log('Revente trouvée:', reventeData);

            // Récupérer la vente originale avec navire
            const { data: venteData, error: venteError } = await supabase
              .from('ventes')
              .select(`
                id,
                type_deal,
                prime_vente,
                navires!inner(nom, produit, prime_achat)
              `)
              .eq('id', reventeData.vente_id)
              .maybeSingle();

            if (venteError) {
              console.error(`Erreur récupération vente ${reventeData.vente_id}:`, venteError);
              return null;
            }

            if (!venteData) {
              console.warn(`Vente non trouvée pour revente ${reventeData.id}, vente_id: ${reventeData.vente_id}`);
              return null;
            }

            console.log('Vente trouvée:', venteData);

            // Récupérer l'acheteur
            const { data: acheteurData, error: acheteurError } = await supabase
              .from('clients')
              .select('nom')
              .eq('id', transaction.acheteur_id)
              .maybeSingle();

            if (acheteurError) {
              console.error(`Erreur récupération acheteur ${transaction.acheteur_id}:`, acheteurError);
            }

            const enrichedTransaction = {
              ...transaction,
              revente: {
                id: reventeData.id,
                prime_demandee: reventeData.prime_demandee,
                type_position: reventeData.type_position,
                vente: {
                  id: venteData.id,
                  type_deal: venteData.type_deal,
                  prime_vente: venteData.prime_vente,
                  navire: {
                    nom: venteData.navires?.nom || 'Navire inconnu',
                    produit: venteData.navires?.produit || 'Produit inconnu',
                    prime_achat: venteData.navires?.prime_achat
                  }
                }
              },
              acheteur: {
                nom: acheteurData?.nom || 'Acheteur inconnu'
              }
            };

            console.log('Transaction enrichie:', enrichedTransaction);
            return enrichedTransaction;
          } catch (error) {
            console.error(`Erreur lors de l'enrichissement de la transaction ${transaction.id}:`, error);
            return null;
          }
        })
      );

      // Filtrer les transactions nulles
      const validTransactions = enrichedTransactions.filter(t => t !== null) as Transaction[];
      setTransactions(validTransactions);

      // Calculer les statistiques
      const totalGain = validTransactions.reduce((sum, t) => sum + t.gain_vendeur, 0);
      const totalVolume = validTransactions.reduce((sum, t) => sum + t.volume_transige, 0);
      const nombreTransactions = validTransactions.length;
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

  // Fonction pour afficher la prime d'achat originale selon le type de deal
  const formatPrimeAchatOriginale = (transaction: Transaction) => {
    if (transaction.revente.vente.type_deal === 'prime') {
      // Pour les deals prime : utiliser la prime payée par le client lors de son achat initial
      return `${(transaction.revente.vente.prime_vente || 0).toFixed(2)} cts/bu`;
    } else {
      // Pour les deals flat : utiliser le prix d'achat original
      return `${transaction.prix_achat_original.toFixed(2)} $/MT`;
    }
  };

  // Fonction pour afficher la prime de vente finale
  const formatPrimeVenteFinale = (transaction: Transaction) => {
    if (transaction.revente.vente.type_deal === 'prime') {
      // Pour les deals prime : afficher la prime demandée sur le marché secondaire
      return `${(transaction.revente.prime_demandee || 0).toFixed(2)} cts/bu`;
    } else {
      // Pour les deals flat : afficher le prix de vente final
      return `${transaction.prix_vente_final.toFixed(2)} $/MT`;
    }
  };

  // Fonction pour calculer et afficher la marge
  const formatMarge = (transaction: Transaction) => {
    if (transaction.revente.vente.type_deal === 'prime') {
      // Pour les deals prime : différence entre prime demandée et prime payée par le client
      const margeCtsBu = (transaction.revente.prime_demandee || 0) - (transaction.revente.vente.prime_vente || 0);
      return `${margeCtsBu.toFixed(2)} cts/bu`;
    } else {
      // Pour les deals flat : différence entre prix de vente et prix d'achat
      const margeUsdMt = transaction.prix_vente_final - transaction.prix_achat_original;
      return `${margeUsdMt.toFixed(2)} $/MT`;
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
                        {formatPrimeAchatOriginale(transaction)}
                      </div>
                      {transaction.revente.vente.type_deal === 'prime' && (
                        <div className="text-xs text-muted-foreground">
                          PRU calculé: {transaction.prix_achat_original.toFixed(2)} $/MT
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prime vente:</span>
                      <div className="font-medium">
                        {formatPrimeVenteFinale(transaction)}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Marge:</span>
                      <div className="font-medium">
                        {formatMarge(transaction)}
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