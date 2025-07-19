import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Shield, TrendingUp, Calculator } from 'lucide-react';

interface Position {
  id: string;
  volume_achete: number;
  prime_payee: number;
  type_deal: 'prime' | 'flat';
  prix_flat: number | null;
  prix_reference: string | null;
  date_deal: string;
  couvertures: Array<{
    id: string;
    volume_couvert: number;
    prix_futures: number;
    date_couverture: string;
  }>;
  volume_non_couvert: number;
}

interface ReventeCreationDialogProps {
  open: boolean;
  onClose: () => void;
  position: Position | null;
  navireNom: string;
  produit: string;
}

export default function ReventeCreationDialog({
  open,
  onClose,
  position,
  navireNom,
  produit
}: ReventeCreationDialogProps) {
  const [volumeNonCouvert, setVolumeNonCouvert] = useState('');
  const [prixNonCouvert, setPrixNonCouvert] = useState('');
  const [volumeCouvert, setVolumeCouvert] = useState('');
  const [prixCouvert, setPrixCouvert] = useState('');
  const [venteNonCouverteActive, setVenteNonCouverteActive] = useState(false);
  const [venteCouverteActive, setVenteCouverteActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Calculs dérivés
  const volumeCouvertDisponible = position?.couvertures.reduce((sum, c) => sum + c.volume_couvert, 0) || 0;
  const volumeNonCouvertDisponible = position ? position.volume_achete - volumeCouvertDisponible : 0;
  const prixFuturesMoyen = position?.couvertures.length ? 
    position.couvertures.reduce((sum, c) => sum + c.prix_futures, 0) / position.couvertures.length : 0;

  // Facteur de conversion selon le produit (cts/bu -> $/tonne)
  const facteurConversion = produit === 'mais' ? 0.3937 
    : produit === 'tourteau_soja' ? 0.9072 
    : 1;

  // PRU pour position couverte
  const pruCouvert = position ? (position.prime_payee + prixFuturesMoyen) * facteurConversion : 0;
  
  // PRU pour position non couverte (prime seule)
  const pruNonCouvert = position ? position.prime_payee * facteurConversion : 0;

  useEffect(() => {
    if (!open) {
      // Reset form when closing
      setVolumeNonCouvert('');
      setPrixNonCouvert('');
      setVolumeCouvert('');
      setPrixCouvert('');
      setVenteNonCouverteActive(false);
      setVenteCouverteActive(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!position) return;

    const reventes = [];

    // Validation et préparation des reventes
    if (venteNonCouverteActive) {
      const vol = parseFloat(volumeNonCouvert);
      const prix = parseFloat(prixNonCouvert);
      
      if (!vol || !prix || vol <= 0 || prix <= 0) {
        toast({
          title: "Erreur",
          description: "Volume et prix de la position non couverte doivent être valides",
          variant: "destructive",
        });
        return;
      }

      if (vol > volumeNonCouvertDisponible) {
        toast({
          title: "Erreur",
          description: `Volume non couvert maximum: ${volumeNonCouvertDisponible} MT`,
          variant: "destructive",
        });
        return;
      }

      reventes.push({
        vente_id: position.id,
        volume: vol,
        prix_flat_demande: prix,
        type_position: 'non_couverte',
        etat: 'en_attente',
        date_revente: new Date().toISOString().split('T')[0],
        date_expiration_validation: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
    }

    if (venteCouverteActive) {
      const vol = parseFloat(volumeCouvert);
      const prix = parseFloat(prixCouvert);
      
      if (!vol || !prix || vol <= 0 || prix <= 0) {
        toast({
          title: "Erreur",
          description: "Volume et prix de la position couverte doivent être valides",
          variant: "destructive",
        });
        return;
      }

      if (vol > volumeCouvertDisponible) {
        toast({
          title: "Erreur",
          description: `Volume couvert maximum: ${volumeCouvertDisponible} MT`,
          variant: "destructive",
        });
        return;
      }

      reventes.push({
        vente_id: position.id,
        volume: vol,
        prix_flat_demande: prix,
        type_position: 'couverte',
        etat: 'en_attente',
        date_revente: new Date().toISOString().split('T')[0],
        date_expiration_validation: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
    }

    if (reventes.length === 0) {
      toast({
        title: "Erreur",
        description: "Sélectionnez au moins un type de position à vendre",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('reventes_clients')
        .insert(reventes);

      if (error) throw error;

      toast({
        title: "Succès",
        description: `${reventes.length} demande(s) de revente soumise(s) (validation admin dans 30 min max)`,
      });

      onClose();
    } catch (error) {
      console.error('Erreur lors de la création des reventes:', error);
      toast({
        title: "Erreur",
        description: "Impossible de soumettre vos demandes de revente",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!position) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mettre en vente - {navireNom}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Résumé de la position */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="h-4 w-4" />
                Résumé de votre position
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Volume total:</span>
                  <span className="ml-2 font-medium">{position.volume_achete} MT</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Prime payée:</span>
                  <span className="ml-2 font-medium">{position.prime_payee.toFixed(2)} cts/bu</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Volume couvert:</span>
                  <span className="ml-2 font-medium">{volumeCouvertDisponible} MT</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Volume non couvert:</span>
                  <span className="ml-2 font-medium">{volumeNonCouvertDisponible} MT</span>
                </div>
                {volumeCouvertDisponible > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Prix futures moyen:</span>
                    <span className="ml-2 font-medium">{prixFuturesMoyen.toFixed(2)} cts/bu</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Position Non Couverte */}
            {volumeNonCouvertDisponible > 0 && (
              <Card className={venteNonCouverteActive ? 'ring-2 ring-primary' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-4 w-4" />
                      Position Non Couverte
                    </CardTitle>
                    <Switch
                      checked={venteNonCouverteActive}
                      onCheckedChange={setVenteNonCouverteActive}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Badge variant="secondary">
                      📈 Exposition aux variations de prix
                    </Badge>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Disponible:</span>
                        <span className="font-medium">{volumeNonCouvertDisponible} MT</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">PRU estimé:</span>
                        <span className="font-medium">{pruNonCouvert.toFixed(2)} USD/MT</span>
                      </div>
                    </div>
                  </div>

                  {venteNonCouverteActive && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="volume-non-couvert">Volume à vendre (MT)</Label>
                        <Input
                          id="volume-non-couvert"
                          type="number"
                          step="0.01"
                          max={volumeNonCouvertDisponible}
                          value={volumeNonCouvert}
                          onChange={(e) => setVolumeNonCouvert(e.target.value)}
                          placeholder={`Max: ${volumeNonCouvertDisponible}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor="prix-non-couvert">Prix demandé (USD/MT)</Label>
                        <Input
                          id="prix-non-couvert"
                          type="number"
                          step="0.01"
                          value={prixNonCouvert}
                          onChange={(e) => setPrixNonCouvert(e.target.value)}
                          placeholder={`Suggestion: ${(pruNonCouvert * 1.02).toFixed(2)}`}
                        />
                        {prixNonCouvert && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Marge: {((parseFloat(prixNonCouvert) - pruNonCouvert) / pruNonCouvert * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Position Couverte */}
            {volumeCouvertDisponible > 0 && (
              <Card className={venteCouverteActive ? 'ring-2 ring-primary' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Shield className="h-4 w-4" />
                      Position Couverte
                    </CardTitle>
                    <Switch
                      checked={venteCouverteActive}
                      onCheckedChange={setVenteCouverteActive}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Badge variant="default">
                      🛡️ Protégée par les futures
                    </Badge>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Disponible:</span>
                        <span className="font-medium">{volumeCouvertDisponible} MT</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">PRU estimé:</span>
                        <span className="font-medium">{pruCouvert.toFixed(2)} USD/MT</span>
                      </div>
                    </div>
                  </div>

                  {venteCouverteActive && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="volume-couvert">Volume à vendre (MT)</Label>
                        <Input
                          id="volume-couvert"
                          type="number"
                          step="0.01"
                          max={volumeCouvertDisponible}
                          value={volumeCouvert}
                          onChange={(e) => setVolumeCouvert(e.target.value)}
                          placeholder={`Max: ${volumeCouvertDisponible}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor="prix-couvert">Prix demandé (USD/MT)</Label>
                        <Input
                          id="prix-couvert"
                          type="number"
                          step="0.01"
                          value={prixCouvert}
                          onChange={(e) => setPrixCouvert(e.target.value)}
                          placeholder={`Suggestion: ${(pruCouvert * 1.02).toFixed(2)}`}
                        />
                        {prixCouvert && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Marge: {((parseFloat(prixCouvert) - pruCouvert) / pruCouvert * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Annuler
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || (!venteNonCouverteActive && !venteCouverteActive)}
            >
              {submitting ? 'Soumission...' : 'Soumettre les demandes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}