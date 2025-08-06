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
  prix_flat_demande: number | null;
  prime_demandee: number | null;
  date_revente: string;
  vente_id: string;
  type_position: 'couverte' | 'non_couverte';
  ventes: {
    navire_id: string;
    volume: number;
    prime_vente: number;
    prix_reference: string;
    client_id: string;
    navires: {
      nom: string;
      produit: 'mais' | 'tourteau_soja' | 'ble' | 'orge' | 'ddgs' | 'ferrailles';
      date_arrivee: string;
    };
    clients?: {
      nom: string;
    } | null;
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
  }, []);

  useEffect(() => {
    if (currentClient) {
      fetchReventes();
    }
  }, [currentClient]);

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
          prime_demandee,
          date_revente,
          vente_id,
          type_position,
          ventes (
            navire_id,
            volume,
            prime_vente,
            prix_reference,
            client_id,
            navires (
              nom,
              produit,
              date_arrivee
            ),
            clients (
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
        .eq('etat', 'en_attente')
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
      
      // Filtrer les reventes pour exclure celles appartenant au client connecté (sauf pour les admins qui voient tout)
      const filteredReventes = (data || []).filter(revente => {
        if (!currentClient) return true;
        if (currentClient.role === 'admin') return true; // Les admins voient tout pour pouvoir annuler
        // Exclure seulement les reventes qui appartiennent au client connecté
        return revente.ventes?.client_id !== currentClient.id;
      });
      
      setReventes(filteredReventes as ReventeSecondaire[]);
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

    // Vérifier que le client n'est pas le propriétaire de la position
    const revente = reventes.find(r => r.id === reventeId);
    if (revente && revente.ventes?.client_id === currentClient.id) {
      toast({
        title: "Erreur",
        description: "Vous ne pouvez pas faire une offre sur votre propre position",
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
      
      // Gestion d'erreur spécifique pour l'auto-achat
      if (error.message?.includes('row-level security policy')) {
        toast({
          title: "Erreur",
          description: "Vous ne pouvez pas faire une offre sur votre propre position",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de créer votre offre",
          variant: "destructive",
        });
      }
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

  const handleCancelRevente = async (reventeId: string) => {
    if (!currentClient || currentClient.role !== 'admin') {
      toast({
        title: "Erreur",
        description: "Seuls les administrateurs peuvent annuler des reventes",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('reventes_clients')
        .update({ 
          etat: 'retire' as any, // Force le type pour éviter les erreurs de TypeScript
          validated_by_admin: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', reventeId);

      if (error) {
        console.error('Erreur lors de l\'annulation:', error);
        toast({
          title: "Erreur",
          description: "Impossible d'annuler cette revente",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Succès",
        description: "Revente annulée avec succès",
      });

      // Refresh data
      fetchReventes();
    } catch (err) {
      console.error('Erreur inattendue lors de l\'annulation:', err);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: number, produit: string) => {
    return `${price.toFixed(2)} USD/MT`;
  };

  const formatRevoutePrice = (revente: ReventeSecondaire) => {
    if (revente.type_position === 'non_couverte' && revente.prime_demandee) {
      return `${revente.prime_demandee.toFixed(2)} cts/bu (prime)`;
    }
    if (revente.prix_flat_demande) {
      return `${revente.prix_flat_demande.toFixed(2)} USD/MT`;
    }
    return 'Prix non défini';
  };

  const formatBidPrice = (price: number, revente: ReventeSecondaire) => {
    if (revente.type_position === 'non_couverte') {
      return `${price.toFixed(2)} cts/bu`;
    }
    return `${price.toFixed(2)} USD/MT`;
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
              {currentClient ? 
                "Aucune position n'est actuellement disponible sur le marché secondaire." :
                "Connectez-vous pour voir les positions disponibles."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {reventes.filter(revente => revente.ventes?.navires).map((revente) => (
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
                      <Badge variant={revente.type_position === 'couverte' ? 'default' : 'secondary'}>
                        {revente.type_position === 'couverte' ? '🛡️ Couverte' : '📈 Non couverte'}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-primary">
                      {formatRevoutePrice(revente)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {revente.type_position === 'non_couverte' ? 'Prime demandée' : 'Prix demandé'}
                    </div>
                    {currentClient?.role === 'admin' && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleCancelRevente(revente.id)}
                        className="mt-2"
                      >
                        Annuler
                      </Button>
                    )}
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
                                   <span className="font-medium">{formatBidPrice(bid.prix_bid, revente)}</span>
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

                  {/* Masquer l'option d'offre seulement si c'est la propre position du client */}
                  {currentClient && revente.ventes?.client_id !== currentClient.id && (
                    <div className="space-y-4">
                      <h4 className="font-medium">Faire une offre</h4>
                       <div className="space-y-3">
                         <div>
                           <label className="text-sm font-medium">
                             {revente.type_position === 'non_couverte' 
                               ? 'Prime offerte (cts/bu)' 
                               : 'Prix offert (USD/MT)'
                             }
                           </label>
                           <Input
                             type="number"
                             step="0.01"
                             placeholder={revente.type_position === 'non_couverte' 
                               ? 'Ex: 50.00' 
                               : 'Ex: 250.00'
                             }
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
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}