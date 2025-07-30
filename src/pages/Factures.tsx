import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, DollarSign, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const invoiceSchema = z.object({
  vente_id: z.string().uuid(),
  type_facture: z.enum(['proforma', 'commerciale', 'regularisation']),
  date_echeance: z.string().optional(),
  conditions_paiement: z.string().optional(),
  notes: z.string().optional()
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

export default function Factures() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedVente, setSelectedVente] = useState<any>(null);
  const [calculatedData, setCalculatedData] = useState<{
    pru: number;
    montantTotal: number;
    description: string;
  } | null>(null);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      type_facture: 'proforma'
    }
  });

  // Fetch invoices with client data
  const { data: factures, isLoading } = useQuery({
    queryKey: ['factures'],
    queryFn: async () => {
      const { data: facturesData, error: facturesError } = await supabase
        .from('factures')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (facturesError) throw facturesError;

      // Fetch client data separately
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, nom');

      if (clientsError) throw clientsError;

      // Combine the data
      const facturesWithClients = facturesData.map(facture => {
        const client = clientsData.find(c => c.id === facture.client_id);
        return {
          ...facture,
          client_nom: client?.nom || 'Client inconnu'
        };
      });

      return facturesWithClients;
    }
  });

  // Fetch sales for dropdown with detailed data
  const { data: ventes } = useQuery({
    queryKey: ['ventes_for_invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ventes')
        .select(`
          id,
          volume,
          date_deal,
          client_id,
          navire:navires(nom, produit),
          client:clients(nom)
        `)
        .order('date_deal', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Calculate PRU and other data when vente is selected
  const calculateInvoiceData = async (venteId: string) => {
    try {
      // Get PRU using the database function
      const { data: pruData, error: pruError } = await supabase
        .rpc('calculate_pru_vente', { vente_id_param: venteId });

      if (pruError) throw pruError;

      const vente = ventes?.find(v => v.id === venteId);
      if (!vente) return;

      const pru = pruData || 0;
      const montantTotal = pru * vente.volume;
      const description = `${vente.navire.produit.toUpperCase()} - ${vente.navire.nom} - ${vente.volume}T`;

      setCalculatedData({
        pru,
        montantTotal,
        description
      });

      setSelectedVente(vente);
    } catch (error) {
      console.error('Error calculating PRU:', error);
      toast({
        title: "Erreur",
        description: "Impossible de calculer le PRU pour cette vente",
        variant: "destructive"
      });
    }
  };

  // Watch for vente_id changes
  const watchedVenteId = form.watch('vente_id');
  useEffect(() => {
    if (watchedVenteId) {
      calculateInvoiceData(watchedVenteId);
    } else {
      setCalculatedData(null);
      setSelectedVente(null);
    }
  }, [watchedVenteId, ventes]);

  const createInvoice = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      if (!selectedVente || !calculatedData) {
        throw new Error('Données de calcul manquantes');
      }

      // Check for existing commercial invoice for this sale
      if (data.type_facture === 'commerciale') {
        const { data: existingCommerciale } = await supabase
          .from('factures')
          .select('id')
          .eq('vente_id', data.vente_id)
          .eq('type_facture', 'commerciale')
          .single();

        if (existingCommerciale) {
          throw new Error('Une facture commerciale existe déjà pour cette vente');
        }
      }

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('factures')
        .insert({
          numero_facture: '', // Auto-generated by trigger
          vente_id: data.vente_id,
          client_id: selectedVente.client_id,
          type_facture: data.type_facture,
          montant_total: calculatedData.montantTotal,
          date_echeance: data.date_echeance || null,
          conditions_paiement: data.conditions_paiement,
          notes: data.notes
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice line
      const { error: ligneError } = await supabase
        .from('lignes_facture')
        .insert({
          facture_id: invoice.id,
          description: calculatedData.description,
          quantite: selectedVente.volume,
          prix_unitaire: calculatedData.pru,
          montant_ligne: calculatedData.montantTotal
        });

      if (ligneError) throw ligneError;

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factures'] });
      setIsCreateDialogOpen(false);
      form.reset();
      setSelectedVente(null);
      setCalculatedData(null);
      toast({ title: "Facture créée avec succès" });
    },
    onError: (error) => {
      toast({
        title: "Erreur lors de la création",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: InvoiceFormData) => {
    createInvoice.mutate(data);
  };

  const getStatusBadge = (statut: string) => {
    const statusConfig = {
      brouillon: { label: "Brouillon", variant: "secondary" as const },
      envoyee: { label: "Envoyée", variant: "default" as const },
      payee: { label: "Payée", variant: "default" as const },
      annulee: { label: "Annulée", variant: "destructive" as const }
    };
    
    const config = statusConfig[statut as keyof typeof statusConfig];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const typeConfig = {
      proforma: { label: "Proforma", variant: "outline" as const },
      commerciale: { label: "Commerciale", variant: "default" as const },
      regularisation: { label: "Régularisation", variant: "secondary" as const }
    };
    
    const config = typeConfig[type as keyof typeof typeConfig];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const downloadInvoicePDF = async (factureId: string, numeroFacture: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
        body: { factureId }
      });

      if (error) throw error;

      // Create a new window with the HTML content for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data);
        printWindow.document.close();
        
        // Wait for content to load then trigger print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 100);
        };
      }

      toast({
        title: "PDF généré",
        description: "La facture s'ouvre dans une nouvelle fenêtre pour impression"
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF de la facture",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return <div className="p-6">Chargement...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Facturation</h1>
          <p className="text-muted-foreground">Génération automatique de factures depuis les ventes</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Générer Facture
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Générer une facture depuis une vente</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vente_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sélectionner une vente</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir une vente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ventes?.map((vente) => (
                              <SelectItem key={vente.id} value={vente.id}>
                                {vente.client.nom} - {vente.navire.nom} ({vente.volume}T)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type_facture"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de facture</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="proforma">Proforma</SelectItem>
                            <SelectItem value="commerciale">Commerciale</SelectItem>
                            <SelectItem value="regularisation">Régularisation</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Auto-filled data preview */}
                {selectedVente && calculatedData && (
                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <h3 className="font-semibold">Aperçu de la facture :</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Client :</span> {selectedVente.client.nom}
                      </div>
                      <div>
                        <span className="font-medium">Volume :</span> {selectedVente.volume} T
                      </div>
                      <div>
                        <span className="font-medium">PRU :</span> ${calculatedData.pru.toFixed(2)}/T
                      </div>
                      <div>
                        <span className="font-medium">Montant total :</span> ${calculatedData.montantTotal.toFixed(2)}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">Description :</span> {calculatedData.description}
                      </div>
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="date_echeance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date d'échéance</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="conditions_paiement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conditions de paiement</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Ex: Paiement à 30 jours" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Notes supplémentaires..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createInvoice.isPending || !calculatedData}
                  >
                    {createInvoice.isPending ? "Création..." : "Créer la facture"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Factures</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{factures?.length || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Factures Payées</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {factures?.filter(f => f.statut === 'payee').length || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Montant Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${factures?.reduce((sum, f) => sum + f.montant_total, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des factures</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factures?.map((facture) => (
                <TableRow key={facture.id}>
                  <TableCell className="font-medium">{facture.numero_facture}</TableCell>
                  <TableCell>{getTypeBadge(facture.type_facture)}</TableCell>
                  <TableCell>{facture.client_nom}</TableCell>
                  <TableCell>${facture.montant_total.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(facture.statut)}</TableCell>
                  <TableCell>{new Date(facture.date_facture).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => downloadInvoicePDF(facture.id, facture.numero_facture)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                      <Button variant="outline" size="sm">
                        Détails
                      </Button>
                    </div>
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