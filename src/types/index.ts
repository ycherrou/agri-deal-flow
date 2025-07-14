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

export interface PrixMarche {
  id: string;
  echeance: string;
  prix: number;
  date_maj: string;
  created_at: string;
  updated_at: string;
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