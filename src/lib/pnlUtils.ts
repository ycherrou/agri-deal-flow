import { supabase } from '@/integrations/supabase/client';
import { PnLData, PortfolioPnL } from '@/types/index';

interface NavireWithPnLData {
  id: string;
  nom: string;
  produit: 'mais' | 'tourteau_soja' | 'ble' | 'orge';
  quantite_totale: number;
  prime_achat: number | null;
  couvertures_achat: Array<{
    volume_couvert: number;
    prix_futures: number;
    nombre_contrats: number;
  }>;
  ventes: Array<{
    id: string;
    type_deal: 'prime' | 'flat';
    volume: number;
    prime_vente: number | null;
    couvertures: Array<{
      volume_couvert: number;
      prix_futures: number;
      nombre_contrats: number;
    }>;
  }>;
}

/**
 * Calcule le P&L sur les primes pour un navire
 */
export const calculatePrimePnL = (navire: NavireWithPnLData): number => {
  const primeAchat = navire.prime_achat || 0;
  
  // Calculer la prime de vente moyenne pondérée par volume
  const ventesAvecPrime = navire.ventes.filter(v => v.type_deal === 'prime');
  if (ventesAvecPrime.length === 0) return 0;
  
  const volumeTotal = ventesAvecPrime.reduce((sum, v) => sum + v.volume, 0);
  const primeVenteMoyenne = ventesAvecPrime.reduce((sum, v) => {
    return sum + (v.prime_vente || 0) * v.volume;
  }, 0) / volumeTotal;
  
  // Appliquer le facteur de conversion pour convertir les primes en $/tonne
  const facteurConversion = getConversionFactor(navire.produit);
  const primeAchatConvertie = primeAchat * facteurConversion;
  const primeVenteConvertie = primeVenteMoyenne * facteurConversion;
  
  return (primeVenteConvertie - primeAchatConvertie) * volumeTotal;
};

/**
 * Calcule le P&L sur les futures pour un navire
 */
export const calculateFuturesPnL = (navire: NavireWithPnLData): number => {
  // Calcul du prix moyen pondéré des futures d'achat
  const couverturesAchat = navire.couvertures_achat || [];
  const volumeAchatTotal = couverturesAchat.reduce((sum, c) => sum + c.volume_couvert, 0);
  
  if (volumeAchatTotal === 0) return 0;
  
  const prixFuturesAchatMoyen = couverturesAchat.reduce((sum, c) => {
    return sum + c.prix_futures * c.volume_couvert;
  }, 0) / volumeAchatTotal;
  
  // Calcul du prix moyen pondéré des futures de vente
  const couverturesVente = navire.ventes.flatMap(v => v.couvertures);
  const volumeVenteTotal = couverturesVente.reduce((sum, c) => sum + c.volume_couvert, 0);
  
  if (volumeVenteTotal === 0) return 0;
  
  const prixFuturesVenteMoyen = couverturesVente.reduce((sum, c) => {
    return sum + c.prix_futures * c.volume_couvert;
  }, 0) / volumeVenteTotal;
  
  // Appliquer le facteur de conversion pour convertir les prix futures en $/tonne
  const facteurConversion = getConversionFactor(navire.produit);
  const prixAchatConverti = prixFuturesAchatMoyen * facteurConversion;
  const prixVenteConverti = prixFuturesVenteMoyen * facteurConversion;
  
  // Le volume pour le calcul du P&L est le minimum entre achat et vente couvert
  const volumeCalcul = Math.min(volumeAchatTotal, volumeVenteTotal);
  
  return (prixVenteConverti - prixAchatConverti) * volumeCalcul;
};

/**
 * Calcule le P&L total pour un navire
 */
