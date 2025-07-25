import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fonction pour générer automatiquement le symbole Yahoo Finance
function generateYahooSymbol(echeanceName: string): string | null {
  // Les contrats CBOT suivent le format: [Produit][Mois][Année]
  // Exemple: ZCU25 = Corn September 2025
  
  // Vérifier si c'est un contrat CBOT valide (commence par ZC, ZM, ZW, etc.)
  const cbotProducts = ['ZC', 'ZM', 'ZW', 'ZL', 'ZS'];
  const productCode = echeanceName.substring(0, 2);
  
  if (!cbotProducts.includes(productCode)) {
    return null; // Pas un contrat CBOT reconnu
  }
  
  // Vérifier que le format est correct (longueur 5: XX + lettre + 2 chiffres)
  if (echeanceName.length !== 5) {
    return null;
  }
  
  return `${echeanceName}.CBT`;
}

interface YahooFinanceData {
  symbol: string;
  regularMarketPrice: number;
  regularMarketTime: number;
}

async function fetchYahooFinancePrice(symbol: string): Promise<number | null> {
  try {
    console.log(`Fetching price for symbol: ${symbol}`);
    
    // URL de l'API Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`Yahoo Finance API error for ${symbol}:`, response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.chart?.result?.[0]?.meta?.regularMarketPrice) {
      console.error(`No price data found for ${symbol}`);
      return null;
    }
    
    const price = data.chart.result[0].meta.regularMarketPrice;
    console.log(`Price for ${symbol}: ${price}`);
    
    return price;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Starting CBOT price fetch...');
    
    // Récupérer toutes les échéances actives
    const { data: echeances, error: echeancesError } = await supabase
      .from('echeances')
      .select('id, nom')
      .eq('active', true);
      
    if (echeancesError) {
      console.error('Error fetching echeances:', echeancesError);
      throw echeancesError;
    }
    
    console.log(`Found ${echeances?.length || 0} active echeances`);
    
    const results = [];
    const errors = [];
    
    // Pour chaque échéance, essayer de récupérer le prix
    for (const echeance of echeances || []) {
      const symbol = generateYahooSymbol(echeance.nom);
      
      if (!symbol) {
        console.log(`No symbol mapping found for echeance: ${echeance.nom}`);
        continue;
      }
      
      const price = await fetchYahooFinancePrice(symbol);
      
      if (price !== null) {
        // Insérer le nouveau prix dans la base de données
        const { error: insertError } = await supabase
          .from('prix_marche')
          .insert({
            echeance_id: echeance.id,
            prix: price
          });
          
        if (insertError) {
          console.error(`Error inserting price for ${echeance.nom}:`, insertError);
          errors.push({
            echeance: echeance.nom,
            symbol,
            error: insertError.message
          });
        } else {
          results.push({
            echeance: echeance.nom,
            symbol,
            price,
            updated: true
          });
          console.log(`Successfully updated price for ${echeance.nom}: ${price}`);
        }
      } else {
        errors.push({
          echeance: echeance.nom,
          symbol,
          error: 'Failed to fetch price'
        });
      }
      
      // Petite pause entre les requêtes pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      results,
      errors,
      summary: {
        total_echeances: echeances?.length || 0,
        successful_updates: results.length,
        failed_updates: errors.length
      }
    };
    
    console.log('CBOT price fetch completed:', response.summary);
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in fetch-cbot-prices function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});