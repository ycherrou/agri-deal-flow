export interface Client {
  id: string;
  user_id: string;
  nom: string;
  role: 'admin' | 'client';
  email: string;
  telephone?: string;
  created_at: string;
  updated_at: string;
}

export interface Navire {
  id: string;
  nom: string;
  produit: 'mais' | 'tourteau_soja' | 'ble' | 'orge';
  quantite_totale: number;
  prime_achat?: number;
  prix_achat_flat?: number;
  reference_cbot?: string;
  date_arrivee: string;
  fournisseur: string;
  created_at: string;
  updated_at: string;
}

export interface Vente {
  id: string;
  navire_id: string;
  client_id: string;
  type_deal: 'prime' | 'flat';
  prime_vente?: number;
  prix_flat?: number;
  volume: number;
  date_deal: string;
  prix_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface Couverture {
  id: string;
  vente_id: string;
  volume_couvert: number;
  prix_futures: number;
  date_couverture: string;
  created_at: string;
  updated_at: string;
}

export interface ReventeClient {
  id: string;
  vente_id: string;
  volume: number;
  prix_flat_demande: number;
  date_revente: string;
  etat: 'en_attente' | 'vendu' | 'retire';
  commentaire?: string;
  created_at: string;
  updated_at: string;
}

export interface Echeance {
  id: string;
  nom: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrixMarche {
  id: string;
  echeance_id: string;
  prix: number;
  created_at: string;
  updated_at: string;
  echeance?: Echeance;
}

export interface DashboardStats {
  totalNavires: number;
  totalVentes: number;
  totalVolume: number;
  totalValue: number;
  couvertureRate: number;
  activeClients: number;
}

export interface VenteWithDetails extends Vente {
  navire: Navire;
  client: Client;
  couvertures: Couverture[];
  reventes: ReventeClient[];
  volumeCouvert: number;
  volumeNonCouvert: number;
  pru: number;
}

export interface NavireWithStats extends Navire {
  ventes: Vente[];
  volumeVendu: number;
  volumeRestant: number;
  nombreClients: number;
  valeurTotale: number;
}

export interface CouvertureAchat {
  id: string;
  navire_id: string;
  volume_couvert: number;
  prix_futures: number;
  nombre_contrats: number;
  date_couverture: string;
  created_at: string;
  updated_at: string;
}

export interface PnLData {
  navire_id: string;
  navire_nom: string;
  produit: 'mais' | 'tourteau_soja' | 'ble' | 'orge';
  prime_achat: number;
  prix_achat_flat?: number;
  prime_vente_moyenne: number;
  prix_flat_vente_moyen?: number;
  pnl_prime: number;
  pnl_flat: number;
  prix_futures_achat_moyen: number;
  prix_futures_vente_moyen: number;
  pnl_futures: number;
  pnl_total: number;
  volume_total_achete: number;
  volume_total_vendu: number;
  volume_couvert_achat: number;
  volume_couvert_vente: number;
}

export interface PortfolioPnL {
  pnl_total: number;
  pnl_prime_total: number;
  pnl_futures_total: number;
  nombre_navires: number;
  volume_total: number;
  navires: PnLData[];
}