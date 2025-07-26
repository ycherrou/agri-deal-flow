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
import { getLatestPricesForMaturities, formatPriceDisplay } from '@/lib/priceUtils';
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
  prix_achat_flat: number | null;
  terme_commercial: 'FOB' | 'CFR';
  taux_fret: number | null;
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
    parent_deal_id: string | null;
    vendu_sur_secondaire?: boolean;
    acheteur_secondaire?: string;
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
    reventes_clients: Array<{
      id: string;
      volume: number;
      prix_flat_demande: number;
      etat: 'en_attente' | 'vendu' | 'retire' | 'en_attente_validation';
      date_revente: string;
    }>;
  }>;
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


interface CouvertureOrpheline {
  id: string;
  prix_futures: number;
  volume_couvert: number;
  nombre_contrats: number;
  date_couverture: string;
}

export default function Dashboard() {
  const [navires, setNavires] = useState<NavireWithVentes[]>([]);
  const [prixMarche, setPrixMarche] = useState<PrixMarche[]>([]);
  const [couverturesOrphelines, setCouverturesOrphelines] = useState<CouvertureOrpheline[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNavire, setActiveNavire] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'client'>('client');
  const [clients, setClients] = useState<Client[]>([]);
  const [isAddCouvertureDialogOpen, setIsAddCouvertureDialogOpen] = useState(false);
  const [selectedVenteForCouverture, setSelectedVenteForCouverture] = useState<string | null>(null);
  const [couvertureFormData, setCouvertureFormData] = useState({
    nombre_contrats: '',
    volume_couvert: '',
    prix_futures: '',
    date_couverture: new Date().toISOString().split('T')[0]
  });
  const [addingCouverture, setAddingCouverture] = useState(false);
  const [isAddVenteDialogOpen, setIsAddVenteDialogOpen] = useState(false);
  const [venteFormData, setVenteFormData] = useState({
    client_id: '',
    volume: '',
    type_deal: '' as 'prime' | 'flat' | '',
    prix_flat: '',
    prime_vente: '',
    prix_reference: '',
    date_deal: new Date().toISOString().split('T')[0]
  });
  const [addingVente, setAddingVente] = useState(false);
  const {
    toast
  } = useToast();
  useEffect(() => {
    fetchUserRole();
    fetchPrixMarche();
    fetchClients();
    fetchCouverturesOrphelines();
  }, []);
  useEffect(() => {
    if (userRole) {
      fetchNavires();
    }
  }, [userRole]);
  const fetchUserRole = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (user) {
        const {
          data: client
        } = await supabase.from('clients').select('role').eq('user_id', user.id).single();
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      if (userRole === 'client') {
        // Pour les clients, récupérer seulement les navires avec leurs ventes
        const {
          data: clientData
        } = await supabase.from('clients').select('id').eq('user_id', user.id).single();
        if (clientData) {
          // Récupérer d'abord toutes les transactions secondaires
          const { data: transactionsData } = await supabase
            .from('transactions_marche_secondaire')
            .select(`
              revente_id,
              vendeur_id,
              acheteur_id
            `);

          // Récupérer tous les clients pour avoir leurs noms
          const { data: clientsData } = await supabase
            .from('clients')
            .select('id, nom');

          const {
            data,
            error
          } = await supabase.from('navires').select(`
              id,
              nom,
              produit,
              quantite_totale,
              prime_achat,
              prix_achat_flat,
              terme_commercial,
              taux_fret,
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
                parent_deal_id,
                clients (
                  nom
                ),
                couvertures (
                  id,
                  volume_couvert,
                  nombre_contrats,
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
            `).eq('ventes.client_id', clientData.id);

          if (error) throw error;
          let naviresDataClient = data || [];
          
          // Enrichir avec les données du marché secondaire
          if (transactionsData && clientsData) {
            for (const navire of naviresDataClient) {
              for (const vente of navire.ventes) {
                const reventeVendue = vente.reventes_clients.find(r => r.etat === 'vendu');
                if (reventeVendue) {
                  const transaction = transactionsData.find(t => t.revente_id === reventeVendue.id);
                  if (transaction) {
                    const acheteur = clientsData.find(c => c.id === transaction.acheteur_id);
                    (vente as any).vendu_sur_secondaire = true;
                    (vente as any).acheteur_secondaire = acheteur?.nom;
                  }
                }
              }
            }
          }
          if (error) throw error;
          let naviresData = data || [];
          
          setNavires(naviresDataClient as any);
          if (naviresDataClient.length > 0 && !activeNavire) {
            setActiveNavire(naviresDataClient[0].id);
          }
        }
      } else {
        // Pour les admins, récupérer tous les navires avec toutes les ventes
        const {
          data,
          error
        } = await supabase.from('navires').select(`
            id,
            nom,
            produit,
            quantite_totale,
            prime_achat,
            prix_achat_flat,
            terme_commercial,
            taux_fret,
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
              parent_deal_id,
              clients (
                nom
              ),
              couvertures (
                id,
                volume_couvert,
                nombre_contrats,
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
        let naviresData = data || [];
        
        setNavires(naviresData as any);
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

  const fetchCouverturesOrphelines = async () => {
    try {
      const { data, error } = await supabase
        .from('couvertures')
        .select(`
          id,
          prix_futures,
          volume_couvert,
          nombre_contrats,
          date_couverture
        `)
        .is('vente_id', null)
        .order('date_couverture', { ascending: false });

      if (error) throw error;
      setCouverturesOrphelines(data || []);
    } catch (error) {
      console.error('Error fetching couvertures orphelines:', error);
    }
  };

  const fetchPrixMarche = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('prix_marche').select('echeance_id, prix, created_at, echeance:echeances!inner(nom, active)').eq('echeance.active', true).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setPrixMarche(data || []);
    } catch (error) {
      console.error('Error fetching prix marché:', error);
    }
  };


  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nom')
        .order('nom');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };
  const calculerPRU = (vente: NavireWithVentes['ventes'][0], navire: NavireWithVentes) => {
    let pru = 0;
    
    if (vente.type_deal === 'flat') {
      // Pour les ventes flat, le PRU est égal au prix de vente (déjà en $/tonne)
      pru = vente.prix_flat || 0;
    } else {
      // Pour les deals prime, calculer le PRU avec le dernier prix futures de référence
      const latestPrices = getLatestPricesForMaturities(prixMarche);
      const volumeTotal = vente.volume;
      const volumeCouvert = vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
      const volumeNonCouvert = volumeTotal - volumeCouvert;
      const prixMarcheActuel = vente.prix_reference ? (latestPrices.get(vente.prix_reference) || 0) : 0;
      
      if (volumeCouvert === 0) {
        // Si pas de couverture, utiliser le prix marché actuel
        pru = prixMarcheActuel + (vente.prime_vente || 0);
      } else {
        // Calculer le prix moyen pondéré
        const prixMoyenCouvert = vente.couvertures.reduce((sum, c) => sum + c.prix_futures * c.volume_couvert, 0) / volumeCouvert;
        const prixMoyenNonCouvert = prixMarcheActuel;
        const prixMoyenPondere = (prixMoyenCouvert * volumeCouvert + prixMoyenNonCouvert * volumeNonCouvert) / volumeTotal;
        pru = prixMoyenPondere + (vente.prime_vente || 0);
      }
      
      // Appliquer le facteur de conversion pour les ventes prime (prix futures en cts/bu -> $/tonne)
      const facteurConversion = navire.produit === 'mais' ? 0.3937 : 
                               navire.produit === 'tourteau_soja' ? 0.9072 : 1;
      pru = pru * facteurConversion;
    }
    
    return pru;
  };
  const calculerTauxCouverture = (vente: NavireWithVentes['ventes'][0]) => {
    const volumeCouvert = vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
    return volumeCouvert / vente.volume * 100;
  };
  const peutRevendre = (vente: NavireWithVentes['ventes'][0]) => {
    return calculerTauxCouverture(vente) === 100;
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
        return 'bg-yellow-100 text-yellow-800';
      case 'tourteau_soja':
        return 'bg-green-100 text-green-800';
      case 'ble':
        return 'bg-orange-100 text-orange-800';
      case 'orge':
        return 'bg-purple-100 text-purple-800';
      case 'ddgs':
        return 'bg-blue-100 text-blue-800';
      case 'ferrailles':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddCouverture = (venteId: string) => {
    setSelectedVenteForCouverture(venteId);
    setCouvertureFormData({
      nombre_contrats: '',
      volume_couvert: '',
      prix_futures: '',
      date_couverture: new Date().toISOString().split('T')[0]
    });
    setIsAddCouvertureDialogOpen(true);
  };

  const handleSubmitCouverture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenteForCouverture) return;

    setAddingCouverture(true);
    try {
      const vente = navireActif?.ventes.find(v => v.id === selectedVenteForCouverture);
      if (!vente || !navireActif) throw new Error('Vente ou navire introuvable');

      const produit = navireActif.produit as ProductType;
      const volumeDejaCouverte = vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
      const volumeRestant = vente.volume - volumeDejaCouverte;
      
      let nouveauVolume: number;
      let nombreContrats = 0;

      if (supportsContracts(produit)) {
        // Utiliser le système de contrats
        nombreContrats = parseInt(couvertureFormData.nombre_contrats);
        if (!nombreContrats || nombreContrats <= 0) {
          throw new Error('Nombre de contrats requis');
        }
        nouveauVolume = contractsToVolume(nombreContrats, produit);
      } else {
        // Utiliser le volume direct
        nouveauVolume = parseFloat(couvertureFormData.volume_couvert);
        if (!nouveauVolume || nouveauVolume <= 0) {
          throw new Error('Volume requis');
        }
      }

      if (nouveauVolume > volumeRestant + (volumeRestant * 0.1)) { // Autoriser 10% de surcouverture
        throw new Error(`Volume maximum autorisé: ${volumeRestant} tonnes`);
      }

      const { error } = await supabase
        .from('couvertures')
        .insert([{
          vente_id: selectedVenteForCouverture,
          volume_couvert: nouveauVolume,
          nombre_contrats: nombreContrats,
          prix_futures: parseFloat(couvertureFormData.prix_futures),
          date_couverture: couvertureFormData.date_couverture
        }]);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Couverture ajoutée avec succès'
      });

      setIsAddCouvertureDialogOpen(false);
      setSelectedVenteForCouverture(null);
      fetchNavires(); // Refresh data
    } catch (error: any) {
      console.error('Error adding couverture:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'ajouter la couverture',
        variant: 'destructive'
      });
    } finally {
      setAddingCouverture(false);
    }
  };

  const handleAddVente = () => {
    setVenteFormData({
      client_id: '',
      volume: '',
      type_deal: '',
      prix_flat: '',
      prime_vente: '',
      prix_reference: '',
      date_deal: new Date().toISOString().split('T')[0]
    });
    setIsAddVenteDialogOpen(true);
  };

  const handleSubmitVente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNavire) return;

    // Validation pour les ventes prime
    if (venteFormData.type_deal === 'prime' && !navireActif?.reference_cbot) {
      toast({
        title: 'Erreur',
        description: 'Ce navire n\'a pas de référence CBOT. Impossible de créer une vente à prime.',
        variant: 'destructive'
      });
      return;
    }

    setAddingVente(true);
    try {
      const venteData: any = {
        navire_id: activeNavire,
        client_id: venteFormData.client_id,
        volume: parseFloat(venteFormData.volume),
        type_deal: venteFormData.type_deal,
        date_deal: venteFormData.date_deal
      };

      if (venteFormData.type_deal === 'flat') {
        venteData.prix_flat = parseFloat(venteFormData.prix_flat);
      } else {
        venteData.prime_vente = parseFloat(venteFormData.prime_vente);
        venteData.prix_reference = venteFormData.prix_reference;
      }

      const { error } = await supabase
        .from('ventes')
        .insert([venteData]);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Vente créée avec succès'
      });

      setIsAddVenteDialogOpen(false);
      fetchNavires(); // Refresh data
    } catch (error: any) {
      console.error('Error adding vente:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer la vente',
        variant: 'destructive'
      });
    } finally {
      setAddingVente(false);
    }
  };
  
  const navireActif = navires.find(n => n.id === activeNavire);
  
  // Auto-populate CBOT reference when deal type changes to prime
  useEffect(() => {
    if (venteFormData.type_deal === 'prime' && navireActif?.reference_cbot) {
      setVenteFormData(prev => ({
        ...prev,
        prix_reference: navireActif.reference_cbot
      }));
    }
  }, [venteFormData.type_deal, navireActif?.reference_cbot]);
  
  if (loading) {
    return <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  return <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground">
            {userRole === 'admin' ? 'Vue d\'ensemble des navires et transactions' : 'Vos positions par navire'}
          </p>
        </div>
        {userRole === 'admin' && <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <TrendingUp className="h-4 w-4 mr-2" />
              Prix marché
            </Button>
          </div>}
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
                <p className="text-xs text-muted-foreground mt-2">
                  {userRole === 'admin' ? 'Aucun navire dans la base' : 'Aucune vente associée'}
                </p>
              </div>
            ) : (
              navires.map(navire => <button key={navire.id} onClick={() => setActiveNavire(navire.id)} className={`w-full p-3 rounded-lg border text-left transition-colors ${activeNavire === navire.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted border-border'}`}>
                  <div className="font-medium">{navire.nom}</div>
                  <div className="text-sm opacity-75">
                    {navire.produit} - {navire.quantite_totale}
                  </div>
                  <div className="text-xs opacity-60">
                    {formatDate(navire.date_arrivee)}
                  </div>
                </button>)
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
          ) : navireActif ? <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="ventes">Ventes</TabsTrigger>
                {navireActif.ventes.some(v => v.type_deal === 'prime') && (
                  <TabsTrigger value="couvertures">Couvertures</TabsTrigger>
                )}
                
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
                        {navireActif.prix_achat_flat ? 'Prix d\'achat flat' : 'Prime d\'achat'}
                        {navireActif.terme_commercial === 'FOB' && (
                          <Badge variant="destructive" className="text-xs">FOB</Badge>
                        )}
                        {navireActif.terme_commercial === 'CFR' && (
                          <Badge variant="secondary" className="text-xs">CFR</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {navireActif.prix_achat_flat ? 
                          `${navireActif.prix_achat_flat} $/tonne` : 
                          (navireActif.prime_achat ? navireActif.prime_achat : 'N/A')
                        }
                      </div>
                      {navireActif.terme_commercial === 'FOB' && navireActif.taux_fret && (
                        <>
                          <div className="text-lg font-semibold text-orange-600 mt-2">
                            + {navireActif.taux_fret} $/MT (fret)
                          </div>
                          <div className="text-lg font-bold text-gray-700 mt-1 pt-2 border-t">
                            = {navireActif.prix_achat_flat 
                              ? (navireActif.prix_achat_flat + navireActif.taux_fret).toFixed(2)
                              : navireActif.prime_achat 
                                ? `${navireActif.prime_achat} + ${(navireActif.taux_fret / (navireActif.produit === 'mais' ? 0.3937 : navireActif.produit === 'tourteau_soja' ? 0.9072 : 1)).toFixed(2)}`
                                : 'N/A'
                            } 
                            {navireActif.prix_achat_flat ? ' $/MT' : ' cts/bu'} (total avec fret)
                          </div>
                        </>
                      )}
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

                {/* Indicateurs de couverture */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Couverture Volumes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                    // Volume total vendu
                    const volumeVendu = navireActif.ventes.reduce((sum, v) => sum + v.volume, 0);

                    // Volume couvert en achat (couvertures_achat)
                    const couverturesAchat = navireActif.couvertures_achat || [];
                    const volumeCouvertAchat = couverturesAchat.reduce((sum, c) => sum + c.volume_couvert, 0);
                    const ecartVolume = navireActif.quantite_totale - volumeVendu;
                    const isEquilibre = Math.abs(ecartVolume) < 0.1; // Tolérance de 0.1 MT
                    const surCouvert = ecartVolume > 0;
                    return <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Volume vendu:</span>
                              <span className="font-medium">{volumeVendu.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Volume acheté:</span>
                              <span className="font-medium">{navireActif.quantite_totale.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Position:</span>
                              <Badge variant={isEquilibre ? "default" : surCouvert ? "secondary" : "destructive"} className="text-xs">
                                {isEquilibre ? 'Équilibré' : surCouvert ? `+${ecartVolume.toFixed(1)}` : `${ecartVolume.toFixed(1)}`}
                              </Badge>
                            </div>
                          </div>;
                  })()}
                    </CardContent>
          </Card>


                  {/* Afficher la section Couverture Futures seulement pour les navires à prime */}
                  {navireActif.prime_achat !== null && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Couverture Futures
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                      // Contrats en futures achat (couvertures_achat)
                      const couverturesAchat = navireActif.couvertures_achat || [];
                      const produit = navireActif.produit as ProductType;
                      const supportsContractsFutures = supportsContracts(produit);
                      
                      let contractsFuturesAchat = 0;
                      let contractsFuturesVente = 0;
                      
                      if (supportsContractsFutures) {
                        // Calculer en nombre de contrats
                        contractsFuturesAchat = couverturesAchat.reduce((sum, c) => sum + c.nombre_contrats, 0);
                        
                        // Contrats en futures vente (couvertures des ventes + orphelines)
                        const toutesCouverturesVente = navireActif.ventes.flatMap(v => v.couvertures);
                        const contractsVenteNormales = toutesCouverturesVente.reduce((sum, c) => sum + c.nombre_contrats, 0);
                        const contractsOrphelines = couverturesOrphelines.reduce((sum, c) => sum + c.nombre_contrats, 0);
                        contractsFuturesVente = contractsVenteNormales + contractsOrphelines;
                      } else {
                        // Pour les produits sans contrats, afficher en volume
                        const volumeFuturesAchat = couverturesAchat.reduce((sum, c) => sum + c.volume_couvert, 0);
                        const toutesCouverturesVente = navireActif.ventes.flatMap(v => v.couvertures);
                        const volumeVenteNormales = toutesCouverturesVente.reduce((sum, c) => sum + c.volume_couvert, 0);
                        const volumeOrphelines = couverturesOrphelines.reduce((sum, c) => sum + c.volume_couvert, 0);
                        const volumeFuturesVente = volumeVenteNormales + volumeOrphelines;
                        
                        // Convertir en "contrats virtuels" pour l'affichage
                        contractsFuturesAchat = Math.round(volumeFuturesAchat);
                        contractsFuturesVente = Math.round(volumeFuturesVente);
                      }
                      
                      const ecartContrats = contractsFuturesAchat - contractsFuturesVente;
                      const isEquilibre = ecartContrats === 0;
                      const surCouvert = ecartContrats > 0;
                      
                      return <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Futures envoyés:</span>
                                <span className="font-medium">{supportsContractsFutures ? contractsFuturesAchat : `${contractsFuturesAchat} MT`}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Futures reçus:</span>
                                <span className="font-medium">{supportsContractsFutures ? contractsFuturesVente : `${contractsFuturesVente} MT`}</span>
                              </div>
                              {couverturesOrphelines.length > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground text-orange-600">Futures orphelins:</span>
                                  <span className="font-medium text-orange-600">
                                    {supportsContractsFutures 
                                      ? couverturesOrphelines.reduce((sum, c) => sum + c.nombre_contrats, 0)
                                      : `${Math.round(couverturesOrphelines.reduce((sum, c) => sum + c.volume_couvert, 0))} MT`
                                    }
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Position:</span>
                                <Badge variant={isEquilibre ? "default" : surCouvert ? "secondary" : "destructive"} className="text-xs">
                                  {isEquilibre ? "Équilibré" : surCouvert ? `+${ecartContrats}` : `${ecartContrats}`} {supportsContractsFutures ? 'contrats' : 'MT'}
                                </Badge>
                              </div>
                            </div>;
                    })()}
                      </CardContent>
                    </Card>
                  )}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Résumé des ventes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {navireActif.ventes.map(vente => <div key={vente.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
              <div className="font-medium">
                Vente #{vente.id.slice(0, 8)}
              </div>
              <div className="text-sm text-muted-foreground">
                Client: {vente.clients.nom}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDate(vente.date_deal)} - {vente.volume}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={vente.type_deal === 'prime' ? 'default' : 'secondary'}>
                                {vente.type_deal === 'prime' ? 'Prime' : 'Flat'}
                              </Badge>
                              {userRole === 'client' && peutRevendre(vente) && <Button size="sm" variant="outline">
                                  <Plus className="h-4 w-4 mr-1" />
                                  Revendre
                                </Button>}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">PRU:</span>
                              <div className="font-medium">{formatPrice(calculerPRU(vente, navireActif), navireActif.produit)}</div>
                            </div>
                            {vente.type_deal === 'prime' && vente.prime_vente && (
                              <div>
                                <span className="text-muted-foreground">Prime:</span>
                                <div className="font-medium">
                                  {vente.prime_vente.toFixed(2)} {navireActif.produit === 'mais' || navireActif.produit === 'tourteau_soja' ? 'Cts/Bu' : 'USD/MT'}
                                </div>
                              </div>
                            )}
                            {vente.type_deal === 'flat' && vente.prix_flat && (
                              <div>
                                <span className="text-muted-foreground">Prix flat:</span>
                                <div className="font-medium">{vente.prix_flat.toFixed(2)} USD/MT</div>
                              </div>
                            )}
                            {vente.type_deal === 'prime' && (
                              <div>
                                <span className="text-muted-foreground">Couverture:</span>
                                <div className="font-medium">{calculerTauxCouverture(vente).toFixed(1)}%</div>
                              </div>
                            )}
                            {vente.type_deal === 'prime' && (
                              <div>
                                <span className="text-muted-foreground">Volume non couvert:</span>
                                <div className="font-medium">
                                  {vente.volume - vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0)}
                                </div>
                              </div>
                            )}
                          </div>

                          {vente.type_deal === 'prime' && (
                            <div className="mt-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Couverture</span>
                              </div>
                              <Progress value={calculerTauxCouverture(vente)} className="h-2" />
                            </div>
                          )}
                        </div>)}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ventes">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Détail des ventes</CardTitle>
                        <CardDescription>
                          Informations détaillées sur les ventes du navire {navireActif.nom}
                        </CardDescription>
                      </div>
                      {userRole === 'admin' && (
                        <Button onClick={handleAddVente}>
                          <Plus className="h-4 w-4 mr-2" />
                          Nouvelle vente
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {navireActif.ventes.length === 0 ? <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Aucune vente enregistrée</p>
                      </div> : <div className="space-y-4">
                        {navireActif.ventes.map(vente => <div key={vente.id} className="border rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">ID:</span>
                                  <span className="font-mono text-sm">{vente.id.slice(0, 8)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Client:</span>
                                  <span className="text-sm font-medium">{vente.clients.nom}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">Date:</span>
                                  <span className="text-sm">{formatDate(vente.date_deal)}</span>
                                </div>
                                 <div className="flex justify-between">
                                   <span className="text-sm text-muted-foreground">Type:</span>
                                   <div className="flex gap-2">
                                     <Badge variant={vente.type_deal === 'prime' ? 'default' : 'secondary'} className="text-xs">
                                       {vente.type_deal === 'prime' ? 'Prime' : 'Flat'}
                                     </Badge>
                                     {vente.parent_deal_id && (
                                       <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                         Marché Secondaire
                                       </Badge>
                                     )}
                                   </div>
                                 </div>
                                 <div className="flex justify-between">
                                   <span className="text-sm text-muted-foreground">Volume:</span>
                                   <span className="text-sm font-medium">{vente.volume}</span>
                                 </div>
                                 {/* Affichage du statut de vente sur marché secondaire */}
                                 {(vente as any).vendu_sur_secondaire && (
                                   <div className="flex justify-between">
                                     <span className="text-sm text-muted-foreground">Statut:</span>
                                     <span className="text-xs text-red-600 font-medium">
                                       Vendu par {(vente as any).acheteur_secondaire} sur secondaire
                                     </span>
                                   </div>
                                 )}
                               </div>
                               <div className="space-y-2">
                                 <div className="flex justify-between">
                                   <span className="text-sm text-muted-foreground">Prix:</span>
                                    <span className="text-sm font-medium">
                                      {vente.type_deal === 'flat' ? formatPrice(vente.prix_flat || 0, navireActif.produit) : formatPrice(vente.prime_vente || 0, navireActif.produit)}
                                    </span>
                                 </div>
                                 <div className="flex justify-between">
                                   <span className="text-sm text-muted-foreground">PRU:</span>
                                   <span className="text-sm font-medium">{formatPrice(calculerPRU(vente, navireActif), navireActif.produit)}</span>
                                 </div>
                                {vente.type_deal === 'prime' && (
                                  <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Référence:</span>
                                    <span className="text-sm">{vente.prix_reference || 'N/A'}</span>
                                  </div>
                                )}
                                {vente.type_deal === 'prime' && (
                                  <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Couverture:</span>
                                    <span className="text-sm font-medium">{calculerTauxCouverture(vente).toFixed(1)}%</span>
                                  </div>
                                 )}
                               </div>
                             </div>
                             
                             {/* Section informations marché secondaire - simplifié pour le moment */}
                             {vente.parent_deal_id && (
                               <div className="mt-4 pt-4 border-t border-orange-200 bg-orange-50/50 rounded-lg p-3">
                                 <h4 className="text-sm font-medium text-orange-800 mb-2 flex items-center gap-2">
                                   <TrendingUp className="h-4 w-4" />
                                   Position acquise via marché secondaire
                                 </h4>
                                 <p className="text-sm text-orange-600">
                                   Cette position a été acquise par transaction sur le marché secondaire.
                                 </p>
                               </div>
                             )}
                           </div>)}
                      </div>}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="couvertures">
                <Tabs defaultValue="vente" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="vente">Couvertures Vente</TabsTrigger>
                    <TabsTrigger value="achat">Couvertures Achat</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="vente" className="space-y-6 mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Couvertures Vente (Hedging)</CardTitle>
                        <CardDescription>
                          Gestion des couvertures pour les ventes du navire {navireActif.nom}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                    {navireActif.ventes.filter(v => v.type_deal === 'prime').length === 0 ? <div className="text-center py-8">
                        <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Aucune vente prime nécessitant une couverture</p>
                      </div> : <div className="space-y-6">
                        {navireActif.ventes.filter(vente => vente.type_deal === 'prime').map(vente => {
                        const volumeCouvert = vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
                        const volumeRestant = vente.volume - volumeCouvert;
                        const tauxCouverture = calculerTauxCouverture(vente);
                        return <div key={vente.id} className="border rounded-lg p-4 space-y-4">
                                <div className="flex justify-between items-start">
                                  <div>
                    <h4 className="font-medium">Vente #{vente.id.slice(0, 8)}</h4>
                    <p className="text-sm text-muted-foreground">
                      Client: {vente.clients.nom}
                    </p>
                     <p className="text-sm text-muted-foreground">
                       {formatDate(vente.date_deal)} • {vente.volume} • Prime: {formatPrice(vente.prime_vente || 0, navireActif.produit)}
                     </p>
                    <p className="text-xs text-muted-foreground">
                      Référence CBOT: {vente.prix_reference || 'Non définie'}
                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-right">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{tauxCouverture.toFixed(1)}%</span>
                                      </div>
                                      <Progress value={tauxCouverture} className="h-2 w-24" />
                                    </div>
                                    {userRole === 'admin' && vente.type_deal === 'prime' && volumeRestant > 0 && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleAddCouverture(vente.id)}
                                        className="ml-2"
                                      >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Ajouter
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                  <div className="bg-muted/50 rounded-lg p-3">
                                    <div className="text-muted-foreground mb-1">Volume total</div>
                                    <div className="font-medium">{vente.volume}</div>
                                  </div>
                                  <div className="bg-green-50 rounded-lg p-3">
                                    <div className="text-muted-foreground mb-1">Volume couvert</div>
                                    <div className="font-medium text-green-700">{volumeCouvert}</div>
                                  </div>
                                  <div className="bg-orange-50 rounded-lg p-3">
                                    <div className="text-muted-foreground mb-1">Volume restant</div>
                                    <div className="font-medium text-orange-700">{volumeRestant}</div>
                                  </div>
                                </div>

                                {vente.couvertures.length > 0 ? <div>
                                    <h5 className="font-medium mb-3 flex items-center gap-2">
                                      <Shield className="h-4 w-4" />
                                      Couvertures existantes ({vente.couvertures.length})
                                    </h5>
                                    <div className="space-y-2">
                                        {vente.couvertures.map(couverture => <div key={couverture.id} className="border rounded-lg p-3 bg-card">
                                            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                                              <div>
                                                <div className="text-xs text-muted-foreground">Date</div>
                                                <div className="font-medium">{formatDate(couverture.date_couverture)}</div>
                                              </div>
                                              {(() => {
                                                const produit = navireActif.produit as ProductType;
                                                const supportsContractsFutures = supportsContracts(produit);
                                                
                                                if (supportsContractsFutures && couverture.nombre_contrats > 0) {
                                                  return (
                                                    <div>
                                                      <div className="text-xs text-muted-foreground">Contrats</div>
                                                      <div className="font-medium">
                                                        {couverture.nombre_contrats} contrat{couverture.nombre_contrats > 1 ? 's' : ''}
                                                      </div>
                                                      <div className="text-xs text-muted-foreground">
                                                        ({couverture.volume_couvert} tonnes)
                                                      </div>
                                                    </div>
                                                  );
                                                } else {
                                                  return (
                                                    <div>
                                                      <div className="text-xs text-muted-foreground">Volume</div>
                                                      <div className="font-medium">{couverture.volume_couvert} tonnes</div>
                                                    </div>
                                                  );
                                                }
                                              })()}
                                              <div>
                                                <div className="text-xs text-muted-foreground">Prix futures</div>
                                                <div className="font-medium">{formatPrice(couverture.prix_futures, navireActif.produit)}</div>
                                              </div>
                                              <div>
                                                <div className="text-xs text-muted-foreground">Pourcentage</div>
                                                <div className="font-medium">
                                                  {(couverture.volume_couvert / vente.volume * 100).toFixed(1)}%
                                                </div>
                                              </div>
                                              {userRole === 'admin' && <div className="flex justify-end gap-2">
                                                  <Button size="sm" variant="outline" onClick={() => console.log('Edit couverture vente:', couverture.id)}>
                                                    <Edit className="h-3 w-3" />
                                                  </Button>
                                                  <Button size="sm" variant="outline" onClick={() => console.log('Delete couverture vente:', couverture.id)}>
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>}
                                            </div>
                                          </div>)}
                                    </div>
                                  </div> : <div className="text-center py-4 bg-muted/20 rounded-lg">
                                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">Aucune couverture pour cette vente</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Position exposée de {vente.volume}
                                    </p>
                                  </div>}

                                {volumeRestant > 0 && <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-orange-700 mb-2">
                                      <AlertCircle className="h-4 w-4" />
                                      <span className="font-medium">Position non couverte</span>
                                    </div>
                                    <p className="text-sm text-orange-600">
                                      {volumeRestant} restent à couvrir ({(volumeRestant / vente.volume * 100).toFixed(1)}% du volume total)
                                    </p>
                                  </div>}
                              </div>;
                      })}
                      </div>}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="achat" className="space-y-6 mt-6">
                    <CouverturesAchat navireId={activeNavire} />
                  </TabsContent>
                </Tabs>
              </TabsContent>

            </Tabs> : (
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

      {/* Dialog pour ajouter une couverture */}
      <Dialog open={isAddCouvertureDialogOpen} onOpenChange={setIsAddCouvertureDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une couverture</DialogTitle>
            <DialogDescription>
              Ajouter une nouvelle couverture pour cette vente
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCouverture} className="space-y-4">
            {selectedVenteForCouverture && (() => {
              const vente = navireActif?.ventes.find(v => v.id === selectedVenteForCouverture);
              if (!vente) return null;
              
              const volumeDejaCouverte = vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
              const volumeRestant = vente.volume - volumeDejaCouverte;
              
              return (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Volume total:</span>
                    <span className="font-medium">{vente.volume} MT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Volume restant:</span>
                    <span className="font-medium text-warning">{volumeRestant} MT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Référence:</span>
                    <span className="font-medium">{vente.prix_reference}</span>
                  </div>
                </div>
              );
            })()}

            {(() => {
              const vente = navireActif?.ventes.find(v => v.id === selectedVenteForCouverture);
              const navire = navireActif;
              
              if (!vente || !navire) return null;
              
              const produit = navire.produit as ProductType;
              const supportsContractsFutures = supportsContracts(produit);
              
              if (supportsContractsFutures) {
                return (
                  <div className="space-y-2">
                    <Label htmlFor="nombre_contrats">Nombre de contrats</Label>
                    <Input
                      id="nombre_contrats"
                      type="number"
                      step="1"
                      min="1"
                      placeholder="Nombre de contrats"
                      value={couvertureFormData.nombre_contrats}
                      onChange={(e) => setCouvertureFormData(prev => ({ ...prev, nombre_contrats: e.target.value }))}
                      required
                    />
                    {couvertureFormData.nombre_contrats && (
                      <div className="text-sm text-muted-foreground">
                        = {contractsToVolume(parseInt(couvertureFormData.nombre_contrats) || 0, produit)} tonnes
                        {parseInt(couvertureFormData.nombre_contrats) > 0 && (
                          <div className="text-xs text-orange-600">
                            Surcouverture: {calculateOvercoverage(
                              (() => {
                                const volumeDejaCouverte = vente.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
                                return vente.volume - volumeDejaCouverte;
                              })(),
                              parseInt(couvertureFormData.nombre_contrats),
                              produit
                            )} tonnes
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              } else {
                return (
                  <div className="space-y-2">
                    <Label htmlFor="volume_couvert">Volume à couvrir</Label>
                    <Input
                      id="volume_couvert"
                      type="number"
                      step="0.01"
                      placeholder="Volume"
                      value={couvertureFormData.volume_couvert}
                      onChange={(e) => setCouvertureFormData(prev => ({ ...prev, volume_couvert: e.target.value }))}
                      required
                    />
                  </div>
                );
              }
            })()}

            <div className="space-y-2">
              <Label htmlFor="prix_futures">Prix futures</Label>
              <Input
                id="prix_futures"
                type="number"
                step="0.01"
                placeholder="Ex: 425.50"
                value={couvertureFormData.prix_futures}
                onChange={(e) => setCouvertureFormData(prev => ({ ...prev, prix_futures: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_couverture">Date de couverture</Label>
              <Input
                id="date_couverture"
                type="date"
                value={couvertureFormData.date_couverture}
                onChange={(e) => setCouvertureFormData(prev => ({ ...prev, date_couverture: e.target.value }))}
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddCouvertureDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={addingCouverture}>
                {addingCouverture ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Ajout...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Ajouter
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog pour ajouter une vente */}
      <Dialog open={isAddVenteDialogOpen} onOpenChange={setIsAddVenteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle vente</DialogTitle>
            <DialogDescription>
              Créer une nouvelle vente pour le navire {navireActif?.nom}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitVente} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_id">Client</Label>
                <Select value={venteFormData.client_id} onValueChange={(value) => setVenteFormData(prev => ({ ...prev, client_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="volume">Volume</Label>
                <Input
                  id="volume"
                  type="number"
                  step="0.01"
                  placeholder="Volume"
                  value={venteFormData.volume}
                  onChange={(e) => setVenteFormData(prev => ({ ...prev, volume: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type_deal">Type de deal</Label>
                <Select value={venteFormData.type_deal} onValueChange={(value) => setVenteFormData(prev => ({ ...prev, type_deal: value as 'prime' | 'flat' }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type de deal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="prime">Prime</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_deal">Date du deal</Label>
                <Input
                  id="date_deal"
                  type="date"
                  value={venteFormData.date_deal}
                  onChange={(e) => setVenteFormData(prev => ({ ...prev, date_deal: e.target.value }))}
                  required
                />
              </div>
            </div>

            {venteFormData.type_deal === 'flat' && (
              <div className="space-y-2">
                <Label htmlFor="prix_flat">Prix flat</Label>
                <Input
                  id="prix_flat"
                  type="number"
                  step="0.01"
                  placeholder="Prix"
                  value={venteFormData.prix_flat}
                  onChange={(e) => setVenteFormData(prev => ({ ...prev, prix_flat: e.target.value }))}
                  required
                />
              </div>
            )}

            {venteFormData.type_deal === 'prime' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prime_vente">Prime vente</Label>
                  <Input
                    id="prime_vente"
                    type="number"
                    step="0.01"
                    placeholder="Prime en cts/bu"
                    value={venteFormData.prime_vente}
                    onChange={(e) => setVenteFormData(prev => ({ ...prev, prime_vente: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prix_reference">Référence CBOT</Label>
                  {navireActif?.reference_cbot ? (
                    <Input
                      id="prix_reference"
                      value={navireActif.reference_cbot}
                      disabled
                      className="bg-muted"
                    />
                  ) : (
                    <Select value={venteFormData.prix_reference} onValueChange={(value) => setVenteFormData(prev => ({ ...prev, prix_reference: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un contrat CBOT" />
                      </SelectTrigger>
                      <SelectContent>
                        {prixMarche.map((prix) => (
                          <SelectItem key={prix.echeance_id} value={prix.echeance?.nom || ''}>
                            {prix.echeance?.nom} - {prix.prix} cts/bu
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddVenteDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={addingVente}>
                {addingVente ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Création...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Créer la vente
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>;
}