import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trash2, Edit, Plus, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { Echeance, PrixMarche } from '@/types';
import { CBOTPriceUpdater } from '@/components/CBOTPriceUpdater';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function PrixMarchePage() {
  const { toast } = useToast();
  
  // État pour les échéances
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [editingEcheance, setEditingEcheance] = useState<Echeance | null>(null);
  const [formEcheance, setFormEcheance] = useState({
    nom: '',
    produit: '',
    date_echeance: undefined as Date | undefined,
    active: true
  });
  
  // État pour les prix
  const [prixMarche, setPrixMarche] = useState<PrixMarche[]>([]);
  const [editingPrix, setEditingPrix] = useState<PrixMarche | null>(null);
  const [formPrix, setFormPrix] = useState({
    echeance_id: '',
    prix: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [echeanceDialogOpen, setEcheanceDialogOpen] = useState(false);
  const [prixDialogOpen, setPrixDialogOpen] = useState(false);

  // Récupération des données
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchEcheances(), fetchPrixMarche()]);
    } catch (error) {
      console.error('Erreur lors de la récupération des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEcheances = async () => {
    const { data, error } = await supabase
      .from('echeances')
      .select('*')
      .order('nom');
    
    if (error) {
      console.error('Erreur lors de la récupération des échéances:', error);
      return;
    }
    
    setEcheances(data || []);
  };

  const fetchPrixMarche = async () => {
    const { data, error } = await supabase
      .from('prix_marche')
      .select(`
        *,
        echeance:echeances(*)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erreur lors de la récupération des prix:', error);
      return;
    }
    
    setPrixMarche(data || []);
  };

  // Gestion des échéances
  const handleAddEcheance = async () => {
    if (!formEcheance.nom.trim() || !formEcheance.produit || !formEcheance.date_echeance) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('echeances')
        .insert([{
          nom: formEcheance.nom.trim(),
          produit: formEcheance.produit as any,
          date_echeance: format(formEcheance.date_echeance, 'yyyy-MM-dd'),
          active: formEcheance.active
        }]);
      
      if (error) throw error;
      
      toast({
        title: "Succès",
        description: "Échéance créée avec succès",
      });
      
      setFormEcheance({
        nom: '',
        produit: '',
        date_echeance: undefined,
        active: true
      });
      setEcheanceDialogOpen(false);
      fetchEcheances();
    } catch (error) {
      console.error('Erreur lors de la création de l\'échéance:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la création de l'échéance",
        variant: "destructive",
      });
    }
  };

  const handleUpdateEcheance = async () => {
    if (!editingEcheance || !editingEcheance.nom.trim()) return;
    
    try {
      const { error } = await supabase
        .from('echeances')
        .update({ nom: editingEcheance.nom.trim() })
        .eq('id', editingEcheance.id);
      
      if (error) throw error;
      
      toast({
        title: "Succès",
        description: "Échéance modifiée avec succès",
      });
      
      setEditingEcheance(null);
      setDialogOpen(false);
      fetchEcheances();
    } catch (error) {
      console.error('Erreur lors de la modification de l\'échéance:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la modification de l'échéance",
        variant: "destructive",
      });
    }
  };

  const handleToggleEcheance = async (echeance: Echeance) => {
    try {
      const { error } = await supabase
        .from('echeances')
        .update({ active: !echeance.active })
        .eq('id', echeance.id);
      
      if (error) throw error;
      
      toast({
        title: "Succès",
        description: `Échéance ${echeance.active ? 'désactivée' : 'activée'} avec succès`,
      });
      
      fetchEcheances();
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du changement de statut",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEcheance = async (id: string) => {
    // Vérifier si l'échéance est utilisée
    const { data: prixExists } = await supabase
      .from('prix_marche')
      .select('id')
      .eq('echeance_id', id)
      .limit(1);
    
    if (prixExists && prixExists.length > 0) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer une échéance utilisée dans des prix",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('echeances')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Succès",
        description: "Échéance supprimée avec succès",
      });
      
      fetchEcheances();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression",
        variant: "destructive",
      });
    }
  };

  // Gestion des prix
  const handleSubmitPrix = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formPrix.echeance_id || !formPrix.prix) return;
    
    try {
      if (editingPrix) {
        const { error } = await supabase
          .from('prix_marche')
          .update({
            echeance_id: formPrix.echeance_id,
            prix: parseFloat(formPrix.prix)
          })
          .eq('id', editingPrix.id);
        
        if (error) throw error;
        
        toast({
          title: "Succès",
          description: "Prix modifié avec succès",
        });
      } else {
        const { error } = await supabase
          .from('prix_marche')
          .insert([{
            echeance_id: formPrix.echeance_id,
            prix: parseFloat(formPrix.prix)
          }]);
        
        if (error) throw error;
        
        toast({
          title: "Succès",
          description: "Prix ajouté avec succès",
        });
      }
      
      setFormPrix({ echeance_id: '', prix: '' });
      setEditingPrix(null);
      setPrixDialogOpen(false);
      fetchPrixMarche();
    } catch (error) {
      console.error('Erreur lors de la gestion du prix:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la gestion du prix",
        variant: "destructive",
      });
    }
  };

  const handleEditPrix = (prix: PrixMarche) => {
    setEditingPrix(prix);
    setFormPrix({
      echeance_id: prix.echeance_id,
      prix: prix.prix.toString()
    });
    setPrixDialogOpen(true);
  };

  const handleDeletePrix = async (id: string) => {
    try {
      const { error } = await supabase
        .from('prix_marche')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Succès",
        description: "Prix supprimé avec succès",
      });
      
      fetchPrixMarche();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const formatDateOnly = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const productLabels: Record<string, string> = {
    mais: 'Maïs',
    tourteau_soja: 'Tourteau de Soja',
    ble: 'Blé',
    orge: 'Orge',
    ddgs: 'DDGS',
    ferrailles: 'Ferrailles'
  };

  const echeancesActives = echeances.filter(e => e.active);

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Gestion des Prix de Marché</h1>
        <p className="text-muted-foreground">
          Gérez les échéances et leurs prix de marché
        </p>
      </div>

      <Tabs defaultValue="echeances" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="echeances">Échéances</TabsTrigger>
          <TabsTrigger value="prix">Prix de Marché</TabsTrigger>
        </TabsList>

        <TabsContent value="echeances" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Gestion des Échéances
              </CardTitle>
              <CardDescription>
                Ajoutez, modifiez ou désactivez les échéances disponibles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Dialog open={echeanceDialogOpen} onOpenChange={setEcheanceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nouvelle Échéance
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Ajouter une nouvelle échéance</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="nom">Nom de l'échéance *</Label>
                        <Input
                          id="nom"
                          placeholder="ex: ZCU25, ZMH26"
                          value={formEcheance.nom}
                          onChange={(e) => setFormEcheance(prev => ({ ...prev, nom: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="produit">Produit *</Label>
                        <Select
                          value={formEcheance.produit}
                          onValueChange={(value) => setFormEcheance(prev => ({ ...prev, produit: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez un produit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mais">Maïs</SelectItem>
                            <SelectItem value="tourteau_soja">Tourteau de Soja</SelectItem>
                            <SelectItem value="ble">Blé</SelectItem>
                            <SelectItem value="orge">Orge</SelectItem>
                            <SelectItem value="ddgs">DDGS</SelectItem>
                            <SelectItem value="ferrailles">Ferrailles</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="date_echeance">Date d'échéance *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !formEcheance.date_echeance && "text-muted-foreground"
                              )}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {formEcheance.date_echeance ? (
                                format(formEcheance.date_echeance, "PPP", { locale: fr })
                              ) : (
                                <span>Choisir une date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={formEcheance.date_echeance}
                              onSelect={(date) => setFormEcheance(prev => ({ ...prev, date_echeance: date }))}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="active"
                          checked={formEcheance.active}
                          onCheckedChange={(checked) => setFormEcheance(prev => ({ ...prev, active: checked }))}
                        />
                        <Label htmlFor="active">Active</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleAddEcheance}>
                          Créer
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setFormEcheance({
                            nom: '',
                            produit: '',
                            date_echeance: undefined,
                            active: true
                          });
                          setEcheanceDialogOpen(false);
                        }}>
                          Annuler
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Date d'échéance</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {echeances.map((echeance) => (
                    <TableRow key={echeance.id}>
                      <TableCell className="font-medium">{echeance.nom}</TableCell>
                      <TableCell>{productLabels[echeance.produit] || echeance.produit}</TableCell>
                      <TableCell>{formatDateOnly(echeance.date_echeance)}</TableCell>
                      <TableCell>
                        <Badge variant={echeance.active ? "default" : "secondary"}>
                          {echeance.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog open={dialogOpen && editingEcheance?.id === echeance.id} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingEcheance(echeance)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Modifier l'échéance</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="nom">Nom</Label>
                                  <Input
                                    id="nom"
                                    value={editingEcheance?.nom || ''}
                                    onChange={(e) => setEditingEcheance(prev => 
                                      prev ? { ...prev, nom: e.target.value } : null
                                    )}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button onClick={handleUpdateEcheance}>
                                    Enregistrer
                                  </Button>
                                  <Button variant="outline" onClick={() => {
                                    setEditingEcheance(null);
                                    setDialogOpen(false);
                                  }}>
                                    Annuler
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={echeance.active}
                              onCheckedChange={() => handleToggleEcheance(echeance)}
                            />
                          </div>
                          
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteEcheance(echeance.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prix" className="space-y-4">
          <CBOTPriceUpdater />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Gestion des Prix
              </CardTitle>
              <CardDescription>
                Gérez les prix de marché pour chaque échéance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Dialog open={prixDialogOpen} onOpenChange={setPrixDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter un prix
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingPrix ? 'Modifier le prix' : 'Ajouter un prix'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitPrix} className="space-y-4">
                      <div>
                        <Label htmlFor="echeance">Échéance</Label>
                        <Select
                          value={formPrix.echeance_id}
                          onValueChange={(value) => setFormPrix(prev => ({ ...prev, echeance_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez une échéance" />
                          </SelectTrigger>
                          <SelectContent>
                            {echeancesActives.map((echeance) => (
                              <SelectItem key={echeance.id} value={echeance.id}>
                                {echeance.nom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="prix">Prix (cents/bushel)</Label>
                        <Input
                          id="prix"
                          type="number"
                          step="0.01"
                          value={formPrix.prix}
                          onChange={(e) => setFormPrix(prev => ({ ...prev, prix: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit">
                          {editingPrix ? 'Modifier' : 'Ajouter'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => {
                          setFormPrix({ echeance_id: '', prix: '' });
                          setEditingPrix(null);
                          setPrixDialogOpen(false);
                        }}>
                          Annuler
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {echeancesActives.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>Aucune échéance active. Ajoutez d'abord des échéances dans l'onglet "Échéances".</p>
                </div>
              )}

              {echeancesActives.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Prix (cents/bushel)</TableHead>
                      <TableHead>Date de création</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prixMarche.map((prix) => (
                      <TableRow key={prix.id}>
                        <TableCell className="font-medium">
                          {prix.echeance?.nom || 'Échéance supprimée'}
                        </TableCell>
                        <TableCell>{formatPrice(prix.prix)}</TableCell>
                        <TableCell>{formatDate(prix.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditPrix(prix)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeletePrix(prix.id)}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}