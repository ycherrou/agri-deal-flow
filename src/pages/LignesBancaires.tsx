import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LigneBancaire } from "@/types";
import { Plus, Building2, DollarSign, Calendar } from "lucide-react";

export default function LignesBancaires() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nom: "",
    banque: "",
    montant_total: ""
  });

  // Fetch bank lines
  const { data: lignesBancaires = [], isLoading } = useQuery({
    queryKey: ['lignes-bancaires'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lignes_bancaires')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as LigneBancaire[];
    }
  });

  // Create bank line mutation
  const createLigneBancaire = useMutation({
    mutationFn: async (data: {
      nom: string;
      banque: string;
      montant_total: number;
    }) => {
      const { data: result, error } = await supabase
        .from('lignes_bancaires')
        .insert([{
          ...data,
          date_ouverture: new Date().toISOString().split('T')[0]
        }])
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Ligne bancaire créée",
        description: "La nouvelle ligne bancaire a été créée avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['lignes-bancaires'] });
      setIsDialogOpen(false);
      setFormData({
        nom: "",
        banque: "",
        montant_total: ""
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: `Erreur lors de la création: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('lignes_bancaires')
        .update({ active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Statut mis à jour",
        description: "Le statut de la ligne bancaire a été modifié.",
      });
      queryClient.invalidateQueries({ queryKey: ['lignes-bancaires'] });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: `Erreur lors de la mise à jour: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    if (!formData.nom || !formData.banque || !formData.montant_total) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs requis.",
        variant: "destructive"
      });
      return;
    }

    createLigneBancaire.mutate({
      nom: formData.nom,
      banque: formData.banque,
      montant_total: parseFloat(formData.montant_total)
    });
  };

  const totalLignes = lignesBancaires.reduce((sum, l) => sum + l.montant_total, 0);
  const totalUtilise = lignesBancaires.reduce((sum, l) => sum + l.montant_utilise, 0);
  const totalDisponible = lignesBancaires.reduce((sum, l) => sum + l.montant_disponible, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lignes Bancaires</h1>
          <p className="text-muted-foreground">
            Gestion des lignes de crédit et financement
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Ligne
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une nouvelle ligne bancaire</DialogTitle>
              <DialogDescription>
                Ajouter une nouvelle ligne de crédit pour le financement des ventes
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nom">Nom de la ligne *</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  placeholder="Ex: Ligne ABC 2024"
                />
              </div>
              <div>
                <Label htmlFor="banque">Banque *</Label>
                <Input
                  id="banque"
                  value={formData.banque}
                  onChange={(e) => setFormData({ ...formData, banque: e.target.value })}
                  placeholder="Ex: Banque ABC"
                />
              </div>
              <div>
                <Label htmlFor="montant_total">Montant total (USD) *</Label>
                <Input
                  id="montant_total"
                  type="number"
                  value={formData.montant_total}
                  onChange={(e) => setFormData({ ...formData, montant_total: e.target.value })}
                  placeholder="1000000"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSubmit}
                disabled={createLigneBancaire.isPending}
              >
                {createLigneBancaire.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Lignes</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLignes.toLocaleString()} USD</div>
            <p className="text-xs text-muted-foreground">
              {lignesBancaires.filter(l => l.active).length} lignes actives
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Montant Utilisé</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUtilise.toLocaleString()} USD</div>
            <p className="text-xs text-muted-foreground">
              {((totalUtilise / totalLignes) * 100).toFixed(1)}% d'utilisation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponible</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDisponible.toLocaleString()} USD</div>
            <p className="text-xs text-muted-foreground">
              Crédit disponible
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Lines Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lignes Bancaires</CardTitle>
          <CardDescription>Liste de toutes les lignes de crédit</CardDescription>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}