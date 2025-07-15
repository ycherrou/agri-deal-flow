// Utility functions for handling prices by product type

export type ProductType = 'mais' | 'tourteau_soja' | 'ble' | 'orge';

/**
 * Get the price unit for a given product
 */
export const getPriceUnit = (product: ProductType): string => {
  switch (product) {
    case 'mais':
      return 'cts/bu';
    case 'tourteau_soja':
      return 'USD/short ton';
    case 'ble':
    case 'orge':
    default:
      return 'USD/MT';
  }
};

/**
 * Format price according to product type
 */
export const formatPriceByProduct = (price: number, product: ProductType): string => {
  const unit = getPriceUnit(product);
  
  if (product === 'mais') {
    // Corn prices in cents/bushel - no decimals typically
    return `${price.toFixed(0)} ${unit}`;
  } else if (product === 'tourteau_soja') {
    // Soybean meal in USD/short ton - 2 decimals
    return `$${price.toFixed(2)} ${unit}`;
  } else {
    // Other products in USD/MT - 2 decimals
    return `$${price.toFixed(2)} ${unit}`;
  }
};

/**
 * Get the price label for forms based on product
 */
export const getPriceLabel = (product: ProductType, priceType: 'prime' | 'flat' | 'futures' | 'market'): string => {
  const unit = getPriceUnit(product);
  
  const labels = {
    prime: 'Prime',
    flat: 'Prix flat',
    futures: 'Prix futures',
    market: 'Prix marché'
  };
  
  return `${labels[priceType]} (${unit})`;
};

/**
 * Get the currency symbol for a product (for input placeholders)
 */
export const getCurrencySymbol = (product: ProductType): string => {
  if (product === 'mais') {
    return 'cts';
  } else {
    return '$';
  }
};
