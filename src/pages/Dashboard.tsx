import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Ship, TrendingUp, DollarSign, Shield, Package, AlertCircle, Plus } from 'lucide-react';

interface NavireWithVentes {
  id: string;
  nom: string;
  produit: string;
  quantite_totale: number;
  prime_achat: number | null;
  date_arrivee: string;
  fournisseur: string;
  ventes: Array<{
    id: string;
    type_deal: 'prime' | 'flat';
    volume: number;
    prix_flat: number | null;
    prime_vente: number | null;
    prix_reference: string | null;
    date_deal: string;
    couvertures: Array<{
      id: string;
      volume_couvert: number;
      prix_futures: number;
      date_couverture: string;
    }>;
    reventes_clients: Array<{
      id: string;
      volume: number;
      prix_flat_demande: number;
      etat: 'en_attente' | 'vendu' | 'retire';
      date_revente: string;
    }>;
  }>;
}

interface PrixMarche {
  echeance: string;
  prix: number;
  date_maj: string;
}

export default function Dashboard() {
  const [navires, setNavires] = useState<NavireWithVentes[]>([]);
  const [prixMarche, setPrixMarche] = useState<PrixMarche[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNavire, setActiveNavire] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'client'>('client');
  const { toast } = useToast();

  useEffect(() => {
    fetchUserRole();
    fetchPrixMarche();
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchNavires();
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

  const fetchNavires = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (userRole === 'client') {
        // Pour les clients, récupérer seulement les navires avec leurs ventes
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (clientData) {
          const { data, error } = await supabase
            .from('navires')
            .select(`
              id,
              nom,
              produit,
              quantite_totale,
              prime_achat,
              date_arrivee,
              fournisseur,
              ventes!inner (
                id,
                type_deal,
                volume,
                prix_flat,
                prime_vente,
                prix_reference,
                date_deal,
                client_id,
                couvertures (
                  id,
                  volume_couvert,
                  prix_futures,
                  date_couverture
                ),
                reventes_clients (
                  id,
                  volume,
                  prix_flat_demande,
                  etat,
                  date_revente
                )
              )
            `)
            .eq('ventes.client_id', clientData.id);

          if (error) throw error;
          const naviresData = data || [];
          setNavires(naviresData);
          if (naviresData.length > 0 && !activeNavire) {
            setActiveNavire(naviresData[0].id);
          }
        }
      } else {
        // Pour les admins, récupérer tous les navires avec toutes les ventes
        const { data, error } = await supabase
          .from('navires')
          .select(`
            id,
            nom,
            produit,
            quantite_totale,
            prime_achat,
            date_arrivee,
            fournisseur,
            ventes (
              id,
              type_deal,
              volume,
              prix_flat,
              prime_vente,
              prix_reference,
              date_deal,
              client_id,
              couvertures (
                id,
                volume_couvert,
                prix_futures,
                date_couverture
              ),
              reventes_clients (
                id,
                volume,
                prix_flat_demande,
                etat,
                date_revente
              )
            )
          `);

        if (error) throw error;
        const naviresData = data || [];
        setNavires(naviresData);
        if (naviresData.length > 0 && !activeNavire) {
          setActiveNavire(naviresData[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching navires:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les navires',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

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

  const calculerPRU = (vente: NavireWithVentes['ventes'][0]) => {
    if (vente.type_deal === 'flat') {
      return vente.prix_flat || 0;
    }

    // Pour les deals prime, calculer le PRU
    const volumeTotal = vente.volume;
    const volumeCouvert = vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
    const volumeNonCouvert = volumeTotal - volumeCouvert;

    if (volumeCouvert === 0) {
      // Si pas de couverture, utiliser le prix marché actuel
      const prixMarcheActuel = prixMarche.find(p => p.echeance === vente.prix_reference)?.prix || 0;
      return prixMarcheActuel + (vente.prime_vente || 0);
    }

    // Calculer le prix moyen pondéré
    const prixMoyenCouvert = vente.couvertures.reduce((sum, c) => 
      sum + (c.prix_futures * c.volume_couvert), 0) / volumeCouvert;

    const prixMarcheActuel = prixMarche.find(p => p.echeance === vente.prix_reference)?.prix || 0;
    const prixMoyenNonCouvert = prixMarcheActuel;

    const prixMoyenPondere = (prixMoyenCouvert * volumeCouvert + prixMoyenNonCouvert * volumeNonCouvert) / volumeTotal;
    return prixMoyenPondere + (vente.prime_vente || 0);
  };

  const calculerTauxCouverture = (vente: NavireWithVentes['ventes'][0]) => {
    const volumeCouvert = vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
    return (volumeCouvert / vente.volume) * 100;
  };

  const peutRevendre = (vente: NavireWithVentes['ventes'][0]) => {
    return calculerTauxCouverture(vente) === 100;
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

  const getProductBadgeColor = (produit: string) => {
    switch (produit) {
      case 'mais': return 'bg-yellow-100 text-yellow-800';
      case 'tourteau_soja': return 'bg-green-100 text-green-800';
      case 'ble': return 'bg-orange-100 text-orange-800';
      case 'orge': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const navireActif = navires.find(n => n.id === activeNavire);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground">
            {userRole === 'admin' ? 'Vue d\'ensemble des navires et transactions' : 'Vos positions par navire'}
          </p>
        </div>
        {userRole === 'admin' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <TrendingUp className="h-4 w-4 mr-2" />
              Prix marché
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              Navires
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {navires.map((navire) => (
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
                  {navire.produit} - {navire.quantite_totale} MT
                </div>
                <div className="text-xs opacity-60">
                  {formatDate(navire.date_arrivee)}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {navireActif ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="ventes">Ventes</TabsTrigger>
                <TabsTrigger value="couvertures">Couvertures</TabsTrigger>
                <TabsTrigger value="reventes">Reventes</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Quantité totale
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{navireActif.quantite_totale} MT</div>
                      <div className="text-sm text-muted-foreground">
                        {navireActif.produit} - {navireActif.fournisseur}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Prime d'achat
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {navireActif.prime_achat ? `${navireActif.prime_achat} cts/bu` : 'N/A'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Arrivée: {formatDate(navireActif.date_arrivee)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Volume vendu
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {navireActif.ventes.reduce((sum, v) => sum + v.volume, 0)} MT
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {navireActif.ventes.length} vente(s)
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Résumé des ventes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {navireActif.ventes.map((vente) => (
                        <div key={vente.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="font-medium">
                                Vente #{vente.id.slice(0, 8)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatDate(vente.date_deal)} - {vente.volume} MT
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={vente.type_deal === 'prime' ? 'default' : 'secondary'}>
                                {vente.type_deal === 'prime' ? 'Prime' : 'Flat'}
                              </Badge>
                              {userRole === 'client' && peutRevendre(vente) && (
                                <Button size="sm" variant="outline">
                                  <Plus className="h-4 w-4 mr-1" />
                                  Revendre
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">PRU:</span>
                              <div className="font-medium">{formatPrice(calculerPRU(vente))}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Couverture:</span>
                              <div className="font-medium">{calculerTauxCouverture(vente).toFixed(1)}%</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Volume non couvert:</span>
                              <div className="font-medium">
                                {vente.volume - vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0)} MT
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Reventes:</span>
                              <div className="font-medium">{vente.reventes_clients.length}</div>
                            </div>
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Couverture</span>
                            </div>
                            <Progress value={calculerTauxCouverture(vente)} className="h-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ventes">
                <Card>
                  <CardHeader>
                    <CardTitle>Détail des ventes</CardTitle>
                    <CardDescription>
                      Informations détaillées sur les ventes du navire {navireActif.nom}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {navireActif.ventes.length === 0 ? (
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Aucune vente enregistrée</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {navireActif.ventes.map((vente) => (
                          <div key={vente.id} className="border rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">ID:</span>
                                  <span className="font-mono text-sm">{vente.id.slice(0, 8)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Date:</span>
                                  <span className="text-sm">{formatDate(vente.date_deal)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Type:</span>
                                  <Badge variant={vente.type_deal === 'prime' ? 'default' : 'secondary'} className="text-xs">
                                    {vente.type_deal === 'prime' ? 'Prime' : 'Flat'}
                                  </Badge>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Volume:</span>
                                  <span className="text-sm font-medium">{vente.volume} MT</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Prix:</span>
                                  <span className="text-sm font-medium">
                                    {vente.type_deal === 'flat' 
                                      ? formatPrice(vente.prix_flat || 0)
                                      : `${vente.prime_vente || 0} cts/bu`
                                    }
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">PRU:</span>
                                  <span className="text-sm font-medium">{formatPrice(calculerPRU(vente))}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Référence:</span>
                                  <span className="text-sm">{vente.prix_reference || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Couverture:</span>
                                  <span className="text-sm font-medium">{calculerTauxCouverture(vente).toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="couvertures">
                <Card>
                  <CardHeader>
                    <CardTitle>Couvertures (Hedging)</CardTitle>
                    <CardDescription>
                      Gestion des couvertures pour le navire {navireActif.nom}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Interface de gestion des couvertures à implémenter
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reventes">
                <Card>
                  <CardHeader>
                    <CardTitle>Reventes clients</CardTitle>
                    <CardDescription>
                      Propositions de revente pour le navire {navireActif.nom}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Interface de gestion des reventes à implémenter
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Ship className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucun navire sélectionné</h3>
                <p className="text-muted-foreground text-center">
                  Sélectionnez un navire dans la liste pour voir ses détails
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}