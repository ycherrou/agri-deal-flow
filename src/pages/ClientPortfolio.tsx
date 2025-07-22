import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Ship, Shield, Package, AlertCircle, Anchor, Calendar, ShoppingCart } from 'lucide-react';
import ReventeCreationDialog from '@/components/ReventeCreationDialog';

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
                    <div className="text-sm font-medium mt-2">
                      Valeur totale: ${(() => {
                        // Facteur de conversion selon le produit
                        const facteurConversion = navireActif.produit === 'mais' ? 0.3937 
                          : navireActif.produit === 'tourteau_soja' ? 0.4640 
                          : 1;
                        
                        // Calcul pour toutes les positions avec couverture
                        let valeurTotale = 0;
                        navireActif.positions.forEach(position => {
                          if (position.couvertures.length > 0) {
                            const prixFuturesMoyen = position.couvertures.reduce((sum, c) => sum + c.prix_futures, 0) / position.couvertures.length;
                            valeurTotale += (position.prime_payee + prixFuturesMoyen) * position.volume_achete * facteurConversion;
                          }
                        });
                        
                        return valeurTotale.toLocaleString();
                      })()}
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

              {/* Couverture */}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Volume couvert:</span>
                      <span className="font-medium">{navireActif.volume_couvert_total.toFixed(1)} tonnes</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Volume non couvert:</span>
                      <span className="font-medium">{navireActif.volume_non_couvert_total.toFixed(1)} tonnes</span>
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
                        
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                          <div>
                            <div className="text-sm text-muted-foreground">Prime payée</div>
                            <div className="font-medium">{formatPrice(position.prime_payee)}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">PRU</div>
                            <div className="font-medium">${(() => {
                              // Calcul du PRU complet en USD/MT
                              if (position.type_deal === 'flat') {
                                // Pour un deal flat, le PRU est simplement le prix flat (déjà en USD/MT)
                                return formatPrice(position.prix_flat || 0);
                              } else if (position.type_deal === 'prime') {
                                // Facteur de conversion selon le produit (Cts/Bu vers USD/MT)
                                const facteurConversion = navireActif.produit === 'mais' ? 0.3937 
                                  : navireActif.produit === 'tourteau_soja' ? 0.9072 
                                  : 1;
                                
                                let pruMoyen = 0;
                                
                                const volumeCouvert = position.couvertures.reduce((sum: number, c: any) => sum + c.volume_couvert, 0);
                                
                                if (volumeCouvert > 0 && position.couvertures.length > 0) {
                                  // Pour la partie couverte : utiliser les prix de couverture
                                  const prixCouvertureMoyen = position.couvertures.reduce((sum: number, c: any) => 
                                    sum + (c.prix_futures * c.volume_couvert), 0) / volumeCouvert;
                                  const pruCouvert = (position.prime_payee + prixCouvertureMoyen) * facteurConversion;
                                  
                                  if (position.volume_non_couvert > 0) {
                                    // Pour la partie non couverte : utiliser le dernier cours du contrat de référence
                                    // Récupérer le dernier prix de marché pour ce contrat
                                    const dernierCoursMarche = prixMarche.find(p => 
                                      p.echeance?.nom === position.prix_reference
                                    )?.prix || 0;
                                    
                                    const pruNonCouvert = (position.prime_payee + dernierCoursMarche) * facteurConversion;
                                    
                                    // Moyenne pondérée des deux parties
                                    pruMoyen = (pruCouvert * volumeCouvert + pruNonCouvert * position.volume_non_couvert) / position.volume_achete;
                                  } else {
                                    pruMoyen = pruCouvert;
                                  }
                                } else if (position.volume_non_couvert > 0) {
                                  // Entièrement non couvert : utiliser le dernier cours du marché
                                  const dernierCoursMarche = prixMarche.find(p => 
                                    p.echeance?.nom === position.prix_reference
                                  )?.prix || 0;
                                  
                                  if (dernierCoursMarche > 0) {
                                    pruMoyen = (position.prime_payee + dernierCoursMarche) * facteurConversion;
                                  } else {
                                    return `${formatPrice(position.prime_payee * facteurConversion)} (prime seule)`;
                                  }
                                }
                                
                                return formatPrice(pruMoyen);
                              }
                              return "N/A";
                            })()}</div>
                          </div>
                          {position.type_deal === 'flat' && position.prix_flat && (
                            <div>
                              <div className="text-sm text-muted-foreground">Prix flat</div>
                              <div className="font-medium">{formatPrice(position.prix_flat)}</div>
                            </div>
                          )}
                        </div>
                        
                        {position.couvertures.length > 0 && (
                          <div className="pt-2 border-t">
                            <div className="text-sm text-muted-foreground mb-2">Couvertures Futures:</div>
                            <div className="space-y-2">
                              {position.couvertures.map((couv, idx) => (
                                <div key={couv.id} className="text-xs bg-muted p-3 rounded">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="font-medium">{formatDate(couv.date_couverture)}</span>
                                    <span className="text-right">
                                      <div className="font-medium">{couv.volume_couvert} tonnes</div>
                                      <div className="text-muted-foreground">{(couv.volume_couvert / position.volume_achete * 100).toFixed(1)}% de la position</div>
                                    </span>
                                  </div>
                                   <div className="grid grid-cols-1 gap-2">
                                     <div>
                                       <div className="text-muted-foreground">Prix futures</div>
                                       <div className="font-medium">{formatPrice(couv.prix_futures)}</div>
                                     </div>
                                   </div>
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

              {/* Section Revente */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Revente de positions
                  </CardTitle>
                  <CardDescription>
                    Remettez en vente vos positions (couvertes et non couvertes) sur le marché secondaire
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
                        const volumeNonCouvert = pos.volume_achete - volumeCouvert;
                        
                        return (
                          <div key={pos.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">Position #{idx + 1}</div>
                                <div className="text-sm text-muted-foreground">
                                  {navireActif?.navire_nom} - {formatDate(pos.date_deal)}
                                </div>
                                 <div className="text-sm space-y-1">
                                   {volumeCouvert > 0 && (
                                     <div>Volume couvert: <span className="font-medium text-green-600">{volumeCouvert} tonnes</span></div>
                                   )}
                                   {volumeNonCouvert > 0 && (
                                     <div>Volume non couvert: <span className="font-medium text-orange-600">{volumeNonCouvert} tonnes</span></div>
                                   )}
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

      {/* Dialog de revente amélioré */}
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