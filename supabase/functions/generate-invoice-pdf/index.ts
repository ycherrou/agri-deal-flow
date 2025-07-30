import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuration Yellowrock basée sur la vraie facture
const COMPANY_CONFIG = {
  name: "Yellowrock S.A.",
  tagline: "Global Grain Solutions",
  logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InllbGxvd3JvY2tHcmFkaWVudCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNGRkQ3MDAiLz4KPHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiNGRjk5MDAiLz4KPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjRkY2NjAwIi8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPCEtLSBMb2dvIGJhY2tncm91bmQgLS0+CjxyZWN0IHdpZHRoPSI0MCIgaGVpZ2h0PSI2MCIgeD0iMTAiIHk9IjIwIiBmaWxsPSJ1cmwoI3llbGxvd3JvY2tHcmFkaWVudCkiIHJ4PSI4Ii8+Cjx0ZXh0IHg9IjYwIiB5PSI0NSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSIjMzMzIj5ZZWxsb3c8L3RleHQ+Cjx0ZXh0IHg9IjEzNSIgeT0iNDUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzMzMyI+cm9jazwvdGV4dD4KPHRleHQgeD0iNjAiIHk9IjY1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM2NjYiPkdsb2JhbCBHcmFpbiBTb2x1dGlvbnM8L3RleHQ+Cjwvc3ZnPg==",
  address: "Rue Ferdinand-Hodler 23",
  city: "CH-1207 Geneva",
  country: "Switzerland",
  phone: "+41 22 310 69 30",
  fax: "+41 22 310 69 31",
  bank: {
    beneficiary: "Yellowrock SA",
    name: "Banque Internationale de Commerce-(BRED) Suisse SA",
    iban: "CH67 0853 7603 0842 0040 1",
    swift: "BICFCHGG"
  }
};

// Fonctions utilitaires pour les valeurs par défaut
const getDefaultValue = (value: any, defaultValue: string = 'N/A'): string => {
  return value && value.toString().trim() !== '' ? value.toString() : defaultValue;
};

const formatAmount = (amount: number, currency: string = 'USD'): string => {
  return `${amount.toLocaleString('fr-FR', {minimumFractionDigits: 2})} ${currency}`;
};

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('fr-FR');
  } catch {
    return new Date().toLocaleDateString('fr-FR');
  }
};

