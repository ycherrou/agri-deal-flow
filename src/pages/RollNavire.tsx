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

interface Navire {
  id: string;
  nom: string;
  produit: 'mais' | 'tourteau_soja' | 'ble' | 'orge' | 'ddgs' | 'ferrailles';
  fournisseur: string;
  quantite_totale: number;
  prime_achat: number | null;
  reference_cbot: string | null;
  date_arrivee: string;
  date_debut_planche?: string;
  date_fin_planche?: string;
}

interface CouvertureAchat {
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

export default function RollNavire() {
  const { id } = useParams<{ id: string }>();
  const [navire, setNavire] = useState<Navire | null>(null);
  const [couvertures, setCouvertures] = useState<CouvertureAchat[]>([]);
  const [prixMarche, setPrixMarche] = useState<PrixMarche[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [formData, setFormData] = useState({
    volume_to_roll: '',
    nouvelle_reference_cbot: '',
    date_roll: new Date().toISOString().split('T')[0]
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchNavire();
      fetchCouvertures();
      fetchPrixMarche();
    }
  }, [id]);

  const fetchNavire = async () => {
    try {
      const { data, error } = await supabase
        .from('navires')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setNavire(data);
    } catch (error) {
      console.error('Error fetching navire:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger le navire',
        variant: 'destructive'
      });
      navigate('/navires');
    }
  };

  const fetchCouvertures = async () => {
    try {
      const { data, error } = await supabase
        .from('couvertures_achat')
        .select('volume_couvert')
        .eq('navire_id', id);

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
  const volumeNonCouvert = navire ? navire.quantite_totale - volumeCouvert : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const volumeToRoll = parseFloat(formData.volume_to_roll);
    
    // Validation
    if (volumeToRoll <= 0 || volumeToRoll > volumeNonCouvert) {
      toast({
        title: 'Erreur de validation',
        description: `Le volume à changer de référence doit être entre 0 et ${volumeNonCouvert} tonnes`,
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    if (!formData.nouvelle_reference_cbot) {
      toast({
        title: 'Erreur de validation',
        description: 'Une nouvelle référence CBOT est obligatoire',
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    if (formData.nouvelle_reference_cbot === navire?.reference_cbot) {
      toast({
        title: 'Erreur de validation',
        description: 'La nouvelle référence doit être différente de la référence actuelle',
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    try {
      // Transaction : 1. Réduire la quantité du navire original
      const nouvelleQuantiteOriginale = navire!.quantite_totale - volumeToRoll;
      
      const { error: updateError } = await supabase
        .from('navires')
        .update({ quantite_totale: nouvelleQuantiteOriginale })
        .eq('id', id);

      if (updateError) throw updateError;

      // 2. Créer le nouveau navire avec le volume rollé
      const nouveauNavire = {
        nom: `${navire!.nom} - Roll ${formData.nouvelle_reference_cbot}`,
        produit: navire!.produit,
        fournisseur: navire!.fournisseur,
        quantite_totale: volumeToRoll,
        prime_achat: navire!.prime_achat,
        reference_cbot: formData.nouvelle_reference_cbot,
        date_arrivee: navire!.date_arrivee,
        date_debut_planche: navire!.date_debut_planche || navire!.date_arrivee,
        date_fin_planche: navire!.date_fin_planche || new Date(new Date(navire!.date_arrivee).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        parent_navire_id: navire!.id
      };

      const { error: insertError } = await supabase
        .from('navires')
        .insert(nouveauNavire);

      if (insertError) throw insertError;

      toast({
        title: 'Succès',
        description: `Changement de référence effectué avec succès : ${volumeToRoll} tonnes changées vers ${formData.nouvelle_reference_cbot}`
      });

      navigate('/navires');
    } catch (error) {
      console.error('Error rolling navire:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'effectuer le changement de référence',
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

  if (!navire) {
    return <div>Navire non trouvé</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/navires')}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Changement de référence - Achat</h1>
      </div>

      {/* Informations actuelles du navire */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Informations actuelles</CardTitle>
          <CardDescription>
            Navire {navire.nom} - {navire.fournisseur}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Produit</div>
              <div className="font-medium">{navire.produit}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Quantité totale</div>
              <div className="font-medium">{navire.quantite_totale} tonnes</div>
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
              <div className="text-muted-foreground">Prime d'achat</div>
              <div className="font-medium">{navire.prime_achat}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Référence actuelle</div>
              <div className="font-medium">{navire.reference_cbot}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulaire de roll */}
      <Card>
        <CardHeader>
          <CardTitle>Paramètres du changement de référence</CardTitle>
          <CardDescription>
            Spécifiez le volume à changer de référence et la nouvelle référence CBOT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="volume_to_roll">Volume à changer de référence (tonnes)</Label>
                <Input
                  id="volume_to_roll"
                  type="number"
                  step="0.01"
                  max={volumeNonCouvert}
                  placeholder="Volume à changer de référence"
                  value={formData.volume_to_roll}
                  onChange={(e) => handleInputChange('volume_to_roll', e.target.value)}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Maximum disponible : {volumeNonCouvert} tonnes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nouvelle_reference_cbot">Nouvelle référence CBOT *</Label>
                <Select value={formData.nouvelle_reference_cbot} onValueChange={(value) => handleInputChange('nouvelle_reference_cbot', value)}>
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
                <Label htmlFor="date_roll">Date effective du changement</Label>
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
                onClick={() => navigate('/navires')}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Changement en cours...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Changer la référence
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