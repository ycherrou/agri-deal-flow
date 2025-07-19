import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle, XCircle, Clock, Shield, TrendingUp } from 'lucide-react';

interface ReventeEnAttente {
  id: string;
  volume: number;
  prix_flat_demande: number | null;
  prime_demandee: number | null;
  date_revente: string;
  vente_id: string;
  type_position: 'couverte' | 'non_couverte';
  etat: string;
  validated_by_admin: boolean | null;
  date_expiration_validation: string | null;
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
}

export default function AdminReventes() {
  const [reventes, setReventes] = useState<ReventeEnAttente[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchReventes();
  }, []);

  const fetchReventes = async () => {
    try {
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
          etat,
          validated_by_admin,
          date_expiration_validation,
          ventes (
            navire_id,
            volume,
            prime_vente,
            prix_reference,
            navires (
              nom,
              produit,
              date_arrivee
            ),
            clients (
              nom
            )
          )
        `)
        .eq('etat', 'en_attente')
        .eq('validated_by_admin', false)
        .order('date_revente', { ascending: false });

      if (error) {
        console.error('Erreur lors de la récupération des reventes:', error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les demandes de revente",
          variant: "destructive",
        });
        return;
      }

      setReventes((data || []) as ReventeEnAttente[]);
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

  const handleValidation = async (reventeId: string, action: 'approve' | 'reject') => {
    setProcessing(reventeId);
    
    try {
      const updates: any = {
        updated_at: new Date().toISOString(),
        admin_validation_date: new Date().toISOString(),
      };

      if (action === 'approve') {
        updates.validated_by_admin = true;
      } else {
        updates.etat = 'retire';
        updates.validated_by_admin = false;
      }

      const { error } = await supabase
        .from('reventes_clients')
        .update(updates)
        .eq('id', reventeId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: action === 'approve' 
          ? "Demande de revente approuvée et mise sur le marché" 
          : "Demande de revente rejetée",
      });

      // Refresh data
      fetchReventes();
    } catch (error) {
      console.error('Erreur lors de la validation:', error);
      toast({
        title: "Erreur",
        description: "Impossible de traiter la demande",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const formatPrice = (revente: ReventeEnAttente) => {
    if (revente.type_position === 'non_couverte' && revente.prime_demandee) {
      return `${revente.prime_demandee.toFixed(2)} cts/bu (prime)`;
    }
    if (revente.prix_flat_demande) {
      return `${revente.prix_flat_demande.toFixed(2)} USD/MT`;
    }
    return 'Prix non défini';
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

  const isExpired = (dateExpiration: string | null) => {
    if (!dateExpiration) return false;
    return new Date(dateExpiration) < new Date();
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
        <h1 className="text-3xl font-bold">Administration - Validation des Reventes</h1>
        <p className="text-muted-foreground mt-2">
          Demandes de revente en attente de validation ({reventes.length} en attente)
        </p>
      </div>

      {reventes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Aucune demande de revente en attente de validation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {reventes.map((revente) => (
            <Card key={revente.id} className={isExpired(revente.date_expiration_validation) ? 'border-red-200' : ''}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-orange-500" />
                      {revente.ventes.navires.nom}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={getProductBadgeColor(revente.ventes.navires.produit)}>
                        {revente.ventes.navires.produit.replace('_', ' ')}
                      </Badge>
                      <Badge variant={revente.type_position === 'couverte' ? 'default' : 'secondary'}>
                        {revente.type_position === 'couverte' ? (
                          <>
                            <Shield className="h-3 w-3 mr-1" />
                            Couverte
                          </>
                        ) : (
                          <>
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Non couverte
                          </>
                        )}
                      </Badge>
                      {isExpired(revente.date_expiration_validation) && (
                        <Badge variant="destructive">Expirée</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Vendeur: {revente.ventes.clients.nom}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-primary">
                      {formatPrice(revente)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {revente.type_position === 'non_couverte' ? 'Prime demandée' : 'Prix demandé'}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Détails de la demande</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Volume à vendre:</span>
                          <span className="font-medium">{revente.volume} MT</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Date de demande:</span>
                          <span>{format(new Date(revente.date_revente), 'dd/MM/yyyy', { locale: fr })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Date d'arrivée navire:</span>
                          <span>{format(new Date(revente.ventes.navires.date_arrivee), 'dd/MM/yyyy', { locale: fr })}</span>
                        </div>
                        {revente.date_expiration_validation && (
                          <div className="flex justify-between">
                            <span>Expiration validation:</span>
                            <span className={isExpired(revente.date_expiration_validation) ? 'text-red-500 font-medium' : ''}>
                              {format(new Date(revente.date_expiration_validation), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Actions de validation</h4>
                    <div className="flex gap-3">
                      <Button 
                        onClick={() => handleValidation(revente.id, 'approve')}
                        disabled={processing === revente.id}
                        className="flex-1"
                        variant="default"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {processing === revente.id ? 'Traitement...' : 'Approuver'}
                      </Button>
                      <Button 
                        onClick={() => handleValidation(revente.id, 'reject')}
                        disabled={processing === revente.id}
                        className="flex-1"
                        variant="destructive"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Rejeter
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Une fois approuvée, la position sera visible sur le marché secondaire
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