export const calculateTotalPnL = (navire: NavireWithPnLData): PnLData => {
  const pnlPrime = calculatePrimePnL(navire);
  const pnlFutures = calculateFuturesPnL(navire);
  
  // Calculs additionnels pour les détails
  const couverturesAchat = navire.couvertures_achat || [];
  const volumeAchatTotal = couverturesAchat.reduce((sum, c) => sum + c.volume_couvert, 0);
  const prixFuturesAchatMoyen = volumeAchatTotal > 0 ? 
    couverturesAchat.reduce((sum, c) => sum + c.prix_futures * c.volume_couvert, 0) / volumeAchatTotal : 0;
  
  const couverturesVente = navire.ventes.flatMap(v => v.couvertures);
  const volumeVenteTotal = couverturesVente.reduce((sum, c) => sum + c.volume_couvert, 0);
  const prixFuturesVenteMoyen = volumeVenteTotal > 0 ?
    couverturesVente.reduce((sum, c) => sum + c.prix_futures * c.volume_couvert, 0) / volumeVenteTotal : 0;
  
  const ventesAvecPrime = navire.ventes.filter(v => v.type_deal === 'prime');
  const volumeTotalVendu = ventesAvecPrime.reduce((sum, v) => sum + v.volume, 0);
  const primeVenteMoyenne = volumeTotalVendu > 0 ?
    ventesAvecPrime.reduce((sum, v) => sum + (v.prime_vente || 0) * v.volume, 0) / volumeTotalVendu : 0;
  
  // Appliquer le facteur de conversion pour l'affichage des primes
  const facteurConversion = getConversionFactor(navire.produit);
  const primeAchatAffichage = (navire.prime_achat || 0) * facteurConversion;
  const primeVenteAffichage = primeVenteMoyenne * facteurConversion;
  
  return {
    navire_id: navire.id,
    navire_nom: navire.nom,
    produit: navire.produit,
    prime_achat: primeAchatAffichage,
    prime_vente_moyenne: primeVenteAffichage,
    pnl_prime: pnlPrime,
    prix_futures_achat_moyen: prixFuturesAchatMoyen,
    prix_futures_vente_moyen: prixFuturesVenteMoyen,
    pnl_futures: pnlFutures,
    pnl_total: pnlPrime + pnlFutures,
    volume_total_achete: navire.quantite_totale,
    volume_total_vendu: volumeTotalVendu,
    volume_couvert_achat: volumeAchatTotal,
    volume_couvert_vente: volumeVenteTotal
  };
};

/**
 * Calcule le P&L du portefeuille complet
 */
export const calculatePortfolioPnL = async (userRole: 'admin' | 'client' = 'admin'): Promise<PortfolioPnL> => {
  try {
    let query = supabase
      .from('navires')
      .select(`
        id,
        nom,
        produit,
        quantite_totale,
        prime_achat,
        couvertures_achat (
          volume_couvert,
          prix_futures,
          nombre_contrats
        ),
        ventes (
          id,
          type_deal,
          volume,
          prime_vente,
          couvertures (
            volume_couvert,
            prix_futures,
            nombre_contrats
          )
        )
      `);

    // Si c'est un client, filtrer par ses ventes uniquement
    if (userRole === 'client') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (clientData) {
          query = query.eq('ventes.client_id', clientData.id);
        }
      }
    }

    const { data: navires, error } = await query;
    
    if (error) throw error;

    const naviresData = navires as NavireWithPnLData[] || [];
    const pnlNavires = naviresData.map(calculateTotalPnL);
    
    const portfolioPnL: PortfolioPnL = {
      pnl_total: pnlNavires.reduce((sum, n) => sum + n.pnl_total, 0),
      pnl_prime_total: pnlNavires.reduce((sum, n) => sum + n.pnl_prime, 0),
      pnl_futures_total: pnlNavires.reduce((sum, n) => sum + n.pnl_futures, 0),
      nombre_navires: pnlNavires.length,
      volume_total: pnlNavires.reduce((sum, n) => sum + n.volume_total_achete, 0),
      navires: pnlNavires
    };

    return portfolioPnL;
  } catch (error) {
    console.error('Error calculating portfolio P&L:', error);
    throw error;
  }
};

/**
 * Obtient le facteur de conversion pour un produit
 */
export const getConversionFactor = (produit: string): number => {
  switch (produit) {
    case 'mais':
      return 0.3937; // cts/bu -> $/tonne
    case 'tourteau_soja':
      return 0.9072; // cts/bu -> $/tonne
    case 'ble':
    case 'orge':
    default:
      return 1; // Déjà en $/tonne
  }
};

/**
 * Formate un montant P&L pour l'affichage
 */
export const formatPnL = (amount: number): string => {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  return amount >= 0 ? `+${formatted} $` : `-${formatted} $`;
};

/**
 * Obtient la couleur d'affichage pour un P&L
 */
export const getPnLColor = (amount: number): string => {
  if (amount > 0) return 'text-green-600';
  if (amount < 0) return 'text-red-600';
  return 'text-muted-foreground';
};