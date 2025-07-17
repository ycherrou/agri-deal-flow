import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReventeSecondaire {
  id: string;
  volume: number;
  prix_flat_demande: number;
  date_revente: string;
  vente_id: string;
  ventes: {
    navire_id: string;
    volume: number;
    prime_vente: number;
    prix_reference: string;
    navires: {
      nom: string;
      produit: 'mais' | 'tourteau_soja' | 'ble' | 'orge';
      date_arrivee: string;
    };
    clients: {
      nom: string;
    };
  };
  bids_marche_secondaire: Array<{
    id: string;
    prix_bid: number;
    volume_bid: number;
    date_bid: string;
    client_id: string;
    statut: string;
    clients: {
      nom: string;
    };
  }>;
}

interface Client {
  id: string;
  nom: string;
  role: 'admin' | 'client';
}

export default function MarcheSecondaire() {
  const [reventes, setReventes] = useState<ReventeSecondaire[]>([]);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [bidPrices, setBidPrices] = useState<Record<string, string>>({});
  const [bidVolumes, setBidVolumes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentClient();
    fetchReventes();
  }, []);

  const fetchCurrentClient = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('clients')
      .select('id, nom, role')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Erreur lors de la récupération du client:', error);
      return;
    }

    setCurrentClient(data);
  };

  const fetchReventes = async () => {
    try {
      console.log('Fetching reventes...');
      
      const { data, error } = await supabase
        .from('reventes_clients')
        .select(`
          id,
          volume,
          prix_flat_demande,
          date_revente,
          vente_id,
          ventes!inner (
            navire_id,
            volume,
            prime_vente,
            prix_reference,
            client_id,
            navires!inner (
              nom,
              produit,
              date_arrivee
            ),
            clients!inner (
              nom
            )
          ),
          bids_marche_secondaire (
            id,
            prix_bid,
            volume_bid,
            date_bid,
            client_id,
            statut,
            clients (
              nom
            )
          )
        `)
        .in('etat', ['en_attente', 'en_attente_validation'])
        .eq('validated_by_admin', true)
        .order('date_revente', { ascending: false });

      if (error) {
        console.error('Erreur lors de la récupération des reventes:', error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les positions en vente",
          variant: "destructive",
        });
        return;
      }

      console.log('Reventes fetched:', data);
      setReventes(data || []);
    } catch (err) {
      console.error('Erreur inattendue:', err);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBid = async (reventeId: string) => {
    if (!currentClient) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté pour faire une offre",
        variant: "destructive",
      });
      return;
    }

    const prixBid = parseFloat(bidPrices[reventeId]);
    const volumeBid = parseFloat(bidVolumes[reventeId]);

    if (!prixBid || !volumeBid || prixBid <= 0 || volumeBid <= 0) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un prix et un volume valides",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('bids_marche_secondaire')
      .insert({
        revente_id: reventeId,
        client_id: currentClient.id,
        prix_bid: prixBid,
        volume_bid: volumeBid,
      });

    if (error) {
      console.error('Erreur lors de la création de l\'offre:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer votre offre",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Succès",
      description: "Votre offre a été envoyée",
    });

    // Reset form and refresh data
    setBidPrices(prev => ({ ...prev, [reventeId]: '' }));
    setBidVolumes(prev => ({ ...prev, [reventeId]: '' }));
    fetchReventes();
  };

  const formatPrice = (price: number, produit: string) => {
    return `${price.toFixed(2)} USD/MT`;
  };

  const getProductBadgeColor = (produit: string) => {
    switch (produit) {
      case 'mais': return 'bg-yellow-100 text-yellow-800';
      case 'tourteau_soja': return 'bg-green-100 text-green-800';
      case 'ble': return 'bg-orange-100 text-orange-800';
      case 'orge': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Marché Secondaire</h1>
        <p className="text-muted-foreground mt-2">
          Positions disponibles à l'achat sur le marché secondaire
        </p>
      </div>

      {reventes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              Aucune position n'est actuellement disponible sur le marché secondaire.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {reventes.filter(revente => revente.ventes?.navires && revente.ventes?.clients).map((revente) => (
            <Card key={revente.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {revente.ventes.navires.nom}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={getProductBadgeColor(revente.ventes.navires.produit)}>
                        {revente.ventes.navires.produit.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Vendeur: {revente.ventes.clients.nom}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-primary">
                      {formatPrice(revente.prix_flat_demande, revente.ventes.navires.produit)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Prix demandé
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Détails de la position</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Volume disponible:</span>
                          <span className="font-medium">{revente.volume} MT</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Prime initiale:</span>
                          <span>{formatPrice(revente.ventes.prime_vente || 0, revente.ventes.navires.produit)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Référence CBOT:</span>
                          <span>{revente.ventes.prix_reference || 'Non définie'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Date d'arrivée:</span>
                          <span>{format(new Date(revente.ventes.navires.date_arrivee), 'dd/MM/yyyy', { locale: fr })}</span>
                        </div>
                      </div>
                    </div>

                    {revente.bids_marche_secondaire.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Offres existantes</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {revente.bids_marche_secondaire
                            .filter(bid => bid.statut === 'active')
                            .map((bid) => (
                              <div key={bid.id} className="text-xs p-2 bg-muted rounded">
                                <div className="flex justify-between">
                                  <span>{bid.clients?.nom || 'Client inconnu'}</span>
                                  <span className="font-medium">{formatPrice(bid.prix_bid, revente.ventes.navires.produit)}</span>
                                </div>
                                <div className="text-muted-foreground">
                                  {bid.volume_bid} MT • {format(new Date(bid.date_bid), 'dd/MM/yyyy HH:mm', { locale: fr })}
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Faire une offre</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Prix offert (USD/MT)</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 250.00"
                          value={bidPrices[revente.id] || ''}
                          onChange={(e) => setBidPrices(prev => ({ ...prev, [revente.id]: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Volume souhaité (MT)</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={`Max: ${revente.volume}`}
                          max={revente.volume}
                          value={bidVolumes[revente.id] || ''}
                          onChange={(e) => setBidVolumes(prev => ({ ...prev, [revente.id]: e.target.value }))}
                        />
                      </div>
                      <Button 
                        onClick={() => handleBid(revente.id)}
                        className="w-full"
                        disabled={!bidPrices[revente.id] || !bidVolumes[revente.id]}
                      >
                        Envoyer l'offre
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}