import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';

interface Client {
  id: string;
  nom: string;
  email: string;
}

interface Navire {
  id: string;
  nom: string;
  produit: string;
  fournisseur: string;
  quantite_totale: number;
  date_arrivee: string;
}

interface PrixMarche {
  echeance_id: string;
  prix: number;
  echeance?: {
    nom: string;
    active: boolean;
  };
}

export default function CreateDeal() {
  const [clients, setClients] = useState<Client[]>([]);
  const [navires, setNavires] = useState<Navire[]>([]);
  const [prixMarche, setPrixMarche] = useState<PrixMarche[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    navire_id: '',
    type_deal: 'prime' as 'prime' | 'flat',
    volume: '',
    prix_flat: '',
    prime_vente: '',
    prix_reference: '',
    date_deal: new Date().toISOString().split('T')[0]
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
    fetchNavires();
    fetchPrixMarche();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nom, email')
        .order('nom');
      
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les clients',
        variant: 'destructive'
      });
    }
  };

  const fetchNavires = async () => {
    try {
      const { data, error } = await supabase
        .from('navires')
        .select('id, nom, produit, fournisseur, quantite_totale, date_arrivee')
        .order('nom');
      
      if (error) throw error;
      setNavires(data || []);
    } catch (error) {
      console.error('Error fetching navires:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les navires',
        variant: 'destructive'
      });
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

    // Validation : pour les deals prime, la référence CBOT est obligatoire
    if (formData.type_deal === 'prime' && !formData.prix_reference) {
      toast({
        title: 'Erreur de validation',
        description: 'Une référence CBOT est obligatoire pour les deals à prime.',
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    try {
      const dealData = {
        client_id: formData.client_id,
        navire_id: formData.navire_id,
        type_deal: formData.type_deal,
        volume: parseFloat(formData.volume),
        date_deal: formData.date_deal,
        prix_flat: formData.type_deal === 'flat' ? parseFloat(formData.prix_flat) : null,
        prime_vente: formData.type_deal === 'prime' ? parseFloat(formData.prime_vente) : null,
        prix_reference: formData.prix_reference || null
      };

      const { error } = await supabase
        .from('ventes')
        .insert([dealData]);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Deal créé avec succès'
      });

      navigate('/deals');
    } catch (error) {
      console.error('Error creating deal:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le deal',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/deals')}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Créer un nouveau deal</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations du deal</CardTitle>
          <CardDescription>
            Remplissez les informations nécessaires pour créer un nouveau deal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select value={formData.client_id} onValueChange={(value) => handleInputChange('client_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.nom} ({client.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="navire">Navire</Label>
                <Select value={formData.navire_id} onValueChange={(value) => handleInputChange('navire_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un navire" />
                  </SelectTrigger>
                  <SelectContent>
                    {navires.map((navire) => (
                      <SelectItem key={navire.id} value={navire.id}>
                        {navire.nom} - {navire.produit} ({navire.fournisseur})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type_deal">Type de deal</Label>
                <Select value={formData.type_deal} onValueChange={(value: 'prime' | 'flat') => handleInputChange('type_deal', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prime">Prime</SelectItem>
                    <SelectItem value="flat">Flat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="volume">Volume</Label>
                <Input
                  id="volume"
                  type="number"
                  step="0.01"
                  placeholder="Volume en tonnes"
                  value={formData.volume}
                  onChange={(e) => handleInputChange('volume', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_deal">Date du deal</Label>
                <Input
                  id="date_deal"
                  type="date"
                  value={formData.date_deal}
                  onChange={(e) => handleInputChange('date_deal', e.target.value)}
                  required
                />
              </div>

              {formData.type_deal === 'prime' && (
                <div className="space-y-2">
                  <Label htmlFor="prix_reference">Référence CBOT *</Label>
                  <Select value={formData.prix_reference} onValueChange={(value) => handleInputChange('prix_reference', value)}>
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
                  {formData.type_deal === 'prime' && !formData.prix_reference && (
                    <p className="text-sm text-destructive">
                      Une référence CBOT est obligatoire pour les deals à prime
                    </p>
                  )}
                </div>
              )}

              {formData.type_deal === 'flat' && (
                <div className="space-y-2">
                  <Label htmlFor="prix_flat">Prix flat</Label>
                  <Input
                    id="prix_flat"
                    type="number"
                    step="0.01"
                    placeholder="Prix flat en $"
                    value={formData.prix_flat}
                    onChange={(e) => handleInputChange('prix_flat', e.target.value)}
                    required
                  />
                </div>
              )}

              {formData.type_deal === 'prime' && (
                <div className="space-y-2">
                  <Label htmlFor="prime_vente">Prime de vente</Label>
                  <Input
                    id="prime_vente"
                    type="number"
                    step="0.01"
                    placeholder="Prime de vente en $"
                    value={formData.prime_vente}
                    onChange={(e) => handleInputChange('prime_vente', e.target.value)}
                    required
                  />
                </div>
              )}
            </div>


            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/deals')}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Création...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Créer le deal
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}