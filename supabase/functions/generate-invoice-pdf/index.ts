import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuration de l'entreprise
const COMPANY_CONFIG = {
  name: "VOTRE ENTREPRISE",
  logo: "https://via.placeholder.com/150x80/0F172A/FFFFFF?text=LOGO", // Remplacez par l'URL de votre logo
  address: "123 Rue de l'Agriculture",
  city: "75001 Paris, France",
  phone: "+33 1 23 45 67 89",
  email: "contact@entreprise.com",
  siret: "123 456 789 00123",
  brandColor: "#0F172A", // Remplacez par votre couleur de marque
  accentColor: "#1E40AF"
};

// HTML template for invoice
const getInvoiceTemplate = (invoiceData: any) => {
  const { facture, client, lignes, vente, navire } = invoiceData;
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facture ${facture.numero_facture}</title>
  <style>
    :root {
      --brand-color: ${COMPANY_CONFIG.brandColor};
      --accent-color: ${COMPANY_CONFIG.accentColor};
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
      background: white;
    }
    
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
      min-height: 297mm;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      border-bottom: 3px solid var(--brand-color);
      padding-bottom: 20px;
    }
    
    .company-section {
      display: flex;
      align-items: flex-start;
      flex: 1;
      gap: 20px;
    }
    
    .company-logo {
      max-width: 120px;
      max-height: 80px;
      object-fit: contain;
    }
    
    .company-info {
      flex: 1;
    }
    
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: var(--brand-color);
      margin-bottom: 10px;
    }
    
    .company-details {
      font-size: 11px;
      color: #666;
      line-height: 1.5;
    }
    
    .invoice-title {
      text-align: right;
      flex: 1;
    }
    
    .invoice-title h1 {
      font-size: 28px;
      color: var(--brand-color);
      margin-bottom: 10px;
      font-weight: 700;
    }
    
    .invoice-number {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 5px;
      color: var(--accent-color);
    }
    
    .invoice-date {
      font-size: 12px;
      color: #666;
    }
    
    .client-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      gap: 20px;
    }
    
    .client-info, .invoice-details {
      flex: 1;
      padding: 20px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #fafafa;
    }
    
    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: var(--brand-color);
      margin-bottom: 15px;
      border-bottom: 2px solid var(--accent-color);
      padding-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .details-table th {
      background: linear-gradient(135deg, var(--brand-color), var(--accent-color));
      color: white;
      font-weight: bold;
      padding: 15px 12px;
      text-align: left;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .details-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      background: white;
    }
    
    .details-table tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    
    .details-table tbody tr:hover {
      background-color: #f1f5f9;
    }
    
    .amount-right {
      text-align: right;
      font-weight: bold;
      color: var(--brand-color);
    }
    
    .totals {
      width: 350px;
      margin-left: auto;
      margin-bottom: 30px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .total-row.final {
      font-size: 18px;
      font-weight: bold;
      background: linear-gradient(135deg, var(--brand-color), var(--accent-color));
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      margin-top: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .footer {
      margin-top: 50px;
      padding-top: 25px;
      border-top: 2px solid var(--brand-color);
      font-size: 11px;
      color: #666;
    }
    
    .payment-terms {
      margin-bottom: 20px;
      padding: 15px;
      background: #f8fafc;
      border-left: 4px solid var(--accent-color);
      border-radius: 4px;
    }
    
    .legal-mentions {
      font-size: 10px;
      text-align: center;
      color: #999;
      margin-top: 20px;
      padding: 10px;
      background: #f9fafb;
      border-radius: 6px;
    }
    
    @media print {
      .invoice-container {
        margin: 0;
        padding: 15mm;
      }
      
      .details-table {
        box-shadow: none;
      }
      
      .total-row.final {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div class="company-section">
        <img src="${COMPANY_CONFIG.logo}" alt="Logo ${COMPANY_CONFIG.name}" class="company-logo" />
        <div class="company-info">
          <div class="company-name">${COMPANY_CONFIG.name}</div>
          <div class="company-details">
            ${COMPANY_CONFIG.address}<br>
            ${COMPANY_CONFIG.city}<br>
            Tél: ${COMPANY_CONFIG.phone}<br>
            Email: ${COMPANY_CONFIG.email}<br>
            SIRET: ${COMPANY_CONFIG.siret}
          </div>
        </div>
      </div>
      <div class="invoice-title">
        <h1>${facture.type_facture === 'proforma' ? 'PROFORMA' : facture.type_facture === 'commerciale' ? 'FACTURE' : 'RÉGULARISATION'}</h1>
        <div class="invoice-number">${facture.numero_facture}</div>
        <div class="invoice-date">Date: ${new Date(facture.date_facture).toLocaleDateString('fr-FR')}</div>
        ${facture.date_echeance ? `<div class="invoice-date">Échéance: ${new Date(facture.date_echeance).toLocaleDateString('fr-FR')}</div>` : ''}
      </div>
    </div>

    <!-- Client and Invoice Details -->
    <div class="client-section">
      <div class="client-info">
        <div class="section-title">FACTURER À</div>
        <strong>${client.nom}</strong><br>
        ${client.email ? `Email: ${client.email}<br>` : ''}
        ${client.telephone ? `Tél: ${client.telephone}<br>` : ''}
      </div>
      <div class="invoice-details">
        <div class="section-title">DÉTAILS DE LA VENTE</div>
        ${vente ? `
          <strong>Navire:</strong> ${navire?.nom || 'N/A'}<br>
          <strong>Produit:</strong> ${navire?.produit || 'N/A'}<br>
          <strong>Type deal:</strong> ${vente.type_deal}<br>
          <strong>Date deal:</strong> ${new Date(vente.date_deal).toLocaleDateString('fr-FR')}<br>
        ` : 'Facture manuelle'}
      </div>
    </div>

    <!-- Invoice Lines -->
    <table class="details-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center;">Quantité</th>
          <th style="text-align: right;">Prix unitaire</th>
          <th style="text-align: right;">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${lignes.map((ligne: any) => `
          <tr>
            <td>${ligne.description}</td>
            <td style="text-align: center;">${ligne.quantite}</td>
            <td class="amount-right">${ligne.prix_unitaire.toFixed(2)} ${facture.devise}</td>
            <td class="amount-right">${ligne.montant_ligne.toFixed(2)} ${facture.devise}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="total-row final">
        <span>TOTAL À PAYER</span>
        <span>${facture.montant_total.toFixed(2)} ${facture.devise}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      ${facture.conditions_paiement ? `
        <div class="payment-terms">
          <strong>Conditions de paiement:</strong> ${facture.conditions_paiement}
        </div>
      ` : ''}
      
      ${facture.notes ? `
        <div class="payment-terms">
          <strong>Notes:</strong> ${facture.notes}
        </div>
      ` : ''}
      
      <div class="legal-mentions">
        Merci pour votre confiance. Cette facture est payable selon les conditions mentionnées ci-dessus.
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { factureId } = await req.json();

    if (!factureId) {
      throw new Error('ID de facture requis');
    }

    // Fetch invoice data with related information
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .select(`
        *,
        vente:ventes(
          *,
          client:clients(*),
          navire:navires(*)
        )
      `)
      .eq('id', factureId)
      .single();

    if (factureError) throw factureError;

    // Fetch invoice lines
    const { data: lignes, error: lignesError } = await supabase
      .from('lignes_facture')
      .select('*')
      .eq('facture_id', factureId)
      .order('created_at');

    if (lignesError) throw lignesError;

    const invoiceData = {
      facture,
      client: facture.vente?.client,
      vente: facture.vente,
      navire: facture.vente?.navire,
      lignes: lignes || []
    };

    const htmlContent = getInvoiceTemplate(invoiceData);

    // For now, return HTML content that can be converted to PDF on the client side
    // In a full implementation, you would use Puppeteer or similar to generate actual PDF
    return new Response(JSON.stringify({ 
      html: htmlContent,
      filename: `Facture_${facture.numero_facture}.pdf`
    }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    });

  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    });
  }
});