
// Utility functions for handling prices by product type

export type ProductType = 'mais' | 'tourteau_soja' | 'ble' | 'orge';
export type PriceType = 'prime' | 'flat' | 'futures' | 'market';

/**
 * Get the price unit for a given product and price type
 */
export const getPriceUnit = (product: ProductType, priceType: PriceType): string => {
  // Prix flat toujours en USD/MT
  if (priceType === 'flat') {
    return 'USD/MT';
  }
  
  // Primes et futures : Cts/Bu pour maïs, USD/Short Ton pour tourteau, USD/MT pour blé et orge
  if (priceType === 'prime' || priceType === 'futures') {
    if (product === 'mais') return 'Cts/Bu';
    if (product === 'tourteau_soja') return 'USD/Short Ton';
    return 'USD/MT'; // blé et orge
  }
  
  return 'USD/MT';
};

/**
 * Convert price for display based on product and price type
 * No conversion needed as prices are already stored in the correct units
 */
export const convertPriceForDisplay = (price: number, product: ProductType, priceType: PriceType): number => {
  return price; // Prices are already stored in correct units
};

/**
 * Format price with appropriate unit for display
 */
export const formatPriceDisplay = (price: number, product: ProductType, priceType: PriceType): string => {
  const convertedPrice = convertPriceForDisplay(price, product, priceType);
  const unit = getPriceUnit(product, priceType);
  return `${convertedPrice.toFixed(2)} ${unit}`;
};

/**
 * Format price according to product type (legacy function)
 */
export const formatPriceByProduct = (price: number, product: ProductType): string => {
  return price.toFixed(2);
};

/**
 * Get the price label for forms based on product
 */
export const getPriceLabel = (product: ProductType, priceType: 'prime' | 'flat' | 'futures' | 'market'): string => {
  const labels = {
    prime: 'Prime',
    flat: 'Prix flat',
    futures: 'Prix futures',
    market: 'Prix marché'
  };
  
  return labels[priceType];
};

/**
 * Get the currency symbol for a product (for input placeholders)
 */
export const getCurrencySymbol = (product: ProductType): string => {
  return ''; // Plus de symboles monétaires
};

/**
 * Get the latest price for each maturity from prix_marche data
 */
export const getLatestPricesForMaturities = (prixMarche: Array<{
  echeance_id: string;
  prix: number;
  created_at: string;
  echeance?: {
    nom: string;
    active: boolean;
  };
}>) => {
  const latestPrices = new Map<string, number>();
  
  // Group by echeance_id and keep only the latest price for each
  prixMarche.forEach(price => {
    const echeanceId = price.echeance_id;
    const echeanceName = price.echeance?.nom;
    
    if (!echeanceName) return;
    
    if (!latestPrices.has(echeanceName)) {
      latestPrices.set(echeanceName, price.prix);
    }
  });
  
  return latestPrices;
};
