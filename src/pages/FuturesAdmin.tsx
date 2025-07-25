import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Activity, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CouvertureAchat {
  id: string;
  date_couverture: string;
  volume_couvert: number;
  prix_futures: number;
  nombre_contrats: number;
  navire: {
    nom: string;
    produit: string;
    fournisseur: string;
  };
}

interface CouvertureVente {
  id: string;
  date_couverture: string;
  volume_couvert: number;
  prix_futures: number;
  nombre_contrats: number;
  vente: {
    date_deal: string;
    client: {
      nom: string;
    };
    navire: {
      nom: string;
      produit: string;
    };
  };
}

interface CouvertureOrpheline {
  id: string;
  date_couverture: string;
  volume_couvert: number;
  prix_futures: number;
  nombre_contrats: number;
}

interface StatsFutures {
  totalVolumeAchat: number;
  totalVolumeVente: number;
  totalContratsAchat: number;
  totalContratsVente: number;
  totalVolumeOrpheline: number;
  totalContratsOrpheline: number;
  prixMoyenAchat: number;
  prixMoyenVente: number;
  prixMoyenOrpheline: number;
  expositionNette: number;
  gainPotentiel: number;
}

export default function FuturesAdmin() {
  const [couverturesAchat, setCouverturesAchat] = useState<CouvertureAchat[]>([]);
  const [couverturesVente, setCouverturesVente] = useState<CouvertureVente[]>([]);
  const [couverturesOrphelines, setCouverturesOrphelines] = useState<CouvertureOrpheline[]>([]);
  const [stats, setStats] = useState<StatsFutures>({
    totalVolumeAchat: 0,
    totalVolumeVente: 0,
    totalContratsAchat: 0,
    totalContratsVente: 0,
    totalVolumeOrpheline: 0,
    totalContratsOrpheline: 0,
    prixMoyenAchat: 0,
    prixMoyenVente: 0,
    prixMoyenOrpheline: 0,
    expositionNette: 0,
    gainPotentiel: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchFuturesData();
  }, []);

  const fetchFuturesData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCouverturesAchat(),
        fetchCouverturesVente(),
        fetchCouverturesOrphelines(),
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement des données futures:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données des futures.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const fetchCouverturesAchat = async () => {
    const { data, error } = await supabase
      .from('couvertures_achat')
      .select(`
        id,
        date_couverture,
        volume_couvert,
        prix_futures,
        nombre_contrats,
        navire:navires(
          nom,
          produit,
          fournisseur
        )
      `)
      .order('date_couverture', { ascending: false });

    if (error) throw error;
    setCouverturesAchat(data || []);
  };

  const fetchCouverturesVente = async () => {
    const { data, error } = await supabase
      .from('couvertures')
      .select(`
        id,
        date_couverture,
        volume_couvert,
        prix_futures,
        nombre_contrats,
        vente:ventes(
          date_deal,
          client:clients(nom),
          navire:navires(nom, produit)
        )
      `)
      .not('vente_id', 'is', null)
      .order('date_couverture', { ascending: false });

    if (error) throw error;
    setCouverturesVente(data || []);
  };

  const fetchCouverturesOrphelines = async () => {
    const { data, error } = await supabase
      .from('couvertures')
      .select(`
        id,
        date_couverture,
        volume_couvert,
        prix_futures,
        nombre_contrats
      `)
      .is('vente_id', null)
      .order('date_couverture', { ascending: false });

    if (error) throw error;
    setCouverturesOrphelines(data || []);
  };

  useEffect(() => {
    if (couverturesAchat.length > 0 || couverturesVente.length > 0 || couverturesOrphelines.length > 0) {
      calculateStats();
    }
  }, [couverturesAchat, couverturesVente, couverturesOrphelines]);

  const calculateStats = () => {
    const totalVolumeAchat = couverturesAchat.reduce((sum, c) => sum + c.volume_couvert, 0);
    const totalVolumeVente = couverturesVente.reduce((sum, c) => sum + c.volume_couvert, 0);
    const totalVolumeOrpheline = couverturesOrphelines.reduce((sum, c) => sum + c.volume_couvert, 0);
    const totalContratsAchat = couverturesAchat.reduce((sum, c) => sum + c.nombre_contrats, 0);
    const totalContratsVente = couverturesVente.reduce((sum, c) => sum + c.nombre_contrats, 0);
    const totalContratsOrpheline = couverturesOrphelines.reduce((sum, c) => sum + c.nombre_contrats, 0);

    const prixMoyenAchat = couverturesAchat.length > 0 
      ? couverturesAchat.reduce((sum, c) => sum + (c.prix_futures * c.volume_couvert), 0) / totalVolumeAchat
      : 0;

    const prixMoyenVente = couverturesVente.length > 0
      ? couverturesVente.reduce((sum, c) => sum + (c.prix_futures * c.volume_couvert), 0) / totalVolumeVente
      : 0;

    const prixMoyenOrpheline = couverturesOrphelines.length > 0
      ? couverturesOrphelines.reduce((sum, c) => sum + (c.prix_futures * c.volume_couvert), 0) / totalVolumeOrpheline
      : 0;

    // Intégrer les couvertures orphelines dans les totaux de vente pour les statistiques principales
    const totalVolumeVenteAvecOrphelines = totalVolumeVente + totalVolumeOrpheline;
    const totalContratsVenteAvecOrphelines = totalContratsVente + totalContratsOrpheline;
    
    // Calculer le prix moyen de vente global (incluant les orphelines)
    const volumeTotalVentes = totalVolumeVente + totalVolumeOrpheline;
    const valeurTotaleVentes = (couverturesVente.reduce((sum, c) => sum + (c.prix_futures * c.volume_couvert), 0)) + 
                               (couverturesOrphelines.reduce((sum, c) => sum + (c.prix_futures * c.volume_couvert), 0));
    const prixMoyenVenteGlobal = volumeTotalVentes > 0 ? valeurTotaleVentes / volumeTotalVentes : 0;

    // Exposition nette avec les orphelines incluses
    const expositionNette = totalVolumeVenteAvecOrphelines - totalVolumeAchat;
    
    // Gain potentiel avec les orphelines incluses
    const gainPotentiel = (prixMoyenVenteGlobal - prixMoyenAchat) * Math.min(totalVolumeAchat, totalVolumeVenteAvecOrphelines);

    setStats({
      totalVolumeAchat,
      totalVolumeVente: totalVolumeVenteAvecOrphelines, // Inclut les orphelines
      totalVolumeOrpheline,
      totalContratsAchat,
      totalContratsVente: totalContratsVenteAvecOrphelines, // Inclut les orphelines
      totalContratsOrpheline,
      prixMoyenAchat,
      prixMoyenVente: prixMoyenVenteGlobal, // Prix moyen global incluant les orphelines
      prixMoyenOrpheline,
      expositionNette,
      gainPotentiel,
    });
  };

  const formatPrice = (price: number) => {
    return `${price.toFixed(2)} cts/bu`;
  };

  const formatVolume = (volume: number) => {
    return `${volume.toLocaleString('fr-FR')} T`;
  };

  const getProductBadgeColor = (produit: string) => {
    switch (produit) {
      case 'mais': return 'bg-yellow-100 text-yellow-800';
      case 'tourteau_soja': return 'bg-green-100 text-green-800';
      case 'ble': return 'bg-orange-100 text-orange-800';
      case 'orge': return 'bg-blue-100 text-blue-800';
      case 'ddgs': return 'bg-purple-100 text-purple-800';
      case 'ferrailles': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="p-6">Chargement des données futures...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Administration Futures</h1>
        <Badge variant="outline" className="text-lg px-4 py-2">
          Exposition Nette: {formatVolume(stats.expositionNette)}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume Achat Total</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatVolume(stats.totalVolumeAchat)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalContratsAchat} contrats
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume Vente Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatVolume(stats.totalVolumeVente)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalContratsVente} contrats
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prix Moyen Achat</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(stats.prixMoyenAchat)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gain Potentiel</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.gainPotentiel >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.gainPotentiel >= 0 ? '+' : ''}{stats.gainPotentiel.toFixed(0)} €
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="achats" className="space-y-4">
        <TabsList>
          <TabsTrigger value="achats">Couvertures Achat</TabsTrigger>
          <TabsTrigger value="ventes">Couvertures Vente</TabsTrigger>
          <TabsTrigger value="orphelines">Marché Secondaire</TabsTrigger>
          <TabsTrigger value="analysis">Analyse</TabsTrigger>
        </TabsList>

        <TabsContent value="achats" className="space-y-4">
          <div className="grid gap-4">
            {couverturesAchat.map((couverture) => (
              <Card key={couverture.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{couverture.navire.nom}</h3>
                        <Badge className={getProductBadgeColor(couverture.navire.produit)}>
                          {couverture.navire.produit.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline">ACHAT</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Fournisseur: {couverture.navire.fournisseur}
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <span>Volume: {formatVolume(couverture.volume_couvert)}</span>
                        <span>Contrats: {couverture.nombre_contrats}</span>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-lg font-semibold text-red-600">
                        {formatPrice(couverture.prix_futures)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(couverture.date_couverture), 'dd/MM/yyyy', { locale: fr })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ventes" className="space-y-4">
          <div className="grid gap-4">
            {couverturesVente.map((couverture) => (
              <Card key={couverture.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{couverture.vente.navire.nom}</h3>
                        <Badge className={getProductBadgeColor(couverture.vente.navire.produit)}>
                          {couverture.vente.navire.produit.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className="bg-green-100 text-green-800">VENTE</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Client: {couverture.vente.client.nom}
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <span>Volume: {formatVolume(couverture.volume_couvert)}</span>
                        <span>Contrats: {couverture.nombre_contrats}</span>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-lg font-semibold text-green-600">
                        {formatPrice(couverture.prix_futures)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(couverture.date_couverture), 'dd/MM/yyyy', { locale: fr })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="orphelines" className="space-y-4">
          <div className="grid gap-4">
            {couverturesOrphelines.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  Aucune couverture orpheline du marché secondaire
                </CardContent>
              </Card>
            ) : (
              couverturesOrphelines.map((couverture) => (
                <Card key={couverture.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">Couverture Orpheline</h3>
                          <Badge variant="outline" className="bg-orange-100 text-orange-800">MARCHÉ SECONDAIRE</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Futures non assignés suite à une transaction secondaire
                        </div>
                        <div className="flex items-center space-x-4 text-sm">
                          <span>Volume: {formatVolume(couverture.volume_couvert)}</span>
                          <span>Contrats: {couverture.nombre_contrats}</span>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-lg font-semibold text-orange-600">
                          {formatPrice(couverture.prix_futures)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(couverture.date_couverture), 'dd/MM/yyyy', { locale: fr })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Analyse de Position</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Volume Acheté:</span>
                    <span className="font-semibold text-red-600">{formatVolume(stats.totalVolumeAchat)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Volume Vendu:</span>
                    <span className="font-semibold text-green-600">{formatVolume(stats.totalVolumeVente)}</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between">
                      <span className="font-semibold">Exposition Nette:</span>
                      <span className={`font-bold ${stats.expositionNette >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatVolume(Math.abs(stats.expositionNette))} 
                        {stats.expositionNette >= 0 ? ' (Long)' : ' (Short)'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Analyse de Prix</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Prix Moyen Achat:</span>
                    <span className="font-semibold">{formatPrice(stats.prixMoyenAchat)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Prix Moyen Vente:</span>
                    <span className="font-semibold">{formatPrice(stats.prixMoyenVente)}</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between">
                      <span className="font-semibold">Spread Moyen:</span>
                      <span className={`font-bold ${(stats.prixMoyenVente - stats.prixMoyenAchat) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {((stats.prixMoyenVente - stats.prixMoyenAchat) >= 0 ? '+' : '')}{(stats.prixMoyenVente - stats.prixMoyenAchat).toFixed(2)} cts/bu
                      </span>
                    </div>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between">
                      <span className="font-semibold">Gain Potentiel:</span>
                      <span className={`font-bold ${stats.gainPotentiel >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stats.gainPotentiel >= 0 ? '+' : ''}{stats.gainPotentiel.toFixed(0)} €
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}