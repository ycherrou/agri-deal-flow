import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuration Yellowrock
const COMPANY_CONFIG = {
  name: "YELLOWROCK",
  logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjgwIiB2aWV3Qm94PSIwIDAgMTUwIDgwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZGVmcz4KPGV4cG9ydEl0ZW0gZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGlkPSJncmFkaWVudCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNGRjg4MDAiLz4KPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjRkY2NjAwIi8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSI4MCIgZmlsbD0idXJsKCNncmFkaWVudCkiLz4KPHRleHQgeD0iNzUiIHk9IjQ1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+WUVMTE9XUk9DSzwvdGV4dD4KPC9zdmc+",
  address: "Votre adresse",
  city: "Votre ville, Pays",
  phone: "Votre téléphone",
  email: "contact@yellowrock.com",
  siret: "Votre SIRET",
  brandColor: "#2C3E50",
  accentColor: "#FF6600"
};

// Template Yellowrock basé sur la facture uploadée
const getInvoiceTemplate = (invoiceData: any) => {
  const { facture, client, lignes, vente, navire } = invoiceData;
  
  // Calculs pour reproduire la structure Yellowrock
  const subtotal = lignes.reduce((acc: number, ligne: any) => acc + ligne.montant_ligne, 0);
  const fret = navire?.taux_fret || 0;
  const totalCFR = subtotal + fret;
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facture ${facture.numero_facture}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.3;
      color: #333;
      background: white;
    }
    
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 25mm 20mm;
      min-height: 297mm;
      position: relative;
    }
    
    /* Header minimaliste comme Yellowrock */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      padding-bottom: 15px;
    }
    
    .company-logo {
      max-width: 150px;
      max-height: 60px;
      object-fit: contain;
    }
    
    .invoice-title {
      text-align: right;
    }
    
    .invoice-title h1 {
      font-size: 24px;
      font-weight: bold;
      color: #2C3E50;
      margin-bottom: 8px;
    }
    
    .invoice-number {
      font-size: 14px;
      font-weight: normal;
      color: #666;
    }
    
    /* Section client uniquement à droite */
    .client-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 35px;
    }
    
    .client-info {
      width: 300px;
      padding: 15px;
      border: 1px solid #ddd;
      background: #fafafa;
    }
    
    .client-title {
      font-weight: bold;
      margin-bottom: 8px;
      color: #2C3E50;
    }
    
    /* Informations navire/produit en deux colonnes */
    .ship-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 35px;
      padding: 20px;
      background: #f9f9f9;
      border: 1px solid #eee;
    }
    
    .detail-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .detail-item {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
    }
    
    .detail-label {
      font-weight: bold;
      color: #2C3E50;
      min-width: 120px;
    }
    
    .detail-value {
      color: #666;
      text-align: right;
    }
    
    /* Table des marchandises */
    .goods-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
      border: 1px solid #ddd;
    }
    
    .goods-table th {
      background: #2C3E50;
      color: white;
      padding: 12px 8px;
      text-align: left;
      font-weight: bold;
      font-size: 10px;
      text-transform: uppercase;
    }
    
    .goods-table td {
      padding: 10px 8px;
      border-bottom: 1px solid #eee;
      font-size: 10px;
    }
    
    .goods-table .text-right {
      text-align: right;
    }
    
    .goods-table .text-center {
      text-align: center;
    }
    
    /* Calculs détaillés F.O.B/CFR */
    .calculations {
      width: 100%;
      margin-bottom: 30px;
    }
    
    .calc-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #ddd;
    }
    
    .calc-table th {
      background: #f5f5f5;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      border-bottom: 1px solid #ddd;
    }
    
    .calc-table td {
      padding: 8px;
      border-bottom: 1px solid #eee;
    }
    
    .calc-table .amount {
      text-align: right;
      font-weight: bold;
    }
    
    .total-cfr {
      background: #2C3E50;
      color: white;
    }
    
    /* Footer avec logo en filigrane et mentions légales */
    .footer {
      position: absolute;
      bottom: 20mm;
      left: 20mm;
      right: 20mm;
    }
    
    .watermark-logo {
      position: absolute;
      bottom: 100px;
      right: 50px;
      opacity: 0.1;
      max-width: 200px;
      z-index: -1;
    }
    
    .legal-box {
      border: 1px solid #ddd;
      padding: 15px;
      margin-top: 20px;
      background: #fafafa;
      font-size: 9px;
      line-height: 1.4;
    }
    
    .legal-title {
      font-weight: bold;
      margin-bottom: 8px;
      color: #2C3E50;
    }
    
    @media print {
      .invoice-container {
        margin: 0;
        padding: 15mm;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header minimaliste -->
    <div class="header">
      <img src="${COMPANY_CONFIG.logo}" alt="Yellowrock" class="company-logo" />
      <div class="invoice-title">
        <h1>FACTURE</h1>
        <div class="invoice-number">${facture.numero_facture}</div>
      </div>
    </div>

    <!-- Client section (uniquement à droite) -->
    <div class="client-section">
      <div class="client-info">
        <div class="client-title">FACTURER À:</div>
        <strong>${client.nom}</strong><br>
        ${client.email ? `${client.email}<br>` : ''}
        ${client.telephone ? `Tél: ${client.telephone}` : ''}
      </div>
    </div>

    <!-- Informations navire/produit (deux colonnes) -->
    <div class="ship-details">
      <div class="detail-group">
        <div class="detail-item">
          <span class="detail-label">Navire:</span>
          <span class="detail-value">${navire?.nom || 'N/A'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Port de chargement:</span>
          <span class="detail-value">${navire?.fournisseur || 'N/A'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Date:</span>
          <span class="detail-value">${new Date(facture.date_facture).toLocaleDateString('fr-FR')}</span>
        </div>
      </div>
      <div class="detail-group">
        <div class="detail-item">
          <span class="detail-label">Marchandises:</span>
          <span class="detail-value">${navire?.produit || 'N/A'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Port de déchargement:</span>
          <span class="detail-value">Port de destination</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Terme commercial:</span>
          <span class="detail-value">${navire?.terme_commercial || 'CFR'}</span>
        </div>
      </div>
    </div>

    <!-- Table des marchandises -->
    <table class="goods-table">
      <thead>
        <tr>
          <th>MARCHANDISES</th>
          <th class="text-center">QUANTITÉ</th>
          <th class="text-right">PRIX/PARITÉ</th>
          <th class="text-right">VALEUR</th>
        </tr>
      </thead>
      <tbody>
        ${lignes.map((ligne: any) => `
          <tr>
            <td>${ligne.description}</td>
            <td class="text-center">${ligne.quantite} MT</td>
            <td class="text-right">${ligne.prix_unitaire.toFixed(2)} ${facture.devise}/MT</td>
            <td class="text-right">${ligne.montant_ligne.toFixed(2)} ${facture.devise}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Calculs détaillés F.O.B/CFR -->
    <div class="calculations">
      <table class="calc-table">
        <tbody>
          <tr>
            <td><strong>Valeur F.O.B</strong></td>
            <td class="amount">${subtotal.toFixed(2)} ${facture.devise}</td>
          </tr>
          <tr>
            <td><strong>Fret</strong></td>
            <td class="amount">${fret.toFixed(2)} ${facture.devise}</td>
          </tr>
          <tr class="total-cfr">
            <td><strong>TOTAL CFR</strong></td>
            <td class="amount">${facture.montant_total.toFixed(2)} ${facture.devise}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Logo en filigrane -->
    <img src="${COMPANY_CONFIG.logo}" alt="Yellowrock Watermark" class="watermark-logo" />

    <!-- Footer avec mentions légales -->
    <div class="footer">
      <div class="legal-box">
        <div class="legal-title">CONDITIONS DE VENTE</div>
        ${facture.conditions_paiement || 'Paiement selon conditions convenues.'}<br><br>
        ${facture.notes || 'Merci pour votre confiance.'}<br><br>
        <strong>YELLOWROCK</strong> - ${COMPANY_CONFIG.address} - ${COMPANY_CONFIG.city}<br>
        Tél: ${COMPANY_CONFIG.phone} - Email: ${COMPANY_CONFIG.email} - SIRET: ${COMPANY_CONFIG.siret}
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