// ==================== src/types.ts ====================
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
  name: string;
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
  // Coordonnées GPS (optionnel)
  location?: {
    lat: number;
    lng: number;
    updatedAt?: string;
  };
  // Préférence notifications sonores
  soundEnabled?: boolean;
  // Pharmacie de garde
  isOnDuty?: boolean;
  dutyNote?: string;          // note optionnelle ex: "Garde de nuit jusqu'à 6h"
  // Horaires d'ouverture
  openingHours?: OpeningHours;
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
  pharmacyAddress?: string;
  items: PrescriptionItem[];
  totalAmount: number;
  deliveryFee: number;
  estimatedTime: number;
  isDeliveryBlocked?: boolean;
  isOnDuty?: boolean;         // pharmacie de garde au moment du devis
  isOpenNow?: boolean;        // pharmacie ouverte au moment du devis
}

export interface Order {
  id: string;
  patientId: string;
  patientName: string;
  pharmacyId?: string | null;
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
  paymentMethod?: string;
  paymentType?: 'online' | 'cod';
  routingMode?: 'round-robin' | 'broadcast';
  patientLocation?: {
    lat: number;
    lng: number;
  };
  driverLocation?: {
    lat: number;
    lng: number;
    updatedAt?: string;
  };
  pharmacyAddress?: string;  // adresse de la pharmacie pour le livreur
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
  lat?: number;
  lng?: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  code: string;
  active: boolean;
  logo?: string;
  type: 'online' | 'cod';
}

// ─── Horaires d'ouverture ─────────────────────────────────────────────────────
export interface DaySchedule {
  closed: boolean;
  open: string;   // format "08:00"
  close: string;  // format "20:00"
}

export interface OpeningHours {
  monday:    DaySchedule;
  tuesday:   DaySchedule;
  wednesday: DaySchedule;
  thursday:  DaySchedule;
  friday:    DaySchedule;
  saturday:  DaySchedule;
  sunday:    DaySchedule;
}

// ─── Notification interne (pharmacie / livreur) ───────────────────────────────
export interface PushNotification {
  id?: string;
  targetUid?: string;        // UID spécifique (pharmacie)
  targetRole?: string;       // 'DRIVER' pour tous les livreurs
  type: 'ORDER_CONFIRMED' | 'PICKUP_READY' | 'ORDER_ASSIGNED';
  title: string;
  message: string;
  orderId: string;
  pharmacyName?: string;
  pharmacyAddress?: string;
  patientName?: string;
  totalAmount?: number;
  read: boolean;
  createdAt: string;
}

export interface RoutingConfig {
  mode: 'round-robin' | 'broadcast';
  broadcastCount: number;
}