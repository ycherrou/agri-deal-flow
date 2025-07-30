import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, Send } from "lucide-react";

const invoiceEditSchema = z.object({
  // Client data
  client_nom: z.string().min(1, "Nom du client requis"),
  client_adresse: z.string().optional(),
  client_ville: z.string().optional(),
  client_telephone: z.string().optional(),
  client_email: z.string().email().optional().or(z.literal('')),
  
  // Invoice data
  type_facture: z.enum(['proforma', 'commerciale', 'regularisation']),
  date_echeance: z.string().optional(),
  devise: z.string().default('USD'),
  taux_change: z.number().default(1),
  
  // Line item
  description: z.string().min(1, "Description requise"),
  quantite: z.number().min(0.01, "Quantité doit être positive"),
  prix_unitaire: z.number().min(0, "Prix unitaire doit être positif"),
  
  // Terms
  conditions_paiement: z.string().optional(),
  notes: z.string().optional()
});

type InvoiceEditFormData = z.infer<typeof invoiceEditSchema>;

interface InvoiceEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: InvoiceEditFormData, status: 'brouillon' | 'envoyee') => void;
  initialData: {
    selectedVente: any;
    calculatedData: {
      pru: number;
      montantTotal: number;
      description: string;
    };
    formData: {
      type_facture: string;
      date_echeance?: string;
      conditions_paiement?: string;
      notes?: string;
    };
  } | null;
  isLoading: boolean;
}

export default function InvoiceEditDialog({ 
  open, 
  onClose, 
  onSave, 
  initialData,
  isLoading 
}: InvoiceEditDialogProps) {
  const [montantCalcule, setMontantCalcule] = useState(0);

  const form = useForm<InvoiceEditFormData>({
    resolver: zodResolver(invoiceEditSchema),
    defaultValues: {
      client_nom: '',
      client_adresse: '',
      client_ville: '',
      client_telephone: '',
      client_email: '',
      type_facture: 'proforma',
      devise: 'USD',
      taux_change: 1,
      description: '',
      quantite: 0,
      prix_unitaire: 0,
      conditions_paiement: '',
      notes: ''
    }
  });

  // Watch price and quantity changes to recalculate total
  const watchedQuantite = form.watch('quantite');
  const watchedPrixUnitaire = form.watch('prix_unitaire');

  useEffect(() => {
    if (watchedQuantite && watchedPrixUnitaire) {
      setMontantCalcule(watchedQuantite * watchedPrixUnitaire);
    } else {
      setMontantCalcule(0);
    }
  }, [watchedQuantite, watchedPrixUnitaire]);

  // Populate form when dialog opens with initial data
  useEffect(() => {
    if (open && initialData) {
      const { selectedVente, calculatedData, formData } = initialData;
      
      form.reset({
        // Client data from selected vente
        client_nom: selectedVente.client.nom || '',
        client_adresse: '',
        client_ville: '',
        client_telephone: '',
        client_email: '',
        
        // Invoice data
        type_facture: formData.type_facture as any,
        date_echeance: formData.date_echeance || '',
        devise: 'USD',
        taux_change: 1,
        
        // Line item from calculated data
        description: calculatedData.description,
        quantite: selectedVente.volume,
        prix_unitaire: calculatedData.pru,
        
        // Terms
        conditions_paiement: formData.conditions_paiement || '',
        notes: formData.notes || ''
      });
    }
  }, [open, initialData, form]);

  const handleSave = (status: 'brouillon' | 'envoyee') => {
    const formData = form.getValues();
    onSave(formData, status);
  };

  if (!initialData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="w-auto h-auto p-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            Édition de la facture
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <div className="space-y-6">
            {/* Client Information Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📋 Informations Client</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_nom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du client *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_adresse"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Adresse</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_ville"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_telephone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Invoice Details Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📄 Détails Facture</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="type_facture"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de facture</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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

                <FormField
                  control={form.control}
                  name="devise"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Devise</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="MAD">MAD</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </CardContent>
            </Card>

            {/* Product Line Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📦 Ligne de Produit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="quantite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantité (T) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="prix_unitaire"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prix unitaire ($/T) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Montant total</label>
                    <div className="h-10 px-3 py-2 border border-input bg-muted rounded-md flex items-center text-sm font-medium">
                      ${montantCalcule.toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Terms Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">💰 Conditions Financières</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
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
                      <FormLabel>Notes supplémentaires</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Notes additionnelles..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Separator />

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleSave('brouillon')}
                disabled={isLoading}
              >
                <Save className="mr-2 h-4 w-4" />
                Sauvegarder en brouillon
              </Button>
              
              <Button 
                type="button"
                onClick={() => handleSave('envoyee')}
                disabled={isLoading}
              >
                <Send className="mr-2 h-4 w-4" />
                {isLoading ? "Création..." : "Créer et finaliser"}
              </Button>
            </div>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}