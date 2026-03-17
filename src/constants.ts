import { PaymentMethod, RoutingConfig } from './types';

export const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string) || 'nassert93@gmail.com';

export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: '1', name: 'Waafi',                icon: 'fa-wallet',      code: 'waafi',  active: true, type: 'online' },
  { id: '2', name: 'D-Money',              icon: 'fa-money-bill',  code: 'dmoney', active: true, type: 'online' },
  { id: '3', name: 'Cac Pay',              icon: 'fa-credit-card', code: 'cacpay', active: true, type: 'online' },
  { id: '4', name: 'Paiement à la livraison', icon: 'fa-truck',   code: 'cod',    active: true, type: 'cod'    },
];

export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  mode: 'round-robin',
  broadcastCount: 3,
};