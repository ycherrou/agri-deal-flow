import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Eye, Calendar, Package, Users, Trash2, Edit } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Deal {
  id: string;
  date_deal: string;
  type_deal: 'prime' | 'flat';
  volume: number;
  prix_flat: number | null;
  prime_vente: number | null;
  prix_reference: string | null;
  client: {
    nom: string;
    email: string;
  };
  navire: {
    nom: string;
    produit: string;
    fournisseur: string;
  };
}

export default function Deals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    try {
      const { data, error } = await supabase
        .from('ventes')
        .select(`
          id,
          date_deal,
          type_deal,
          volume,
          prix_flat,
          prime_vente,
          prix_reference,
          client:clients(nom, email),
          navire:navires(nom, produit, fournisseur)
        `)
        .order('date_deal', { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les deals',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  const handleDeleteDeal = async (dealId: string) => {
    try {
      const { error } = await supabase
        .from('ventes')
        .delete()
        .eq('id', dealId);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Deal supprimé avec succès'
      });

      // Refresh the deals list
      fetchDeals();
    } catch (error) {
      console.error('Error deleting deal:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le deal',
        variant: 'destructive'
      });
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deals</h1>
          <p className="text-muted-foreground">
            Gestion des deals et transactions commerciales
          </p>
        </div>
        <Button onClick={() => navigate('/deals/create')}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau deal
        </Button>
      </div>

      <div className="grid gap-4">
        {deals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun deal</h3>
              <p className="text-muted-foreground text-center mb-4">
                Vous n'avez pas encore créé de deal.
              </p>
              <Button onClick={() => navigate('/deals/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Créer votre premier deal
              </Button>
            </CardContent>
          </Card>
        ) : (
          deals.map((deal) => (
            <Card key={deal.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      Deal #{deal.id.slice(0, 8)}
                    </CardTitle>
                    <CardDescription>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(deal.date_deal)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {deal.client.nom}
                        </span>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={deal.type_deal === 'prime' ? 'default' : 'secondary'}>
                      {deal.type_deal === 'prime' ? 'Prime' : 'Flat'}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                          <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer ce deal ? Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteDeal(deal.id)}>
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Navire</div>
                    <div className="font-medium">{deal.navire.nom}</div>
                    <div className="text-sm text-muted-foreground">
                      {deal.navire.produit} - {deal.navire.fournisseur}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Volume</div>
                    <div className="font-medium">{deal.volume} tonnes</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Prix</div>
                    <div className="font-medium">
                      {deal.type_deal === 'flat' && deal.prix_flat
                        ? formatPrice(deal.prix_flat)
                        : deal.type_deal === 'prime' && deal.prime_vente
                        ? `Prime: ${formatPrice(deal.prime_vente)}`
                        : 'Non défini'}
                    </div>
                  </div>
                </div>
                {deal.prix_reference && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">Prix de référence</div>
                    <div className="text-sm">{deal.prix_reference}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}