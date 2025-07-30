import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const invoiceEditSchema = z.object({
  numero_facture: z.string().min(1, "Numéro de facture requis"),
  type_facture: z.enum(['proforma', 'commerciale', 'regularisation']),
  date_facture: z.string().min(1, "Date de facture requise"),
  date_echeance: z.string().optional(),
  devise: z.string().default('USD'),
  taux_change: z.number().default(1),
  montant_total: z.number().min(0, "Montant total doit être positif"),
  conditions_paiement: z.string().optional(),
  notes: z.string().optional(),
  statut: z.enum(['brouillon', 'envoyee', 'payee', 'annulee'])
});

type InvoiceEditFormData = z.infer<typeof invoiceEditSchema>;

interface EditInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: any | null;
}

export default function EditInvoiceDialog({ open, onClose, invoice }: EditInvoiceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InvoiceEditFormData>({
    resolver: zodResolver(invoiceEditSchema),
    defaultValues: {
      numero_facture: '',
      type_facture: 'proforma',
      date_facture: '',
      date_echeance: '',
      devise: 'USD',
      taux_change: 1,
      montant_total: 0,
      conditions_paiement: '',
      notes: '',
      statut: 'brouillon'
    }
  });

  // Populate form when dialog opens with invoice data
  useEffect(() => {
    if (open && invoice) {
      form.reset({
        numero_facture: invoice.numero_facture || '',
        type_facture: invoice.type_facture,
        date_facture: invoice.date_facture || '',
        date_echeance: invoice.date_echeance || '',
        devise: invoice.devise || 'USD',
        taux_change: invoice.taux_change || 1,
        montant_total: invoice.montant_total || 0,
        conditions_paiement: invoice.conditions_paiement || '',
        notes: invoice.notes || '',
        statut: invoice.statut || 'brouillon'
      });
    }
  }, [open, invoice, form]);

  const updateInvoice = useMutation({
    mutationFn: async (data: InvoiceEditFormData) => {
      if (!invoice) throw new Error('Aucune facture sélectionnée');

      const { error } = await supabase
        .from('factures')
        .update({
          numero_facture: data.numero_facture,
          type_facture: data.type_facture,
          date_facture: data.date_facture,
          date_echeance: data.date_echeance || null,
          devise: data.devise,
          taux_change: data.taux_change,
          montant_total: data.montant_total,
          conditions_paiement: data.conditions_paiement,
          notes: data.notes,
          statut: data.statut
        })
        .eq('id', invoice.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factures'] });
      onClose();
      toast({ title: "Facture mise à jour avec succès" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur lors de la mise à jour",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: InvoiceEditFormData) => {
    updateInvoice.mutate(data);
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
            Édition de la facture {invoice.numero_facture}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Invoice Details Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📄 Informations Facture</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="numero_facture"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro de facture *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
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
                  name="date_facture"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de facture *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
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
                  name="taux_change"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taux de change</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="montant_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant total *</FormLabel>
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
                  name="statut"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statut</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="brouillon">Brouillon</SelectItem>
                          <SelectItem value="envoyee">Envoyée</SelectItem>
                          <SelectItem value="payee">Payée</SelectItem>
                          <SelectItem value="annulee">Annulée</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Terms Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">💰 Conditions & Notes</CardTitle>
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
                onClick={onClose}
              >
                Annuler
              </Button>
              
              <Button 
                type="submit"
                disabled={updateInvoice.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {updateInvoice.isPending ? "Mise à jour..." : "Sauvegarder"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}