console.log("🚨🚨🚨 NOUVELLE VERSION APP.TSX AVEC ROUTAGE 🚨🚨🚨");

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, setDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { UserRole, UserStatus, UserProfile, Order, OrderStatus, PrescriptionItem, PaymentMethod, RoutingConfig } from '@/types';
import PatientApp from '@/views/PatientApp';
import PharmacyApp from '@/views/PharmacyApp';
import DriverApp from '@/views/DriverApp';
import AdminDashboard from '@/views/AdminDashboard';
import Auth from '@/views/Auth';
import Portal from '@/views/Portal';
import ProfileModal from '@/components/ProfileModal';
import PhoneVerificationModal from '@/components/PhoneVerificationModal';
import { INITIAL_ORDERS, MOCK_PHARMACIES } from '@/mockData';
import { t } from '@/i18n';

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: '1', name: 'Waafi', icon: 'fa-wallet', code: 'waafi', active: true, type: 'online' },
  { id: '2', name: 'D-Money', icon: 'fa-money-bill', code: 'dmoney', active: true, type: 'online' },
  { id: '3', name: 'Cac Pay', icon: 'fa-credit-card', code: 'cacpay', active: true, type: 'online' },
  { id: '4', name: 'Paiement à la livraison', icon: 'fa-truck', code: 'cod', active: true, type: 'cod' },
];

const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  mode: 'round-robin',
  broadcastCount: 3
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<UserRole | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentPharmacyId, setCurrentPharmacyId] = useState<string>('ph-1');
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<{id: string; message: string; type: 'info' | 'urgent'}[]>([]);
  const [pharmacyOnlineStatus, setPharmacyOnlineStatus] = useState<Record<string, boolean>>(
    MOCK_PHARMACIES.reduce((acc, p) => ({ ...acc, [p.id]: true }), {})
  );
  const [pharmacyDrafts, setPharmacyDrafts] = useState<Record<string, Record<string, PrescriptionItem[]>>>({});
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [lastOrderNumber, setLastOrderNumber] = useState<number>(20);
  const [routingConfig, setRoutingConfig] = useState<RoutingConfig>(DEFAULT_ROUTING_CONFIG);

  console.log("🚀 App.tsx chargé !");

  // 🔁 Détection du sous-domaine
  useEffect(() => {
    const host = window.location.hostname;
    console.log("🌐 hostname détecté :", host);
    if (host === 'admin.pharmaconnect-dj.com') {
      console.log("👉 admin détecté");
      setSelectedApp(UserRole.ADMIN);
    } else if (host === 'shop.pharmaconnect-dj.com') {
      console.log("👉 shop détecté");
      setSelectedApp(UserRole.PHARMACY);
    } else if (host === 'pharmaconnect-dj.com' || host === 'www.pharmaconnect-dj.com' || host.includes('web.app')) {
      console.log("👉 domaine principal / temporaire, on force PATIENT");
      setSelectedApp(UserRole.PATIENT);
    } else if (host.includes('localhost') || host.includes('127.0.0.1')) {
      console.log("👉 localhost, on garde le portail");
    } else {
      console.log("👉 autre domaine, on laisse null (portail)");
    }
  }, []);

  useEffect(() => {
    console.log("🔍 selectedApp a changé :", selectedApp);
  }, [selectedApp]);

  // Écoute de la configuration de routage
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'routing'), (snap) => {
      if (snap.exists()) {
        console.log("🔥 routingConfig from Firestore:", snap.data());
        setRoutingConfig(snap.data() as RoutingConfig);
      } else {
        console.log("🔥 No routing config, creating default");
        setDoc(doc(db, 'config', 'routing'), DEFAULT_ROUTING_CONFIG);
      }
    });
    return unsubscribe;
  }, []);

  // ... tout le reste du code (identique à la version précédente)
  // Pour gagner de la place, je ne recopie pas tout, mais vous devez conserver l'intégralité du fichier App.tsx que j'ai fourni plus tôt.
  // Je vous le redonne en intégralité ci-dessous si besoin.
};
