// ==================== types.ts ====================
export enum UserRole {
  PATIENT = 'PATIENT',
  PHARMACY = 'PHARMACY',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN'
}

export enum UserStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface UserProfile {
  uid: string;
  name: string; // Patient: Nom complet, Pharmacie: Nom du responsable, Livreur: Nom complet
  email: string;
  phone: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  // Champs spécifiques Pharmacie
  pharmacyName?: string;
  pharmacyAddress?: string;
  licenseNumber?: string;
  // Champs spécifiques Livreur
  vehicleType?: string;
  vehiclePlate?: string;
}

export enum OrderStatus {
  PENDING_ANALYSIS = 'PENDING_ANALYSIS',
  AWAITING_QUOTES = 'AWAITING_QUOTES',
  PREPARING = 'PREPARING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export interface PrescriptionItem {
  name: string;
  dosage: string;
  quantity: number;
  isPsychotropic: boolean;
  isColdChain?: boolean;
  status?: 'AVAILABLE' | 'UNAVAILABLE' | 'GENERIC_AVAILABLE' | 'PENDING';
  price?: number;
  isGeneric?: boolean;
  packaging?: string;
  variantId?: string;
}

export interface Quote {
  pharmacyId: string;
  pharmacyName: string;
  items: PrescriptionItem[];
  totalAmount: number;
  deliveryFee: number;
  estimatedTime: number;
  isDeliveryBlocked?: boolean; 
}

export interface Order {
  id: string;
  patientId: string;
  patientName: string;
  pharmacyId?: string;
  pharmacyName?: string;
  driverId?: string;
  status: OrderStatus;
  items: PrescriptionItem[];
  isPsychotropicDetected: boolean;
  totalAmount?: number;
  deliveryFee?: number;
  deliveryAddress: string;
  timestamp: string;
  quotes: Quote[];
  targetedPharmacyIds: string[];
  refusedByPharmacyIds: string[];
  acceptedByPharmacyIds: string[];
  prescriptionImageUrl?: string;
  deadline?: string;
  paymentMethod?: string;      // code du mode de paiement choisi
  paymentType?: 'online' | 'cod'; // type de paiement
}

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  distance: number;
  responseTime: number;
  stockLevel: number;
  rating: number;
  prices: Record<string, number>;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;      // classe FontAwesome (ex: 'fa-wallet') ou URL si logo présent
  code: string;      // identifiant interne (ex: 'waafi', 'cod')
  active: boolean;
  logo?: string;     // URL optionnelle pour un logo personnalisé
  type: 'online' | 'cod';
}