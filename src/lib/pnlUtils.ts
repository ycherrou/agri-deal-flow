import { supabase } from '@/integrations/supabase/client';
import { PnLData, PortfolioPnL } from '@/types/index';

interface NavireWithPnLData {
  id: string;
  nom: string;
  produit: 'mais' | 'tourteau_soja' | 'ble' | 'orge' | 'ddgs' | 'ferrailles';
  quantite_totale: number;
  prime_achat: number | null;
  prix_achat_flat: number | null;
  terme_commercial: 'FOB' | 'CFR';
  taux_fret: number | null;
  parent_navire_id: string | null;
  reference_cbot: string | null;
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
    prix_flat: number | null;
    prix_reference: string | null;
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
  let primeAchat = navire.prime_achat || 0;
  
  // Ajouter le fret aux primes pour les navires FOB (conversion fret $/MT -> cts/bu)
  if (navire.terme_commercial === 'FOB' && navire.taux_fret) {
    const facteurConversion = getConversionFactor(navire.produit);
    if (facteurConversion > 0) {
      primeAchat += navire.taux_fret / facteurConversion;
    }
  }
  
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
 * Calcule le P&L sur les prix flat pour un navire
 */
export const calculateFlatPnL = (navire: NavireWithPnLData): number => {
  let prixAchatFlat = navire.prix_achat_flat || 0;
  
  // Ajouter le fret directement pour les navires FOB (déjà en $/MT)
  if (navire.terme_commercial === 'FOB' && navire.taux_fret) {
    prixAchatFlat += navire.taux_fret;
  }
  
  // Calculer le prix de vente flat moyen pondéré par volume
  const ventesFlat = navire.ventes.filter(v => v.type_deal === 'flat');
  if (ventesFlat.length === 0) return 0;
  
  const volumeTotal = ventesFlat.reduce((sum, v) => sum + v.volume, 0);
  const prixVenteFlatMoyen = ventesFlat.reduce((sum, v) => {
    return sum + (v.prix_flat || 0) * v.volume;
  }, 0) / volumeTotal;
  
  return (prixVenteFlatMoyen - prixAchatFlat) * volumeTotal;
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
  const pnlFlat = calculateFlatPnL(navire);
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
  
  // Calculs pour prix d'achat combiné avec fret inclus
  let prixAchatAvecFret = navire.prime_achat || navire.prix_achat_flat || 0;
  const isNavireFlat = navire.prix_achat_flat !== null && navire.prime_achat === null;
  
  // Ajouter le fret selon le type de prix et le terme commercial
  if (navire.terme_commercial === 'FOB' && navire.taux_fret) {
    if (isNavireFlat) {
      // Pour les prix flat : addition directe du fret
      prixAchatAvecFret += navire.taux_fret;
    } else {
      // Pour les primes : convertir le fret de $/MT vers cts/bu
      const facteurConversion = getConversionFactor(navire.produit);
      if (facteurConversion > 0) {
        prixAchatAvecFret += navire.taux_fret / facteurConversion;
      }
    }
  }
  
  // Calculs pour ventes à prime
  const ventesAvecPrime = navire.ventes.filter(v => v.type_deal === 'prime');
  const volumeTotalVenduPrime = ventesAvecPrime.reduce((sum, v) => sum + v.volume, 0);
  const primeVenteMoyenne = volumeTotalVenduPrime > 0 ?
    ventesAvecPrime.reduce((sum, v) => sum + (v.prime_vente || 0) * v.volume, 0) / volumeTotalVenduPrime : 0;
  
  // Calculs pour ventes flat
  const ventesFlat = navire.ventes.filter(v => v.type_deal === 'flat');
  const volumeTotalVenduFlat = ventesFlat.reduce((sum, v) => sum + v.volume, 0);
  const prixFlatVenteMoyen = volumeTotalVenduFlat > 0 ?
    ventesFlat.reduce((sum, v) => sum + (v.prix_flat || 0) * v.volume, 0) / volumeTotalVenduFlat : 0;
  
  // Calculer la moyenne pondérée globale des prix de vente
  const volumeTotalVendu = volumeTotalVenduPrime + volumeTotalVenduFlat;
  const facteurConversion = getConversionFactor(navire.produit);
  
  let prixVenteMoyenGlobal = 0;
  let prixAchatAffichage = 0;
  
  if (volumeTotalVendu > 0) {
    // Convertir les primes en $/tonne si nécessaire
    const primeVenteConvertie = primeVenteMoyenne * facteurConversion;
    const prixVentePondere = (primeVenteConvertie * volumeTotalVenduPrime + prixFlatVenteMoyen * volumeTotalVenduFlat) / volumeTotalVendu;
    prixVenteMoyenGlobal = prixVentePondere;
  }
  
  // Prix d'achat pour affichage : toujours afficher la prime CFR (sans fret)
  let prixAchatCFR = 0;
  if (isNavireFlat) {
    // Pour les navires flat : afficher le prix flat original (CFR)
    prixAchatCFR = navire.prix_achat_flat || 0;
  } else {
    // Pour les navires à prime : afficher la prime originale (CFR) convertie en $/tonne
    prixAchatCFR = (navire.prime_achat || 0) * facteurConversion;
  }
  
  return {
    navire_id: navire.id,
    navire_nom: navire.nom,
    produit: navire.produit,
    prime_achat: prixAchatCFR,
    prix_achat_flat: navire.prix_achat_flat || undefined,
    prime_vente_moyenne: prixVenteMoyenGlobal,
    prix_flat_vente_moyen: prixFlatVenteMoyen,
    pnl_prime: pnlPrime,
    pnl_flat: pnlFlat,
    prix_futures_achat_moyen: prixFuturesAchatMoyen,
    prix_futures_vente_moyen: prixFuturesVenteMoyen,
    pnl_futures: pnlFutures,
    pnl_total: pnlPrime + pnlFlat + pnlFutures,
    volume_total_achete: navire.quantite_totale,
    volume_total_vendu: volumeTotalVendu,
    volume_couvert_achat: volumeAchatTotal,
    volume_couvert_vente: volumeVenteTotal
  };
};

/**
 * Récupère les ventes d'un navire parent pour un navire rollé
 */
const getParentVentes = async (parentNavireId: string, referenceCbot: string | null) => {
  const { data: parentVentes, error } = await supabase
    .from('ventes')
    .select(`
      id,
      type_deal,
      volume,
      prime_vente,
      prix_flat,
      prix_reference,
      couvertures (
        volume_couvert,
        prix_futures,
        nombre_contrats
      )
    `)
    .eq('navire_id', parentNavireId);

  if (error) {
    console.error('Error fetching parent ventes:', error);
    return [];
  }

  // Si le navire rollé a une référence CBOT, filtrer les ventes du parent
  if (referenceCbot) {
    return (parentVentes || []).filter(vente => vente.prix_reference === referenceCbot);
  }

  return parentVentes || [];
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
      prix_achat_flat,
      terme_commercial,
      taux_fret,
      parent_navire_id,
      reference_cbot,
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
        prix_flat,
        prix_reference,
        couvertures (
          volume_couvert,
          prix_futures,
          nombre_contrats
        )
      )
    `)
    .is('parent_navire_id', null);

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
      pnl_flat_total: pnlNavires.reduce((sum, n) => sum + n.pnl_flat, 0),
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
    case 'ddgs':
    case 'ferrailles':
      return 1; // Déjà en $/tonne, pas de primes ni futures
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

interface ClientPnLData {
  client_id: string;
  client_nom: string;
  navire_id: string;
  navire_nom: string;
  produit: 'mais' | 'tourteau_soja' | 'ble' | 'orge' | 'ddgs' | 'ferrailles';
  pnl_total: number;
  pnl_prime: number;
  pnl_flat: number;
  pnl_futures: number;
  volume_total: number;
  volume_couvert: number;
}

export interface NavirePnLByClient {
  navire_id: string;
  navire_nom: string;
  produit: 'mais' | 'tourteau_soja' | 'ble' | 'orge' | 'ddgs' | 'ferrailles';
  clients: ClientPnLData[];
  total_pnl: number;
  total_volume: number;
}

/**
 * Calcule le P&L par client pour chaque navire
 */
export const calculatePnLByClient = async (userRole: 'admin' | 'client' = 'admin'): Promise<NavirePnLByClient[]> => {
  try {
    let query = supabase
      .from('navires')
      .select(`
        id,
        nom,
        produit,
        quantite_totale,
        prime_achat,
        prix_achat_flat,
        terme_commercial,
        taux_fret,
        couvertures_achat (
          volume_couvert,
          prix_futures,
          nombre_contrats
        ),
        ventes (
          id,
          client_id,
          type_deal,
          volume,
          prime_vente,
          prix_flat,
          prix_reference,
          couvertures (
            volume_couvert,
            prix_futures,
            nombre_contrats
          ),
          clients (
            id,
            nom
          )
        )
      `)
      .is('parent_navire_id', null);

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

    const naviresData = navires as any[] || [];
    
    const result: NavirePnLByClient[] = [];

    for (const navire of naviresData) {
      if (!navire.ventes || navire.ventes.length === 0) continue;

      const clientsMap = new Map<string, ClientPnLData>();
      
      // Calculer les moyennes pour les futures d'achat
      const couverturesAchat = navire.couvertures_achat || [];
      const volumeAchatTotal = couverturesAchat.reduce((sum: number, c: any) => sum + c.volume_couvert, 0);
      const prixFuturesAchatMoyen = volumeAchatTotal > 0 ? 
        couverturesAchat.reduce((sum: number, c: any) => sum + c.prix_futures * c.volume_couvert, 0) / volumeAchatTotal : 0;

      // Traiter chaque vente
      for (const vente of navire.ventes) {
        const clientId = vente.client_id;
        const clientNom = vente.clients?.nom || 'Client inconnu';
        
        if (!clientsMap.has(clientId)) {
          clientsMap.set(clientId, {
            client_id: clientId,
            client_nom: clientNom,
            navire_id: navire.id,
            navire_nom: navire.nom,
            produit: navire.produit,
            pnl_total: 0,
            pnl_prime: 0,
            pnl_flat: 0,
            pnl_futures: 0,
            volume_total: 0,
            volume_couvert: 0
          });
        }

        const clientData = clientsMap.get(clientId)!;
        clientData.volume_total += vente.volume;

        // Calculer P&L sur primes pour cette vente
        if (vente.type_deal === 'prime') {
          let primeAchat = navire.prime_achat || 0;
          
          // Ajouter le fret aux primes pour les navires FOB
          if (navire.terme_commercial === 'FOB' && navire.taux_fret) {
            const facteurConversion = getConversionFactor(navire.produit);
            if (facteurConversion > 0) {
              primeAchat += navire.taux_fret / facteurConversion;
            }
          }
          
          const primeVente = vente.prime_vente || 0;
          const facteurConversion = getConversionFactor(navire.produit);
          const pnlPrime = (primeVente - primeAchat) * facteurConversion * vente.volume;
          clientData.pnl_prime += pnlPrime;
        }

        // Calculer P&L flat pour cette vente
        if (vente.type_deal === 'flat') {
          let prixAchatFlat = navire.prix_achat_flat || 0;
          
          // Ajouter le fret directement pour les navires FOB
          if (navire.terme_commercial === 'FOB' && navire.taux_fret) {
            prixAchatFlat += navire.taux_fret;
          }
          
          const prixVenteFlat = vente.prix_flat || 0;
          const pnlFlat = (prixVenteFlat - prixAchatFlat) * vente.volume;
          clientData.pnl_flat += pnlFlat;
        }

        // Calculer P&L sur futures pour cette vente
        if (vente.couvertures && vente.couvertures.length > 0) {
          const volumeVenteCouverte = vente.couvertures.reduce((sum: number, c: any) => sum + c.volume_couvert, 0);
          const prixFuturesVenteMoyen = volumeVenteCouverte > 0 ?
            vente.couvertures.reduce((sum: number, c: any) => sum + c.prix_futures * c.volume_couvert, 0) / volumeVenteCouverte : 0;

          const facteurConversion = getConversionFactor(navire.produit);
          const pnlFutures = (prixFuturesVenteMoyen - prixFuturesAchatMoyen) * facteurConversion * volumeVenteCouverte;
          clientData.pnl_futures += pnlFutures;
          clientData.volume_couvert += volumeVenteCouverte;
        }

        clientData.pnl_total = clientData.pnl_prime + clientData.pnl_flat + clientData.pnl_futures;
      }

      const clients = Array.from(clientsMap.values());
      const totalPnL = clients.reduce((sum, c) => sum + c.pnl_total, 0);
      const totalVolume = clients.reduce((sum, c) => sum + c.volume_total, 0);

      result.push({
        navire_id: navire.id,
        navire_nom: navire.nom,
        produit: navire.produit,
        clients,
        total_pnl: totalPnL,
        total_volume: totalVolume
      });
    }

    return result;
  } catch (error) {
    console.error('Error calculating P&L by client:', error);
    throw error;
  }
};
