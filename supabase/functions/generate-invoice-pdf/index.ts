import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
// Force redeploy - v2

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
  logo: "/lovable-uploads/6e9b8a58-4f24-44f0-bfe5-16d232c211f9.png",
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
  const { facture, client, lignes, vente, navire, prixUnitaireCalcule } = invoiceData;
  
  // Calculs exacts comme sur la vraie facture
  const quantite = lignes.reduce((acc: number, ligne: any) => acc + (ligne.quantite || 0), 0);
  
  // Utiliser le PRU calculé par la fonction de base de données
  const prixUnitaire = prixUnitaireCalcule || 0;
  
  console.log('Template - PRU utilisé:', prixUnitaire, 'pour volume:', quantite);
  
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
      font-size: 10px;
      line-height: 1.15;
      color: #333;
      background: white;
    }
    
    /* Styles optimisés pour génération PDF */
    body {
      margin: 0;
      padding: 0;
      font-size: 9px;
      line-height: 1.1;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
    }
    
    @page {
      margin: 0;
      size: A4;
    }
    
    .invoice-container {
      width: 210mm;
      height: 297mm;
      margin: 0;
      padding: 2mm 8mm 8mm 8mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    
    .main-content {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-evenly;
    }
    
    /* Header avec logo - très compact */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2px;
    }
    
    .company-section {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    
    .company-logo {
      max-width: 640px;
      max-height: 320px;
      margin-bottom: 6px;
    }
    
    .invoice-info {
      text-align: left;
    }
    
    .invoice-title {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 2px;
    }
    
    .invoice-ref {
      font-size: 9px;
      margin-bottom: 8px;
    }
    
    .invoice-date {
      font-size: 9px;
      margin-bottom: 12px;
    }
    
    /* Client section - très compact */
    .client-section {
      text-align: right;
      margin-bottom: 12px;
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
    
    /* Détails transport et marchandises - ultra compact */
    .details-section {
      margin-bottom: 8px;
    }
    
    .detail-row {
      display: flex;
      margin-bottom: 2px;
      align-items: baseline;
    }
    
    .detail-label {
      font-weight: bold;
      min-width: 140px;
      flex-shrink: 0;
      font-size: 8px;
    }
    
    .detail-value {
      flex: 1;
      font-size: 8px;
    }
    
    /* Section calculs - ultra compact */
    .calculations {
      margin: 8px 0;
      border-top: 1px solid #ccc;
      padding-top: 6px;
    }
    
    .calc-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
      align-items: baseline;
    }
    
    .calc-label {
      font-weight: bold;
      min-width: 120px;
      font-size: 8px;
    }
    
    .calc-value {
      text-align: right;
      font-weight: bold;
      font-size: 8px;
    }
    
    .total-row {
      border-top: 1px solid #333;
      margin-top: 4px;
      padding-top: 3px;
      font-size: 9px;
      font-weight: bold;
    }
    
    /* Conditions de paiement - ultra compact */
    .payment-section {
      margin: 8px 0;
      padding: 5px 0;
      border-top: 1px solid #ccc;
    }
    
    .payment-title {
      font-weight: bold;
      margin-bottom: 6px;
      font-size: 9px;
    }
    
    .bank-details {
      margin-top: 8px;
    }
    
    .bank-title {
      font-weight: bold;
      margin-bottom: 4px;
      font-size: 9px;
    }
    
    .bank-info {
      line-height: 1.3;
      font-size: 8px;
    }
    
    /* Footer - très compact */
    .footer {
      margin-top: 6px;
      text-align: center;
      border-top: 1px solid #ccc;
      padding-top: 4px;
    }
    
    .footer-logo {
      max-width: 80px;
      margin-bottom: 3px;
    }
    
    .footer-info {
      font-size: 7px;
      line-height: 1.2;
      color: #666;
    }
    
    /* CSS Print optimisé pour une page */
    @media print {
      .invoice-container {
        margin: 0;
        padding: 8mm;
        min-height: auto;
      }
      
      .footer {
        margin-top: 8px;
        page-break-inside: avoid;
      }
      
      .details-section {
        margin-bottom: 8px;
      }
      
      .calculations {
        margin: 8px 0;
        padding-top: 6px;
      }
      
      .payment-section {
        margin: 8px 0;
        padding: 6px 0;
      }
      
      /* Réduire encore plus les espacements */
      .detail-row, .calc-row {
        margin-bottom: 2px;
      }
      
      /* Éviter les coupures de page */
      .details-section,
      .calculations,
      .payment-section {
        page-break-inside: avoid;
      }
    }
    
    /* Styles pour données manquantes - compact */
    .missing-data {
      color: #999;
      font-style: italic;
      font-size: 8px;
    }
    
    .highlight-missing {
      background-color: #fff3cd;
      padding: 1px 2px;
      border-radius: 2px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="main-content">
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
    const { factureId } = await req.json();
    
    if (!factureId) {
      throw new Error('Facture ID is required');
    }

    console.log('Generating invoice for ID:', factureId);

    // Récupérer les données de la facture avec jointures optimisées
    const { data: factureData, error: factureError } = await supabase
      .from('factures')
      .select(`
        *,
        client:clients(*),
        vente:ventes(
          *,
          navire:navires(*),
          couvertures(*)
        ),
        lignes:lignes_facture(*)
      `)
      .eq('id', factureId)
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
      console.warn('Client data is missing for invoice:', factureId);
    }

    if (!factureData.lignes || factureData.lignes.length === 0) {
      console.warn('Invoice lines are missing for invoice:', factureId);
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

    // Calculer le PRU en utilisant la fonction de base de données
    let prixUnitaireCalcule = 0;
    console.log('Vente ID pour calcul PRU:', factureData.vente?.id);
    
    if (factureData.vente?.id) {
      console.log('Appel de la fonction calculate_pru_facture avec vente_id:', factureData.vente.id);
      
      const { data: pruData, error: pruError } = await supabase
        .rpc('calculate_pru_facture', { vente_id_param: factureData.vente.id });
      
      console.log('Résultat fonction PRU:', { pruData, pruError });
      
      if (pruError) {
        console.error('Erreur calcul PRU:', pruError);
        prixUnitaireCalcule = 0;
      } else {
        prixUnitaireCalcule = pruData || 0;
        console.log('PRU calculé avec succès:', prixUnitaireCalcule);
      }
    } else {
      console.log('Aucune vente_id trouvée dans factureData.vente');
    }

    console.log('PRU final utilisé pour la facture:', prixUnitaireCalcule);

    const htmlContent = getInvoiceTemplate({
      facture: factureData,
      client: factureData.client,
      lignes: factureData.lignes,
      vente: factureData.vente,
      navire: navire,
      prixUnitaireCalcule: prixUnitaireCalcule
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