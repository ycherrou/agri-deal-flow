import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { LigneBancaire, VenteFinancingData, Financement } from "@/types";
import { calculatePRU } from "@/lib/pnlUtils";
import { Banknote, CreditCard, DollarSign, TrendingUp, AlertCircle } from "lucide-react";

export default function Finance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVente, setSelectedVente] = useState<VenteFinancingData | null>(null);
  const [selectedLigne, setSelectedLigne] = useState<string>("");
  const [montantFinancement, setMontantFinancement] = useState<string>("");
  const [commentaire, setCommentaire] = useState<string>("");

  // Fetch bank lines
  const { data: lignesBancaires = [] } = useQuery({
    queryKey: ['lignes-bancaires'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lignes_bancaires')
        .select('*')
        .eq('active', true)
        .order('nom');
      
      if (error) throw error;
      return data as LigneBancaire[];
    }
  });

  // Fetch sales with financing needs
  const { data: ventesFinancing = [], isLoading } = useQuery({
    queryKey: ['ventes-financing'],
    queryFn: async () => {
      const { data: ventes, error } = await supabase
        .from('ventes')
        .select(`
          *,
          navire:navires(*),
          client:clients(*),
          couvertures(*),
          financements(*)
        `)
        .order('date_deal', { ascending: false });
      
      if (error) throw error;

      const ventesWithFinancing: VenteFinancingData[] = await Promise.all(
        ventes.map(async (vente) => {
          const pru = calculatePRU(vente);
          const montantBesoinFinancement = pru * vente.volume;
          const financement = vente.financements?.[0] as Financement | undefined;
          
          return {
            ...vente,
            navire: {
              ...vente.navire,
              terme_commercial: vente.navire.terme_commercial as 'FOB' | 'CFR'
            },
            client: vente.client,
            couvertures: vente.couvertures || [],
            reventes: [],
            volumeCouvert: vente.couvertures?.reduce((sum: number, c: any) => sum + c.volume_couvert, 0) || 0,
            volumeNonCouvert: vente.volume - (vente.couvertures?.reduce((sum: number, c: any) => sum + c.volume_couvert, 0) || 0),
            pru,
            financement,
            montant_besoin_financement: montantBesoinFinancement,
            pru_actuel: pru
          } as VenteFinancingData;
        })
      );

      return ventesWithFinancing;
    }
  });

  // Allocate financing mutation
  const allocateFinancing = useMutation({
    mutationFn: async ({ venteId, ligneBancaireId, montant, commentaire }: {
      venteId: string;
      ligneBancaireId: string;
      montant: number;
      commentaire?: string;
    }) => {
      const { data, error } = await supabase.rpc('allouer_financement', {
        vente_id_param: venteId,
        ligne_bancaire_id_param: ligneBancaireId,
        montant_param: montant,
        commentaire_param: commentaire
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Financement alloué",
        description: "Le financement a été alloué avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['ventes-financing'] });
      queryClient.invalidateQueries({ queryKey: ['lignes-bancaires'] });
      setSelectedVente(null);
      setSelectedLigne("");
      setMontantFinancement("");
      setCommentaire("");
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: `Erreur lors de l'allocation: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleAllocateFinancing = () => {
    if (!selectedVente || !selectedLigne || !montantFinancement) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs requis.",
        variant: "destructive"
      });
      return;
    }

    allocateFinancing.mutate({
      venteId: selectedVente.id,
      ligneBancaireId: selectedLigne,
      montant: parseFloat(montantFinancement),
      commentaire
    });
  };

  // Calculate totals
  const totalFinancementNeeded = ventesFinancing
    .filter(v => !v.financement)
    .reduce((sum, v) => sum + v.montant_besoin_financement, 0);
  
  const totalFinancementAllocated = ventesFinancing
    .filter(v => v.financement)
    .reduce((sum, v) => sum + (v.financement?.montant_finance || 0), 0);

  const totalLignesDisponibles = lignesBancaires.reduce((sum, l) => sum + l.montant_disponible, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground">
            Gestion des financements et lignes bancaires
          </p>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Financement Requis</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFinancementNeeded.toLocaleString()} USD</div>
            <p className="text-xs text-muted-foreground">
              {ventesFinancing.filter(v => !v.financement).length} ventes non financées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Financement Alloué</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFinancementAllocated.toLocaleString()} USD</div>
            <p className="text-xs text-muted-foreground">
              {ventesFinancing.filter(v => v.financement).length} ventes financées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lignes Disponibles</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLignesDisponibles.toLocaleString()} USD</div>
            <p className="text-xs text-muted-foreground">
              {lignesBancaires.length} lignes actives
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux d'Utilisation</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((totalFinancementAllocated / (totalFinancementAllocated + totalLignesDisponibles)) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Utilisation globale
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Lines Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Lignes Bancaires</CardTitle>
          <CardDescription>Vue d'ensemble des lignes de crédit disponibles</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Banque</TableHead>
                <TableHead>Montant Total</TableHead>
                <TableHead>Utilisé</TableHead>
                <TableHead>Disponible</TableHead>
                <TableHead>Taux</TableHead>
                <TableHead>Échéance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignesBancaires.map((ligne) => (
                <TableRow key={ligne.id}>
                  <TableCell className="font-medium">{ligne.nom}</TableCell>
                  <TableCell>{ligne.banque}</TableCell>
                  <TableCell>{ligne.montant_total.toLocaleString()} USD</TableCell>
                  <TableCell>{ligne.montant_utilise.toLocaleString()} USD</TableCell>
                  <TableCell>
                    <span className={ligne.montant_disponible < 100000 ? "text-orange-600" : "text-green-600"}>
                      {ligne.montant_disponible.toLocaleString()} USD
                    </span>
                  </TableCell>
                  <TableCell>{ligne.taux_interet ? `${ligne.taux_interet}%` : '-'}</TableCell>
                  <TableCell>{ligne.date_echeance || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sales Financing Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ventes et Financements</CardTitle>
          <CardDescription>État des financements par vente</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navire</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>PRU</TableHead>
                <TableHead>Besoin Financement</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ventesFinancing.map((vente) => (
                <TableRow key={vente.id}>
                  <TableCell className="font-medium">{vente.navire.nom}</TableCell>
                  <TableCell>{vente.client.nom}</TableCell>
                  <TableCell>{vente.volume.toLocaleString()} MT</TableCell>
                  <TableCell>{vente.pru_actuel.toFixed(2)} USD/MT</TableCell>
                  <TableCell>{vente.montant_besoin_financement.toLocaleString()} USD</TableCell>
                  <TableCell>
                    {vente.financement ? (
                      <Badge variant="secondary">
                        Financé ({vente.financement.montant_finance.toLocaleString()} USD)
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Non financé</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!vente.financement && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            onClick={() => {
                              setSelectedVente(vente);
                              setMontantFinancement(vente.montant_besoin_financement.toString());
                            }}
                          >
                            Financer
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Allouer Financement</DialogTitle>
                            <DialogDescription>
                              Financement pour {vente.navire.nom} - {vente.client.nom}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="ligne">Ligne Bancaire</Label>
                              <Select value={selectedLigne} onValueChange={setSelectedLigne}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner une ligne" />
                                </SelectTrigger>
                                <SelectContent>
                                  {lignesBancaires
                                    .filter(l => l.montant_disponible >= parseFloat(montantFinancement))
                                    .map(ligne => (
                                    <SelectItem key={ligne.id} value={ligne.id}>
                                      {ligne.nom} - {ligne.montant_disponible.toLocaleString()} USD disponible
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="montant">Montant (USD)</Label>
                              <Input
                                id="montant"
                                type="number"
                                value={montantFinancement}
                                onChange={(e) => setMontantFinancement(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="commentaire">Commentaire (optionnel)</Label>
                              <Textarea
                                id="commentaire"
                                value={commentaire}
                                onChange={(e) => setCommentaire(e.target.value)}
                                placeholder="Commentaire sur le financement..."
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={handleAllocateFinancing}
                              disabled={allocateFinancing.isPending}
                            >
                              {allocateFinancing.isPending ? "Allocation..." : "Allouer"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}