// Template HTML optimisé reproduisant exactement la facture Yellowrock
const getInvoiceTemplate = (invoiceData: any) => {
  const { facture, client, lignes, vente, navire } = invoiceData;
  
  // Calculs exacts comme sur la vraie facture avec valeurs par défaut
  const quantite = lignes.reduce((acc: number, ligne: any) => acc + (ligne.quantite || 0), 0);
  const prixUnitaire = lignes.length > 0 ? (lignes[0].prix_unitaire || 0) : 0;
  const valeurFOB = quantite * prixUnitaire;
  const fret = navire?.taux_fret || (quantite * 30); // 30 EUR/TM par défaut
  const totalCFR = valeurFOB + fret;
  
  // Génération automatique de référence si manquante
  const reference = facture.reference || `YRG ${new Date().getFullYear().toString().substr(-2)}/${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
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
      line-height: 1.4;
      color: #333;
      background: white;
    }
    
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
      min-height: 297mm;
      position: relative;
    }
    
    /* Header avec logo */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
    }
    
    .company-section {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    
    .company-logo {
      max-width: 200px;
      max-height: 100px;
      margin-bottom: 20px;
    }
    
    .invoice-info {
      text-align: left;
    }
    
    .invoice-title {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .invoice-ref {
      font-size: 11px;
      margin-bottom: 20px;
    }
    
    .invoice-date {
      font-size: 11px;
      margin-bottom: 30px;
    }
    
    /* Client section */
    .client-section {
      text-align: right;
      margin-bottom: 40px;
    }
    
    .client-info {
      display: inline-block;
      text-align: left;
      font-size: 11px;
      line-height: 1.5;
    }
    
    .client-name {
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 5px;
    }
    
    /* Détails transport et marchandises */
    .details-section {
      margin-bottom: 30px;
    }
    
    .detail-row {
      display: flex;
      margin-bottom: 8px;
      align-items: baseline;
    }
    
    .detail-label {
      font-weight: bold;
      min-width: 180px;
      flex-shrink: 0;
    }
    
    .detail-value {
      flex: 1;
    }
    
    /* Section calculs */
    .calculations {
      margin: 40px 0;
      border-top: 1px solid #ccc;
      padding-top: 20px;
    }
    
    .calc-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      align-items: baseline;
    }
    
    .calc-label {
      font-weight: bold;
      min-width: 200px;
    }
    
    .calc-value {
      text-align: right;
      font-weight: bold;
    }
    
    .total-row {
      border-top: 1px solid #333;
      margin-top: 15px;
      padding-top: 10px;
      font-size: 12px;
      font-weight: bold;
    }
    
    /* Conditions de paiement */
    .payment-section {
      margin: 40px 0;
      padding: 15px 0;
      border-top: 1px solid #ccc;
    }
    
    .payment-title {
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .bank-details {
      margin-top: 20px;
    }
    
    .bank-title {
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .bank-info {
      line-height: 1.6;
    }
    
    /* Footer */
    .footer {
      position: absolute;
      bottom: 20mm;
      left: 20mm;
      right: 20mm;
      text-align: center;
      border-top: 1px solid #ccc;
      padding-top: 15px;
    }
    
    .footer-logo {
      max-width: 150px;
      margin-bottom: 10px;
    }
    
    .footer-info {
      font-size: 10px;
      line-height: 1.5;
      color: #666;
    }
    
    /* CSS Print optimisé */
    @media print {
      .invoice-container {
        margin: 0;
        padding: 15mm;
        min-height: auto;
      }
      
      .footer {
        position: fixed;
        bottom: 15mm;
      }
      
      /* Éviter les coupures de page */
      .details-section,
      .calculations,
      .payment-section {
        page-break-inside: avoid;
      }
      
      /* Forcer une nouvelle page si nécessaire */
      .page-break {
        page-break-before: always;
      }
    }
    
    /* Styles pour données manquantes */
    .missing-data {
      color: #999;
      font-style: italic;
    }
    
    .highlight-missing {
      background-color: #fff3cd;
      padding: 2px 4px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div class="company-section">
        <img src="${COMPANY_CONFIG.logo}" alt="Yellowrock" class="company-logo" />
        
        <div class="invoice-info">
          <div class="invoice-title">Facture Commerciale N° : ${facture.numero_facture}</div>
          <div class="invoice-ref">Notre Ref : ${reference}</div>
          
          <div class="invoice-date">${COMPANY_CONFIG.city.split('-')[1]}, le ${formatDate(facture.date_facture)}</div>
        </div>
      </div>
    </div>

    <!-- Client -->
    <div class="client-section">
      <div class="client-info">
        <div class="client-name">${getDefaultValue(client?.nom, 'Client non spécifié').toUpperCase()}</div>
        ${client?.adresse ? `${client.adresse}<br>` : '<span class="missing-data">Adresse non renseignée</span><br>'}
        ${client?.ville ? `${client.ville}<br>` : ''}
        ${client?.code_postal ? `${client.code_postal} ` : ''}${getDefaultValue(client?.pays, 'Maroc')}
      </div>
    </div>

    <!-- Détails transport -->
    <div class="details-section">
      <div class="detail-row">
        <span class="detail-label">Navire</span>
        <span class="detail-value">: ${getDefaultValue(navire?.nom, 'M/V Non spécifié')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Port de chargement</span>
        <span class="detail-value">: ${getDefaultValue(navire?.port_chargement, 'Port de chargement')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Connaissement N°</span>
        <span class="detail-value">: ${getDefaultValue(navire?.connaissement, '1')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date de connaissement</span>
        <span class="detail-value">: ${navire?.date_connaissement ? formatDate(navire.date_connaissement) : formatDate(facture.date_facture)}</span>
      </div>
    </div>

    <!-- Marchandises -->
    <div class="details-section">
      <div class="detail-row">
        <span class="detail-label">Marchandises</span>
        <span class="detail-value">: ${lignes[0]?.description || getDefaultValue(navire?.produit, 'Marchandises')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Origine</span>
        <span class="detail-value">: ${getDefaultValue(navire?.origine, 'Origine non spécifiée')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Port de déchargement</span>
        <span class="detail-value">: ${getDefaultValue(navire?.port_dechargement, 'Port de destination')}</span>
      </div>
    </div>

    <!-- Calculs -->
    <div class="calculations">
      <div class="calc-row">
        <span class="calc-label">Quantité</span>
        <span class="calc-value">: ${quantite.toLocaleString('fr-FR', {minimumFractionDigits: 3})} TM</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">Prix/Parité</span>
        <span class="calc-value">: ${facture.devise} ${prixUnitaire.toFixed(2)} / Tonne métrique</span>
      </div>
      
      <div style="margin: 20px 0;">
        <div class="calc-row">
          <span class="calc-label">Valeur F.O.B.</span>
          <span class="calc-value">: ${facture.devise} ${(valeurFOB/quantite).toFixed(2)} / TM = <span style="margin-left: 20px;">${formatAmount(valeurFOB, facture.devise)}</span></span>
        </div>
        <div class="calc-row">
          <span class="calc-label">Fret</span>
          <span class="calc-value">: ${facture.devise} ${(fret/quantite).toFixed(2)} / TM = <span style="margin-left: 20px;">${formatAmount(fret, facture.devise)}</span></span>
        </div>
        <div class="calc-row total-row">
          <span class="calc-label">Total dû CFR F.O.</span>
          <span class="calc-value" style="margin-left: 74px;">${formatAmount(totalCFR, facture.devise)}</span>
        </div>
      </div>
    </div>

    <!-- Conditions de paiement -->
    <div class="payment-section">
      <div class="payment-title">Conditions de paiement : ${getDefaultValue(facture.conditions_paiement, '100% contre présentation des documents via canal bancaire')}</div>
      
      <div class="bank-details">
        <div class="bank-title">Coordonnées bancaires :</div>
        <div class="bank-info">
          Bénéficiaire: ${COMPANY_CONFIG.bank.beneficiary}<br>
          Banque: ${COMPANY_CONFIG.bank.name}<br>
          IBAN: ${COMPANY_CONFIG.bank.iban}<br>
          SWIFT: ${COMPANY_CONFIG.bank.swift}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <img src="${COMPANY_CONFIG.logo}" alt="Yellowrock" class="footer-logo" />
      <div class="footer-info">
        <strong>${COMPANY_CONFIG.name}</strong><br>
        ${COMPANY_CONFIG.address}, ${COMPANY_CONFIG.city}<br>
        ☎ : ${COMPANY_CONFIG.phone} • 📠 : ${COMPANY_CONFIG.fax}
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { invoiceId } = await req.json();
    
    if (!invoiceId) {
      throw new Error('Invoice ID is required');
    }

    console.log('Generating invoice for ID:', invoiceId);

    // Récupérer les données de la facture avec jointures optimisées
    const { data: factureData, error: factureError } = await supabase
      .from('factures')
      .select(`
        *,
        client:clients(*),
        lignes:lignes_facture(*),
        vente:ventes(
          *,
          navire:navires(*)
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (factureError) {
      console.error('Database error:', factureError);
      throw new Error(`Failed to fetch invoice data: ${factureError.message}`);
    }

    if (!factureData) {
      throw new Error('Invoice not found');
    }

    // Validation des données requises avec fallbacks
    if (!factureData.client) {
      console.warn('Client data is missing for invoice:', invoiceId);
    }

    if (!factureData.lignes || factureData.lignes.length === 0) {
      console.warn('Invoice lines are missing for invoice:', invoiceId);
      // Créer une ligne par défaut si aucune ligne n'existe
      factureData.lignes = [{
        description: 'Marchandises',
        quantite: 0,
        prix_unitaire: 0,
        montant_ligne: 0
      }];
    }

    // Récupérer le navire depuis la vente ou directement
    let navire = factureData.vente?.navire;
    if (!navire && factureData.vente?.navire_id) {
      const { data: navireData } = await supabase
        .from('navires')
        .select('*')
        .eq('id', factureData.vente.navire_id)
        .single();
      navire = navireData;
    }

    console.log('Invoice data processed successfully');

    const htmlContent = getInvoiceTemplate({
      facture: factureData,
      client: factureData.client,
      lignes: factureData.lignes,
      vente: factureData.vente,
      navire: navire
    });

    return new Response(htmlContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});