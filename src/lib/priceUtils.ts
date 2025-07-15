// Utility functions for handling prices by product type

export type ProductType = 'mais' | 'tourteau_soja' | 'ble' | 'orge';

/**
 * Get the price unit for a given product
 */
export const getPriceUnit = (product: ProductType): string => {
  return ''; // Plus d'unités affichées
};

/**
 * Format price according to product type
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
