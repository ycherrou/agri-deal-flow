import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Ship, Edit, Trash2, Calendar, Package, User, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CouverturesAchat from '@/components/CouverturesAchat';

interface Navire {
  id: string;
  nom: string;
  produit: 'mais' | 'tourteau_soja' | 'ble' | 'orge';
  quantite_totale: number;
  prime_achat: number | null;
  reference_cbot?: string | null;
  date_arrivee: string;
  fournisseur: string;
  created_at: string;
  volumeVendu?: number;
  nombreClients?: number;
}

interface PrixMarche {
  echeance_id: string;
  prix: number;
  echeance?: {
    nom: string;
    active: boolean;
  };
}

const PRODUCTS = [
  { value: 'mais', label: 'Maïs' },
  { value: 'tourteau_soja', label: 'Tourteau de soja' },
  { value: 'ble', label: 'Blé' },
  { value: 'orge', label: 'Orge' }
];

export default function Navires() {
  const [navires, setNavires] = useState<Navire[]>([]);
  const [prixMarche, setPrixMarche] = useState<PrixMarche[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNavire, setEditingNavire] = useState<Navire | null>(null);
  const [selectedNavireId, setSelectedNavireId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nom: '',
    produit: '' as 'mais' | 'tourteau_soja' | 'ble' | 'orge',
    quantite_totale: '',
    prime_achat: '',
    reference_cbot: '',
    date_arrivee: '',
    fournisseur: '',
    facteur_conversion: ''
  });

  // Calcul automatique du facteur de conversion
  useEffect(() => {
    let facteur = '';
    if (formData.produit === 'mais') {
      facteur = '0.3937';
    } else if (formData.produit === 'tourteau_soja') {
      facteur = '0.4640';
    }
    setFormData(prev => ({ ...prev, facteur_conversion: facteur }));
  }, [formData.produit]);

  useEffect(() => {
    fetchNavires();
    fetchPrixMarche();
  }, []);

  const fetchNavires = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('navires')
        .select(`
          *,
          ventes (
            volume,
            client_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching navires:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les navires.',
          variant: 'destructive'
        });
        return;
      }

      const naviresWithStats = data.map(navire => ({
        ...navire,
        volumeVendu: navire.ventes.reduce((sum: number, vente: any) => sum + vente.volume, 0),
        nombreClients: new Set(navire.ventes.map((vente: any) => vente.client_id)).size
      }));

      setNavires(naviresWithStats);
    } catch (error) {
      console.error('Error fetching navires:', error);
      toast({
        title: 'Erreur',
        description: 'Une erreur inattendue s\'est produite.',
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
        .select('echeance_id, prix, echeance:echeances!inner(nom, active)')
        .eq('echeance.active', true);

      if (error) throw error;
      setPrixMarche(data || []);
    } catch (error) {
      console.error('Error fetching prix marché:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validation : si prime_achat est renseignée, reference_cbot doit l'être aussi
    if (formData.prime_achat && !formData.reference_cbot) {
      toast({
        title: 'Erreur de validation',
        description: 'Une référence CBOT est obligatoire quand une prime d\'achat est spécifiée.',
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    try {
      const navireData = {
        nom: formData.nom,
        produit: formData.produit,
        quantite_totale: parseFloat(formData.quantite_totale),
        prime_achat: formData.prime_achat ? parseFloat(formData.prime_achat) : null,
        reference_cbot: formData.reference_cbot || null,
        date_arrivee: formData.date_arrivee,
        fournisseur: formData.fournisseur
      };

      let result;
      if (editingNavire) {
        result = await supabase
          .from('navires')
          .update(navireData)
          .eq('id', editingNavire.id);
      } else {
        result = await supabase
          .from('navires')
          .insert([navireData]);
      }

      if (result.error) {
        console.error('Error saving navire:', result.error);
        toast({
          title: 'Erreur',
          description: 'Impossible de sauvegarder le navire.',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Succès',
        description: `Navire ${editingNavire ? 'modifié' : 'créé'} avec succès.`
      });

      setIsDialogOpen(false);
      resetForm();
      fetchNavires();
    } catch (error) {
      console.error('Error saving navire:', error);
      toast({
        title: 'Erreur',
        description: 'Une erreur inattendue s\'est produite.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (navire: Navire) => {
    setEditingNavire(navire);
    const facteur = navire.produit === 'mais' ? '0.3937' : navire.produit === 'tourteau_soja' ? '0.4640' : '';
    setFormData({
      nom: navire.nom,
      produit: navire.produit,
      quantite_totale: navire.quantite_totale.toString(),
      prime_achat: navire.prime_achat?.toString() || '',
      reference_cbot: navire.reference_cbot || '',
      date_arrivee: navire.date_arrivee,
      fournisseur: navire.fournisseur,
      facteur_conversion: facteur
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce navire ?')) return;

    try {
      const { error } = await supabase
        .from('navires')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting navire:', error);
        toast({
          title: 'Erreur',
          description: 'Impossible de supprimer le navire.',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Succès',
        description: 'Navire supprimé avec succès.'
      });

      fetchNavires();
    } catch (error) {
      console.error('Error deleting navire:', error);
      toast({
        title: 'Erreur',
        description: 'Une erreur inattendue s\'est produite.',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      produit: '' as 'mais' | 'tourteau_soja' | 'ble' | 'orge',
      quantite_totale: '',
      prime_achat: '',
      reference_cbot: '',
      date_arrivee: '',
      fournisseur: '',
      facteur_conversion: ''
    });
    setEditingNavire(null);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    resetForm();
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getVolumeRestant = (navire: Navire) => {
    return navire.quantite_totale - (navire.volumeVendu || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">
          Gestion des Navires
        </h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Navire
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingNavire ? 'Modifier le navire' : 'Créer un nouveau navire'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom du navire</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="produit">Produit</Label>
                <Select
                  value={formData.produit}
                  onValueChange={(value: 'mais' | 'tourteau_soja' | 'ble' | 'orge') =>
                    setFormData({ ...formData, produit: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un produit" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTS.map((product) => (
                      <SelectItem key={product.value} value={product.value}>
                        {product.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantite_totale">Quantité totale (MT)</Label>
                <Input
                  id="quantite_totale"
                  type="number"
                  step="0.01"
                  value={formData.quantite_totale}
                  onChange={(e) => setFormData({ ...formData, quantite_totale: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prime_achat">Prime d'achat (cts/bu)</Label>
                <Input
                  id="prime_achat"
                  type="number"
                  step="0.01"
                  value={formData.prime_achat}
                  onChange={(e) => setFormData({ ...formData, prime_achat: e.target.value })}
                />
              </div>

              {formData.prime_achat && (
                <div className="space-y-2">
                  <Label htmlFor="reference_cbot">Référence CBOT *</Label>
                  <Select
                    value={formData.reference_cbot}
                    onValueChange={(value) => setFormData({ ...formData, reference_cbot: value })}
                  >
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
                  {formData.prime_achat && !formData.reference_cbot && (
                    <p className="text-sm text-destructive">
                      Une référence CBOT est obligatoire pour les primes
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="date_arrivee">Date d'arrivée</Label>
                <Input
                  id="date_arrivee"
                  type="date"
                  value={formData.date_arrivee}
                  onChange={(e) => setFormData({ ...formData, date_arrivee: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fournisseur">Fournisseur</Label>
                <Input
                  id="fournisseur"
                  value={formData.fournisseur}
                  onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="facteur_conversion">Facteur de conversion</Label>
                <Input
                  id="facteur_conversion"
                  value={formData.facteur_conversion}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Annuler
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Sauvegarde...' : (editingNavire ? 'Modifier' : 'Créer')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Ship className="h-5 w-5 mr-2" />
            Liste des Navires
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Chargement...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navire</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Prime Achat</TableHead>
                  <TableHead>Référence CBOT</TableHead>
                  <TableHead>Date Arrivée</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {navires.map((navire) => (
                  <TableRow key={navire.id}>
                    <TableCell className="font-medium">{navire.nom}</TableCell>
                    <TableCell>
                      <Badge className={getProductBadgeColor(navire.produit)}>
                        {PRODUCTS.find(p => p.value === navire.produit)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{navire.quantite_totale} MT</TableCell>
                    <TableCell>
                      {navire.prime_achat ? `${navire.prime_achat} cts/bu` : '-'}
                    </TableCell>
                    <TableCell>
                      {navire.reference_cbot || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                        {formatDate(navire.date_arrivee)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1 text-muted-foreground" />
                        {navire.fournisseur}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Package className="h-3 w-3 mr-1 text-muted-foreground" />
                          {navire.volumeVendu || 0} / {navire.quantite_totale} MT
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {navire.nombreClients || 0} client{(navire.nombreClients || 0) > 1 ? 's' : ''}
                        </div>
                      </div>
                    </TableCell>
                     <TableCell>
                       <div className="flex space-x-2">
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => setSelectedNavireId(navire.id)}
                         >
                           Couvertures d'achat
                         </Button>
                         {navire.prime_achat && getVolumeRestant(navire) > 0 && (
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => window.location.href = `/navires/roll/${navire.id}`}
                             title="Changer la référence CBOT"
                           >
                             <RotateCcw className="h-4 w-4" />
                           </Button>
                         )}
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => handleEdit(navire)}
                         >
                           <Edit className="h-4 w-4" />
                         </Button>
                         <Button
                           size="sm"
                           variant="destructive"
                           onClick={() => handleDelete(navire.id)}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                     </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section des couvertures d'achat */}
      {selectedNavireId && (
        <CouverturesAchat navireId={selectedNavireId} />
      )}
    </div>
  );
}