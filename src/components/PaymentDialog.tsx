import { useState } from "react";
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
import { ArrowLeft, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const paymentSchema = z.object({
  montant_paye: z.number().min(0.01, "Le montant doit être supérieur à 0"),
  date_paiement: z.string().min(1, "Date de paiement requise"),
  methode_paiement: z.string().min(1, "Méthode de paiement requise"),
  reference_paiement: z.string().optional(),
  notes: z.string().optional()
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: any | null;
}

export default function PaymentDialog({ open, onClose, invoice }: PaymentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      montant_paye: 0,
      date_paiement: new Date().toISOString().split('T')[0],
      methode_paiement: '',
      reference_paiement: '',
      notes: ''
    }
  });

  const createPayment = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      if (!invoice) throw new Error('Aucune facture sélectionnée');

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('paiements_factures')
        .insert({
          facture_id: invoice.id,
          montant_paye: data.montant_paye,
          date_paiement: data.date_paiement,
          methode_paiement: data.methode_paiement,
          reference_paiement: data.reference_paiement,
          notes: data.notes
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Process payment using the existing function to handle financing liberation
      // Only for commercial invoices (factures commerciales)
      if (invoice.type_facture === 'commerciale') {
        const { error: processError } = await supabase
          .rpc('traiter_paiement_facture', { 
            p_paiement_id: payment.id 
          });

        if (processError) throw processError;
      }

      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factures'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      onClose();
      form.reset();
      toast({ 
        title: "Paiement enregistré avec succès", 
        description: invoice.type_facture === 'commerciale' 
          ? "Le financement associé a été automatiquement libéré"
          : "Paiement enregistré"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur lors de l'enregistrement du paiement",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: PaymentFormData) => {
    createPayment.mutate(data);
  };

  if (!invoice) return null;

  // Calculate remaining amount to pay
  const montantRestant = invoice.montant_total; // TODO: subtract already paid amounts

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
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
            Enregistrer un paiement - {invoice.numero_facture}
          </DialogTitle>
        </DialogHeader>

        {/* Invoice Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Résumé de la facture
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Client :</span> {invoice.client_nom}
            </div>
            <div>
              <span className="font-medium">Montant total :</span> ${invoice.montant_total.toFixed(2)}
            </div>
            <div>
              <span className="font-medium">Statut actuel :</span> {invoice.statut}
            </div>
            <div>
              <span className="font-medium">Date facture :</span> {new Date(invoice.date_facture).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Payment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">💳 Détails du Paiement</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="montant_paye"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant payé *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder={`Max: $${montantRestant.toFixed(2)}`}
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
                  name="date_paiement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de paiement *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="methode_paiement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Méthode de paiement *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une méthode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="virement">Virement bancaire</SelectItem>
                          <SelectItem value="cheque">Chèque</SelectItem>
                          <SelectItem value="especes">Espèces</SelectItem>
                          <SelectItem value="carte">Carte bancaire</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reference_paiement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Référence de paiement</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="N° transaction, chèque, etc." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Notes additionnelles sur le paiement..." />
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
                disabled={createPayment.isPending}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                {createPayment.isPending ? "Enregistrement..." : "Enregistrer le paiement"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}