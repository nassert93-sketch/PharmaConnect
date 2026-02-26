
import { Pharmacy, Order, OrderStatus } from "./types";

export const MOCK_PHARMACIES: Pharmacy[] = [
  { 
    id: 'ph-1', 
    name: 'Pharmacie de la Paix', 
    address: 'Quartier 4, Djibouti-Ville', 
    distance: 1.2, 
    responseTime: 8, 
    stockLevel: 95, 
    rating: 4.8,
    prices: { "Amoxicilline": 450, "Paracetamol": 120, "Insuline": 1500 }
  },
  { 
    id: 'ph-2', 
    name: 'Pharmacie Centrale', 
    address: 'Place Lagarde, Plateau', 
    distance: 2.5, 
    responseTime: 12, 
    stockLevel: 100, 
    rating: 4.5,
    prices: { "Amoxicilline": 420, "Paracetamol": 100, "Insuline": 1450 }
  },
  { 
    id: 'ph-3', 
    name: 'Pharmacie d\'Héron', 
    address: 'Rue d\'Éthiopie, Héron', 
    distance: 0.8, 
    responseTime: 5, 
    stockLevel: 70, 
    rating: 4.9,
    prices: { "Amoxicilline": 480, "Paracetamol": 150, "Insuline": 1600 }
  },
];

export const INITIAL_ORDERS: Order[] = [];
