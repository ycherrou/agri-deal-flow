import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, RotateCcw } from 'lucide-react';

interface Deal {
  id: string;
  client_id: string;
  navire_id: string;
  type_deal: 'prime' | 'flat';
  volume: number;
  prix_flat: number | null;
  prime_vente: number | null;
  prix_reference: string | null;
  date_deal: string;
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

interface Couverture {
  volume_couvert: number;
}

interface PrixMarche {
  echeance_id: string;
  prix: number;
  echeance?: {
    nom: string;
    active: boolean;
  };
}

export default function RollDeal() {
  const { id } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [couvertures, setCouvertures] = useState<Couverture[]>([]);
  const [prixMarche, setPrixMarche] = useState<PrixMarche[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [formData, setFormData] = useState({
    volume_to_roll: '',
    nouveau_prix_reference: '',
    nouvelle_prime_vente: '',
    date_roll: new Date().toISOString().split('T')[0]
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchDeal();
      fetchCouvertures();
      fetchPrixMarche();
    }
  }, [id]);

  const fetchDeal = async () => {
    try {
      const { data, error } = await supabase
        .from('ventes')
        .select(`
          *,
          client:clients(nom, email),
          navire:navires(nom, produit, fournisseur)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setDeal(data);
    } catch (error) {
      console.error('Error fetching deal:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger le deal',
        variant: 'destructive'
      });
      navigate('/deals');
    }
  };

  const fetchCouvertures = async () => {
    try {
      const { data, error } = await supabase
        .from('couvertures')
        .select('volume_couvert')
        .eq('vente_id', id);

      if (error) throw error;
      setCouvertures(data || []);
    } catch (error) {
      console.error('Error fetching couvertures:', error);
    } finally {
      setInitialLoading(false);
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

  const volumeCouvert = couvertures.reduce((sum, c) => sum + c.volume_couvert, 0);
  const volumeNonCouvert = deal ? deal.volume - volumeCouvert : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const volumeToRoll = parseFloat(formData.volume_to_roll);
    
    // Validation
    if (volumeToRoll <= 0 || volumeToRoll > volumeNonCouvert) {
      toast({
        title: 'Erreur de validation',
        description: `Le volume à roller doit être entre 0 et ${volumeNonCouvert} tonnes`,
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    if (!formData.nouveau_prix_reference) {
      toast({
        title: 'Erreur de validation',
        description: 'Une nouvelle référence CBOT est obligatoire',
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    if (formData.nouveau_prix_reference === deal?.prix_reference) {
      toast({
        title: 'Erreur de validation',
        description: 'La nouvelle référence doit être différente de la référence actuelle',
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    try {
      // Transaction : 1. Réduire le volume de la vente originale
      const nouveauVolumeOriginal = deal!.volume - volumeToRoll;
      
      const { error: updateError } = await supabase
        .from('ventes')
        .update({ volume: nouveauVolumeOriginal })
        .eq('id', id);

      if (updateError) throw updateError;

      // 2. Créer la nouvelle vente avec le volume rollé
      const nouvelleVente = {
        client_id: deal!.client_id,
        navire_id: deal!.navire_id,
        type_deal: deal!.type_deal,
        volume: volumeToRoll,
        prix_reference: formData.nouveau_prix_reference,
        prime_vente: formData.nouvelle_prime_vente ? parseFloat(formData.nouvelle_prime_vente) : deal!.prime_vente,
        prix_flat: null,
        date_deal: formData.date_roll
      };

      const { error: insertError } = await supabase
        .from('ventes')
        .insert([nouvelleVente]);

      if (insertError) throw insertError;

      toast({
        title: 'Succès',
        description: `Roll effectué avec succès : ${volumeToRoll} tonnes rollées vers ${formData.nouveau_prix_reference}`
      });

      navigate('/deals');
    } catch (error) {
      console.error('Error rolling deal:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'effectuer le roll',
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

  // Initialiser le volume à roller avec le volume non couvert
  useEffect(() => {
    if (volumeNonCouvert > 0 && !formData.volume_to_roll) {
      setFormData(prev => ({
        ...prev,
        volume_to_roll: volumeNonCouvert.toString()
      }));
    }
  }, [volumeNonCouvert, formData.volume_to_roll]);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!deal) {
    return <div>Deal non trouvé</div>;
  }

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
        <h1 className="text-2xl font-bold text-foreground">Roll de deal</h1>
      </div>

      {/* Informations actuelles du deal */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Informations actuelles</CardTitle>
          <CardDescription>
            Deal #{deal.id.slice(0, 8)} - {deal.client.nom}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Navire</div>
              <div className="font-medium">{deal.navire.nom}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Produit</div>
              <div className="font-medium">{deal.navire.produit}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Volume total</div>
              <div className="font-medium">{deal.volume} tonnes</div>
            </div>
            <div>
              <div className="text-muted-foreground">Volume couvert</div>
              <div className="font-medium">{volumeCouvert} tonnes</div>
            </div>
            <div>
              <div className="text-muted-foreground">Volume non couvert</div>
              <div className="font-medium text-orange-600">{volumeNonCouvert} tonnes</div>
            </div>
            <div>
              <div className="text-muted-foreground">Référence actuelle</div>
              <div className="font-medium">{deal.prix_reference}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulaire de roll */}
      <Card>
        <CardHeader>
          <CardTitle>Paramètres du roll</CardTitle>
          <CardDescription>
            Spécifiez le volume à roller et la nouvelle référence CBOT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="volume_to_roll">Volume à roller (tonnes)</Label>
                <Input
                  id="volume_to_roll"
                  type="number"
                  step="0.01"
                  max={volumeNonCouvert}
                  placeholder="Volume à roller"
                  value={formData.volume_to_roll}
                  onChange={(e) => handleInputChange('volume_to_roll', e.target.value)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Maximum disponible : {volumeNonCouvert} tonnes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nouveau_prix_reference">Nouvelle référence CBOT *</Label>
                <Select value={formData.nouveau_prix_reference} onValueChange={(value) => handleInputChange('nouveau_prix_reference', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un nouveau contrat CBOT" />
                  </SelectTrigger>
                  <SelectContent>
                    {prixMarche.map((prix) => (
                      <SelectItem key={prix.echeance_id} value={prix.echeance?.nom || ''}>
                        {prix.echeance?.nom} - {prix.prix} cts/bu
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nouvelle_prime_vente">Nouvelle prime de vente (optionnel)</Label>
                <Input
                  id="nouvelle_prime_vente"
                  type="number"
                  step="0.01"
                  placeholder={`Prime actuelle : ${deal.prime_vente}`}
                  value={formData.nouvelle_prime_vente}
                  onChange={(e) => handleInputChange('nouvelle_prime_vente', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Laissez vide pour conserver la prime actuelle
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_roll">Date effective du roll</Label>
                <Input
                  id="date_roll"
                  type="date"
                  value={formData.date_roll}
                  onChange={(e) => handleInputChange('date_roll', e.target.value)}
                  required
                />
              </div>
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
                    Roll en cours...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Effectuer le roll
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