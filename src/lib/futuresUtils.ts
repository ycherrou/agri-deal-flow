import { Database } from "@/integrations/supabase/types";

export type ProductType = Database["public"]["Enums"]["product_type"];

/**
 * Taille des contrats futures par produit (en tonnes)
 */
export const getContractSize = (produit: ProductType): number => {
  switch (produit) {
    case 'mais':
      return 127;
    case 'tourteau_soja':
      return 90.10;
    case 'ble':
    case 'orge':
    default:
      return 0; // Pas de contrats standardisés pour ces produits
  }
};

/**
 * Convertit un volume en nombre de contrats (arrondi au supérieur)
 */
export const volumeToContracts = (volume: number, produit: ProductType): number => {
  const contractSize = getContractSize(produit);
  if (contractSize === 0) return 0;
  return Math.ceil(volume / contractSize);
};

/**
 * Convertit un nombre de contrats en volume
 */
export const contractsToVolume = (contracts: number, produit: ProductType): number => {
  const contractSize = getContractSize(produit);
  return contracts * contractSize;
};

/**
 * Vérifie si un produit supporte les contrats futures
 */
export const supportsContracts = (produit: ProductType): boolean => {
  return getContractSize(produit) > 0;
};

/**
 * Formate l'affichage des contrats avec équivalent volume
 */
export const formatContractsWithVolume = (contracts: number, produit: ProductType): string => {
  const volume = contractsToVolume(contracts, produit);
  const contractSize = getContractSize(produit);
  
  if (contractSize === 0) {
    return `${volume} tonnes`;
  }
  
  return `${contracts} contrat${contracts > 1 ? 's' : ''} (${volume} tonnes)`;
};

/**
 * Calcule la surcouverture générée par l'arrondi au contrat supérieur
 */
export const calculateOvercoverage = (originalVolume: number, contracts: number, produit: ProductType): number => {
  const contractVolume = contractsToVolume(contracts, produit);
  return Math.max(0, contractVolume - originalVolume);
};