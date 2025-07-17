import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Ship, TrendingUp, DollarSign, Shield, Package, AlertCircle, Plus, Edit, Trash2, Save, CheckCircle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import CouverturesAchat from '@/components/CouverturesAchat';
import { getLatestPricesForMaturities } from '@/lib/priceUtils';
import { 
  getContractSize, 
  supportsContracts, 
  volumeToContracts, 
  contractsToVolume, 
  formatContractsWithVolume,
  calculateOvercoverage,
  type ProductType
} from '@/lib/futuresUtils';

interface Client {
  id: string;
  nom: string;
}

interface NavireWithVentes {
  id: string;
  nom: string;
  produit: string;
  quantite_totale: number;
  prime_achat: number | null;
  reference_cbot: string | null;
  date_arrivee: string;
  fournisseur: string;
  couvertures_achat?: Array<{
    id: string;
    prix_futures: number;
    volume_couvert: number;
    nombre_contrats: number;
    date_couverture: string;
  }>;
  ventes: Array<{
    id: string;
    type_deal: 'prime' | 'flat';
    volume: number;
    prix_flat: number | null;
    prime_vente: number | null;
    prix_reference: string | null;
    date_deal: string;
    clients: {
      nom: string;
    };
    couvertures: Array<{
      id: string;
      volume_couvert: number;
      nombre_contrats: number;
      prix_futures: number;
      date_couverture: string;
    }>;
  }>;
}

export default function Dashboard() {
  const [navires, setNavires] = useState<NavireWithVentes[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNavire, setActiveNavire] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'client'>('client');
  const { toast } = useToast();

  useEffect(() => {
    fetchUserRole();
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
              reference_cbot,
              date_arrivee,
              fournisseur,
              couvertures_achat (
                id,
                prix_futures,
                volume_couvert,
                nombre_contrats,
                date_couverture
              ),
              ventes!inner (
                id,
                type_deal,
                volume,
                prix_flat,
                prime_vente,
                prix_reference,
                date_deal,
                client_id,
                clients (
                  nom
                ),
                couvertures (
                  id,
                  volume_couvert,
                  nombre_contrats,
                  prix_futures,
                  date_couverture
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
        const { data, error } = await supabase
          .from('navires')
          .select(`
            id,
            nom,
            produit,
            quantite_totale,
            prime_achat,
            reference_cbot,
            date_arrivee,
            fournisseur,
            couvertures_achat (
              id,
              prix_futures,
              volume_couvert,
              nombre_contrats,
              date_couverture
            ),
            ventes (
              id,
              type_deal,
              volume,
              prix_flat,
              prime_vente,
              prix_reference,
              date_deal,
              client_id,
              clients (
                nom
              ),
              couvertures (
                id,
                volume_couvert,
                nombre_contrats,
                prix_futures,
                date_couverture
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
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
            {navires.length === 0 ? (
              <div className="text-center py-8">
                <Ship className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun navire trouvé</p>
              </div>
            ) : (
              navires.map(navire => (
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
                    {navire.produit} - {navire.quantite_totale}
                  </div>
                  <div className="text-xs opacity-60">
                    {formatDate(navire.date_arrivee)}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {navires.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucun navire disponible</h3>
                  <p className="text-muted-foreground">
                    {userRole === 'admin' 
                      ? 'Aucun navire n\'a été ajouté au système'
                      : 'Vous n\'avez aucune vente associée à un navire'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : navireActif ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="ventes">Ventes</TabsTrigger>
                <TabsTrigger value="couvertures_achat">Couvertures d'Achat</TabsTrigger>
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
                      <div className="text-2xl font-bold">{navireActif.quantite_totale}</div>
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
                        {navireActif.prime_achat ? navireActif.prime_achat : 'N/A'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {navireActif.reference_cbot && (
                          <div>Contrat: {navireActif.reference_cbot}</div>
                        )}
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
                        {navireActif.ventes.reduce((sum, v) => sum + v.volume, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {navireActif.ventes.length} vente(s)
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Couvertures d'Achat */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Couvertures Futures d'Achat
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const couverturesAchat = navireActif.couvertures_achat || [];
                      const volumeCouvertAchat = couverturesAchat.reduce((sum, c) => sum + c.volume_couvert, 0);
                      const tauxCouvertureAchat = navireActif.quantite_totale > 0 ? (volumeCouvertAchat / navireActif.quantite_totale) * 100 : 0;

                      return (
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Volume position totale:</span>
                            <span className="font-medium">{navireActif.quantite_totale.toFixed(1)} tonnes</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Volume couvert:</span>
                            <span className="font-medium">{volumeCouvertAchat.toFixed(1)} tonnes</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Taux de couverture:</span>
                            <Badge variant={tauxCouvertureAchat >= 95 ? "default" : tauxCouvertureAchat >= 50 ? "secondary" : "destructive"} className="text-xs">
                              {tauxCouvertureAchat.toFixed(1)}%
                            </Badge>
                          </div>
                          {couverturesAchat.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {couverturesAchat.length} contrat(s) • {couverturesAchat.reduce((sum, c) => sum + c.nombre_contrats, 0)} futures
                            </div>
                          )}
                          {tauxCouvertureAchat < 100 && (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 mt-2">
                              <div className="text-xs text-orange-600">
                                {(navireActif.quantite_totale - volumeCouvertAchat).toFixed(1)} tonnes restent à couvrir
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ventes" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Ventes - {navireActif.nom}
                    </CardTitle>
                    <CardDescription>
                      Liste des ventes pour ce navire
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {navireActif.ventes.length === 0 ? (
                      <div className="text-center py-8">
                        <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Aucune vente pour ce navire</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {navireActif.ventes.map((vente) => (
                          <div key={vente.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">{vente.clients.nom}</div>
                                <div className="text-sm text-muted-foreground">
                                  {formatDate(vente.date_deal)}
                                </div>
                              </div>
                              <Badge variant={vente.type_deal === 'prime' ? 'default' : 'secondary'}>
                                {vente.type_deal === 'prime' ? 'Prime' : 'Flat'}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <div className="text-muted-foreground">Volume</div>
                                <div className="font-medium">{vente.volume} tonnes</div>
                              </div>
                              
                              {vente.type_deal === 'prime' ? (
                                <>
                                  <div>
                                    <div className="text-muted-foreground">Prime vente</div>
                                    <div className="font-medium">{vente.prime_vente || 'N/A'}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Référence</div>
                                    <div className="font-medium">{vente.prix_reference || 'N/A'}</div>
                                  </div>
                                </>
                              ) : (
                                <div>
                                  <div className="text-muted-foreground">Prix flat</div>
                                  <div className="font-medium">{vente.prix_flat || 'N/A'} $/T</div>
                                </div>
                              )}
                              
                              <div>
                                <div className="text-muted-foreground">Couvertures</div>
                                <div className="font-medium">
                                  {vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0)} tonnes
                                </div>
                              </div>
                            </div>

                            {vente.couvertures.length > 0 && (
                              <div className="border-t pt-3">
                                <div className="text-xs text-muted-foreground mb-2">Couvertures:</div>
                                <div className="space-y-1">
                                  {vente.couvertures.map((couverture) => (
                                    <div key={couverture.id} className="text-xs bg-muted rounded p-2 flex justify-between">
                                      <span>{formatDate(couverture.date_couverture)}</span>
                                      <span>{couverture.volume_couvert} tonnes à {couverture.prix_futures}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="couvertures_achat">
                <CouverturesAchat navireId={activeNavire} />
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </div>
    </div>
  );
}