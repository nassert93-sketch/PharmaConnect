import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, setDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { UserRole, UserStatus, UserProfile, Order, OrderStatus, PrescriptionItem, PaymentMethod, RoutingConfig, Pharmacy } from '@/types';
import PatientApp from '@/views/PatientApp';
import PharmacyApp from '@/views/PharmacyApp';
import DriverApp from '@/views/DriverApp';
import AdminDashboard from '@/views/AdminDashboard';
import Auth from '@/views/Auth';
import HomePage from '@/views/HomePage';
import ProfileModal from '@/components/ProfileModal';
import PhoneVerificationModal from '@/components/PhoneVerificationModal';
import { ADMIN_EMAIL, DEFAULT_PAYMENT_METHODS, DEFAULT_ROUTING_CONFIG } from '@/constants';
import { t } from '@/i18n';
import { Capacitor } from '@capacitor/core';

// ── Détection du mode app (patient / pharmacy / driver) via variable d'environnement ──
const APP_MODE = import.meta.env.VITE_APP_MODE as 'patient' | 'pharmacy' | 'driver' | undefined;

const APP_MODE_TO_ROLE: Record<string, UserRole> = {
  patient:  UserRole.PATIENT,
  pharmacy: UserRole.PHARMACY,
  driver:   UserRole.DRIVER,
};

// ── Détection du rôle via sous-domaine ──
const getHostRole = (): UserRole | null => {
  const host = window.location.hostname;
  if (host === 'admin.pharmaconnect-dj.com')  return UserRole.ADMIN;
  if (host === 'shop.pharmaconnect-dj.com')   return UserRole.PHARMACY;
  return null;
};
const HOST_ROLE = getHostRole();

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<UserRole | null>(
    APP_MODE ? (APP_MODE_TO_ROLE[APP_MODE] ?? null) : null
  );
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentPharmacyId, setCurrentPharmacyId] = useState<string>('ph-1');
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<{id: string; message: string; type: 'info' | 'urgent'}[]>([]);
  const [pharmacyOnlineStatus, setPharmacyOnlineStatus] = useState<Record<string, boolean>>({});
  const [pharmacyDrafts, setPharmacyDrafts] = useState<Record<string, Record<string, PrescriptionItem[]>>>({});
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [lastOrderNumber, setLastOrderNumber] = useState<number>(20);
  const [slaMinutes, setSlaMinutes] = useState<number>(5);
  const [routingConfig, setRoutingConfig] = useState<RoutingConfig>(DEFAULT_ROUTING_CONFIG);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);


  // Charger la configuration SLA depuis Firestore
  useEffect(() => {
    if (!user) return;
    const fetchSla = async () => {
      const docRef = doc(db, 'config', 'settings');
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().slaMinutes) {
        setSlaMinutes(snap.data().slaMinutes);
      }
    };
    fetchSla();
  }, [user]);

  // Écoute de la configuration de routage — seulement si connecté
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'config', 'routing'), (snap) => {
      if (snap.exists()) {
            setRoutingConfig(snap.data() as RoutingConfig);
      } else {
            setDoc(doc(db, 'config', 'routing'), DEFAULT_ROUTING_CONFIG);
      }
    });
    return unsubscribe;
  }, []);

  // Charger les méthodes de paiement
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'config', 'paymentMethods'), (snap) => {
      if (snap.exists()) {
        setPaymentMethods(snap.data().methods);
      } else {
        setDoc(doc(db, 'config', 'paymentMethods'), { methods: DEFAULT_PAYMENT_METHODS })
          .then(() => setPaymentMethods(DEFAULT_PAYMENT_METHODS));
      }
    }, (error) => {
      if ((error as any)?.code !== "permission-denied") console.error("Erreur méthodes paiement:", error);
    });
    return unsubscribe;
  }, [user]);

  // Charger les pharmacies depuis Firestore — seulement si connecté
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'pharmacies'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pharmacy));
      setPharmacies(list);
      const status = list.reduce((acc, p) => ({ ...acc, [p.id]: p.isOnline }), {});
      setPharmacyOnlineStatus(status);
    }, (error) => {
      if ((error as any)?.code !== "permission-denied") console.error("Erreur pharmacies:", error);
    });
    return unsubscribe;
  }, [user]);

  // Charger les commandes
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData: Order[] = [];
      snapshot.forEach((doc) => {
        ordersData.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(ordersData);
    }, (error) => {
      if ((error as any)?.code !== "permission-denied") console.error("Erreur commandes:", error);
    });
    return unsubscribe;
  }, [user]);

  // Charger les brouillons pour la pharmacie courante
  useEffect(() => {
    if (!user || userProfile?.role !== UserRole.PHARMACY) return;
    const q = query(collection(db, 'pharmacyDrafts'), where('pharmacyId', '==', currentPharmacyId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const drafts: Record<string, Record<string, PrescriptionItem[]>> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        drafts[data.orderId] = { [currentPharmacyId]: data.items };
      });
      setPharmacyDrafts(drafts);
    }, (error) => {
      if ((error as any)?.code !== "permission-denied") console.error("Erreur brouillons:", error);
    });
    return unsubscribe;
  }, [user, userProfile, currentPharmacyId]);

  // Récupérer le dernier numéro de commande
  useEffect(() => {
    const fetchLastOrderNumber = async () => {
      const docRef = doc(db, 'config', 'counters');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setLastOrderNumber(snap.data().lastOrderNumber);
      } else {
        await setDoc(docRef, { lastOrderNumber: 20 });
        setLastOrderNumber(20);
      }
    };
    fetchLastOrderNumber();
  }, []);

  // Gestion de l'authentification Firebase
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeAllUsers: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser); // Toujours mettre à jour user immédiatement
      if (currentUser) {
        const adminEmails = [
          ADMIN_EMAIL,
          'nassertaheromar@gmail.com',
          'nassert93@gmail.com'
        ];
        const isSpecialAdmin = adminEmails.includes(currentUser.email?.toLowerCase() || '');
        
        if (!currentUser.emailVerified && !isSpecialAdmin) {
          await auth.signOut();
          setAuthLoading(false);
          return;
        }

        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          if (isSpecialAdmin) {
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              name: 'Admin Principal',
              email: currentUser.email || '',
              phone: '',
              role: UserRole.ADMIN,
              status: UserStatus.APPROVED,
              createdAt: new Date().toISOString(),
              soundEnabled: false
            };
            await setDoc(docRef, newProfile);
          } else {
            await auth.signOut();
            setAuthLoading(false);
            return;
          }
        }

        unsubscribeProfile = onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            let profile = snap.data() as UserProfile;
            
            if (currentUser.email?.toLowerCase() === ADMIN_EMAIL) {
              profile = { ...profile, role: UserRole.ADMIN, status: UserStatus.APPROVED };
            }

            setUserProfile(profile);

            if (!profile.phone) {
              setIsPhoneModalOpen(true);
            } else {
              setIsPhoneModalOpen(false);
            }

            if (profile.role === UserRole.ADMIN && !unsubscribeAllUsers) {
              unsubscribeAllUsers = onSnapshot(collection(db, 'users'), (querySnap) => {
                const users: UserProfile[] = [];
                querySnap.forEach((doc) => {
                  users.push(doc.data() as UserProfile);
                });
                setAllUsers(users);
              });
            }
          }
          setAuthLoading(false);
        }, (error) => {
          if ((error as any)?.code !== "permission-denied") console.error("Profile snapshot error:", error);
          setAuthLoading(false);
        });
      } else {
        setUserProfile(null);
        setAllUsers([]);
        if (unsubscribeProfile) unsubscribeProfile();
        if (unsubscribeAllUsers) unsubscribeAllUsers();
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeAllUsers) unsubscribeAllUsers();
    };
  }, []);

  const addNotification = (message: string, type: 'info' | 'urgent' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [{ id, message, type }, ...prev]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 6000);

    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(e => console.log('Erreur de lecture audio:', e));
  };

  const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, updates);
  };

  const moveToNextPharmacy = useCallback((order: Order): Order => {
    const refused = order.refusedByPharmacyIds || [];
    const accepted = order.acceptedByPharmacyIds || [];
    const currentTarget = order.targetedPharmacyIds?.[0];
    
    const updatedRefused = currentTarget ? [...refused, currentTarget] : refused;
    
    const available = pharmacies
      .filter(p => 
        pharmacyOnlineStatus[p.id] && 
        !updatedRefused.includes(p.id) &&
        !accepted.includes(p.id)
      )
      .sort((a, b) => a.distance - b.distance);
    

    if (available.length === 0) {
      addNotification(`⚠️ Aucune officine disponible pour #${order.id}`, 'urgent');
      return { ...order, status: OrderStatus.CANCELLED, targetedPharmacyIds: [], refusedByPharmacyIds: updatedRefused };
    }

    const nextPharmacy = available[0];
    const newDeadline = new Date();
    newDeadline.setMinutes(newDeadline.getMinutes() + slaMinutes);
    console.log(`🔄 Transfert vers ${nextPharmacy.name} avec deadline ${newDeadline.toISOString()} (${slaMinutes} min)`);
    addNotification(`🔄 Transfert: #${order.id} vers une nouvelle pharmacie`, 'info');
    
    return {
      ...order,
      deadline: newDeadline.toISOString(),
      targetedPharmacyIds: [nextPharmacy.id],
      refusedByPharmacyIds: updatedRefused,
    };
  }, [pharmacyOnlineStatus, addNotification, slaMinutes, pharmacies]);

  const handlePharmacyRefusal = async (orderId: string, pharmacyId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const orderWithRefusal = { ...order, refusedByPharmacyIds: [...(order.refusedByPharmacyIds || []), pharmacyId] };
    const updatedOrder = moveToNextPharmacy(orderWithRefusal);
    await updateOrder(orderId, updatedOrder);
  };

  const handlePharmacyAcceptance = async (orderId: string, pharmacyId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (order.routingMode === 'broadcast') {
      await updateOrder(orderId, {
        acceptedByPharmacyIds: [...(order.acceptedByPharmacyIds || []), pharmacyId]
      });
      addNotification(`📝 Vous pouvez maintenant saisir votre devis`, 'info');
    } else {
      await updateOrder(orderId, {
        pharmacyId,
        pharmacyName: pharmacies.find(p => p.id === pharmacyId)?.name,
        acceptedByPharmacyIds: [pharmacyId]
      });
      addNotification(`✅ Mission verrouillée par l'officine`, 'info');
    }
  };

  const handleTogglePharmacy = async (pharmacyId: string) => {
    const pharmacyRef = doc(db, 'pharmacies', pharmacyId);
    const currentStatus = pharmacyOnlineStatus[pharmacyId];
    await updateDoc(pharmacyRef, { isOnline: !currentStatus });
  };

  // Vérification des commandes expirées (toutes les 2 secondes)
  useEffect(() => {
    // Vérification stricte : user doit être connecté et authLoading terminé
    if (!user || authLoading) return;

    const checkExpiredOrders = async () => {
      // Double vérification auth avant chaque requête
      if (!auth.currentUser) return;
      
      const now = new Date();
      const q = query(
        collection(db, 'orders'),
        where('status', '==', OrderStatus.AWAITING_QUOTES),
        where('pharmacyId', '==', null),
        where('deadline', '<', now.toISOString())
      );
      
      try {
        const snapshot = await getDocs(q);
        
        for (const docSnap of snapshot.docs) {
          const order = { id: docSnap.id, ...docSnap.data() } as Order;
          
          if (order.quotes && order.quotes.length > 0) continue;
          
          const currentTarget = order.targetedPharmacyIds?.[0];
          const updatedOrder = moveToNextPharmacy({
            ...order,
            refusedByPharmacyIds: currentTarget 
              ? [...(order.refusedByPharmacyIds || []), currentTarget]
              : order.refusedByPharmacyIds
          });
          
          await updateOrder(order.id, updatedOrder);
        }
      } catch (error) {
        // Ignorer silencieusement les erreurs de permission
        if ((error as any)?.code !== 'permission-denied') {
          console.error("Erreur lors de la vérification des commandes expirées:", error);
        }
      }
    };

    const interval = setInterval(checkExpiredOrders, 5000);
    checkExpiredOrders();
    return () => clearInterval(interval);
  }, [user, authLoading]);

  const addOrder = async (orderData: any): Promise<boolean> => {
    const onlinePharmacies = pharmacies.filter(p => pharmacyOnlineStatus[p.id]);
    if (onlinePharmacies.length === 0) {
      addNotification('❌ Aucune pharmacie disponible', 'urgent');
      return false;
    }

    const sorted = [...onlinePharmacies].sort((a, b) => a.distance - b.distance);

    let targetedIds: string[] = [];
    if (routingConfig.mode === 'round-robin') {
      targetedIds = [sorted[0].id];
    } else {
      const count = Math.min(routingConfig.broadcastCount, sorted.length);
      targetedIds = sorted.slice(0, count).map(p => p.id);
    }

    const deadline = new Date();
    deadline.setMinutes(deadline.getMinutes() + slaMinutes);

    const counterRef = doc(db, 'config', 'counters');
    const newOrderNumber = lastOrderNumber + 1;
    await setDoc(counterRef, { lastOrderNumber: newOrderNumber }, { merge: true });
    setLastOrderNumber(newOrderNumber);

    const newOrder: Order = {
      id: `CMD-${newOrderNumber}`,
      patientId: orderData.patientId,
      patientName: orderData.patientName,
      pharmacyId: null,
      status: OrderStatus.AWAITING_QUOTES,
      items: orderData.items || [],
      isPsychotropicDetected: orderData.isPsychotropicDetected || false,
      deliveryAddress: orderData.deliveryAddress || 'Djibouti-Ville',
      timestamp: new Date().toISOString(),
      quotes: orderData.quotes || [],
      targetedPharmacyIds: targetedIds,
      refusedByPharmacyIds: [],
      acceptedByPharmacyIds: [],
      prescriptionImageUrl: orderData.prescriptionImageUrl,
      deadline: deadline.toISOString(),
      routingMode: routingConfig.mode,
    };

    await setDoc(doc(db, 'orders', newOrder.id), newOrder);
    addNotification(`🚀 Ordonnance ${newOrder.id} transmise`, 'info');
    return true;
  };

  const handleUpdatePaymentMethods = async (methods: PaymentMethod[]) => {
    await setDoc(doc(db, 'config', 'paymentMethods'), { methods });
    setPaymentMethods(methods);
  };

  const handleUpdateRoutingConfig = async (newConfig: RoutingConfig) => {
    await setDoc(doc(db, 'config', 'routing'), newConfig);
  };

  const handleSlaMinutesChange = async (minutes: number) => {
    setSlaMinutes(minutes);
    await setDoc(doc(db, 'config', 'settings'), { slaMinutes: minutes }, { merge: true });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSelectedApp(null);
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  const handleUpdateDraft = async (orderId: string, pharmacyId: string, items: PrescriptionItem[]) => {
    const draftRef = doc(db, 'pharmacyDrafts', `${orderId}_${pharmacyId}`);
    await setDoc(draftRef, { orderId, pharmacyId, items });
  };

  const handleProfileUpdate = (updated: UserProfile) => {
    setUserProfile(updated);
  };

  const handlePhoneModalClose = (updatedProfile: UserProfile) => {
    setUserProfile(updatedProfile);
    setIsPhoneModalOpen(false);
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Chargement...</p>
        </div>
      </div>
    );
  }


  // ========== GESTION DE L'UTILISATEUR NON CONNECTÉ ==========
  if (!user) {
    const platform = Capacitor.getPlatform();

    // ----- Cas mobile (Android / iOS) -----
    if (platform === 'android' || platform === 'ios') {
      // Si le mode est défini via le build (patient, pharmacy, driver), on force ce rôle
      if (APP_MODE && APP_MODE_TO_ROLE[APP_MODE]) {
        const forcedRole = APP_MODE_TO_ROLE[APP_MODE];
        return <Auth targetRole={forcedRole} onAuthSuccess={(u, p) => {
              setUser(u);
              let profile = p;
              if (u.email?.toLowerCase() === ADMIN_EMAIL) {
                profile = { ...p, role: UserRole.ADMIN, status: UserStatus.APPROVED };
              }
              setUserProfile(profile);
            }} />;
      } else {
        // Fallback (ne devrait pas arriver) → patient
        return <Auth targetRole={UserRole.PATIENT} onAuthSuccess={(u, p) => {
              setUser(u);
              let profile = p;
              if (u.email?.toLowerCase() === ADMIN_EMAIL) {
                profile = { ...p, role: UserRole.ADMIN, status: UserStatus.APPROVED };
              }
              setUserProfile(profile);
            }} />;
      }
    }

    // ----- Cas web -----
    if (selectedApp !== null && selectedApp !== undefined) {
      return <Auth targetRole={selectedApp} onAuthSuccess={(u, p) => {
            setUser(u);
            let profile = p;
            if (u.email?.toLowerCase() === ADMIN_EMAIL) {
              profile = { ...p, role: UserRole.ADMIN, status: UserStatus.APPROVED };
            }
            setUserProfile(profile);
          }} />;
    }

    if (HOST_ROLE) {
      return <Auth targetRole={HOST_ROLE} onAuthSuccess={(u, p) => {
            setUser(u);
            let profile = p;
            if (u.email?.toLowerCase() === ADMIN_EMAIL) {
              profile = { ...p, role: UserRole.ADMIN, status: UserStatus.APPROVED };
            }
            setUserProfile(profile);
            setSelectedApp(HOST_ROLE);
          }} />;
    }

    if (APP_MODE) {
      const forcedRole = APP_MODE_TO_ROLE[APP_MODE];
      return <Auth targetRole={forcedRole} onAuthSuccess={(u, p) => {
            setUser(u);
            setUserProfile(p);
            setSelectedApp(forcedRole);
          }} />;
    }

    return (
      <HomePage
        onLogin={() => setSelectedApp(UserRole.PATIENT)}
        onRegister={() => setSelectedApp(UserRole.PATIENT)}
      />
    );
  }

  // ========== UTILISATEUR CONNECTÉ MAIS EN ATTENTE / REFUSÉ ==========
  if (userProfile && userProfile.status === UserStatus.PENDING) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white w-full max-w-md rounded-[32px] p-10 shadow-xl border border-slate-100 text-center">
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-hourglass-half text-3xl"></i>
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">Compte en attente</h2>
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
            Votre inscription en tant que <span className="text-blue-600 font-black">{userProfile.role === UserRole.PHARMACY ? 'Pharmacien' : 'Livreur'}</span> doit être validée par un superviseur. Vous recevrez un email dès que votre compte sera activé.
          </p>
          <button onClick={handleLogout} className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-xs tracking-widest transition-all">
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (userProfile && userProfile.status === UserStatus.REJECTED) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white w-full max-w-md rounded-[32px] p-10 shadow-xl border border-slate-100 text-center">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-circle-xmark text-3xl"></i>
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">Compte refusé</h2>
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
            Désolé, votre demande d'adhésion a été refusée par nos superviseurs. Veuillez contacter le support pour plus d'informations.
          </p>
          <button onClick={handleLogout} className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-xs tracking-widest transition-all">
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // ========== VÉRIFICATION DU TÉLÉPHONE ==========
  if (userProfile && isPhoneModalOpen) {
    return <PhoneVerificationModal profile={userProfile} onClose={handlePhoneModalClose} />;
  }

  // ========== VÉRIFICATION DES ACCÈS PAR SOUS-DOMAINE (web uniquement) ==========
  const host = window.location.hostname;
  if (host === 'admin.pharmaconnect-dj.com' && userProfile?.role !== UserRole.ADMIN) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white w-full max-w-md rounded-[32px] p-10 shadow-xl border border-slate-100 text-center">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-circle-exclamation text-3xl"></i>
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">Accès restreint</h2>
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
            Cette section est réservée aux administrateurs. Vous allez être redirigé vers votre espace.
          </p>
          <button 
            onClick={() => window.location.href = 'https://pharmaconnect-dj.com'} 
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all"
          >
            Retour à l'accueil
          </button>
          <button 
            onClick={handleLogout} 
            className="w-full mt-3 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (host === 'shop.pharmaconnect-dj.com' && userProfile?.role !== UserRole.PHARMACY) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white w-full max-w-md rounded-[32px] p-10 shadow-xl border border-slate-100 text-center">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-circle-exclamation text-3xl"></i>
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4">Accès restreint</h2>
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
            Cette section est réservée aux pharmacies. Vous allez être redirigé vers votre espace.
          </p>
          <button 
            onClick={() => window.location.href = 'https://pharmaconnect-dj.com'} 
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all"
          >
            Retour à l'accueil
          </button>
          <button 
            onClick={handleLogout} 
            className="w-full mt-3 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // ========== UTILISATEUR CONNECTÉ ET APPROUVÉ ==========
  let effectiveRole = userProfile?.role || UserRole.PATIENT;

  if (selectedApp !== null) {
    if (userProfile?.role === UserRole.ADMIN || user?.email?.toLowerCase() === ADMIN_EMAIL) {
      effectiveRole = selectedApp;
    } else {
      effectiveRole = userProfile?.role || UserRole.PATIENT;
      }
  }


  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans text-slate-900">
      <header className="h-20 bg-white border-b-2 border-slate-100 px-8 flex items-center justify-between z-[100] shrink-0">
        <div className="flex items-center gap-5">
          <img src="/logo.png" alt="PharmaConnect Logo" className="w-12 h-12 object-contain" />
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-slate-900 tracking-tighter">PharmaConnect</h1>
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.3em] italic">Hub National Djibouti</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {(userProfile?.role === UserRole.ADMIN || user?.email?.toLowerCase() === ADMIN_EMAIL) && (
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              {[
                { r: UserRole.PATIENT, icon: 'fa-user', label: 'Patient' },
                { r: UserRole.PHARMACY, icon: 'fa-mortar-pestle', label: 'Pharma' },
                { r: UserRole.DRIVER, icon: 'fa-motorcycle', label: 'Livreur' },
                { r: UserRole.ADMIN, icon: 'fa-chart-pie', label: 'Admin' }
              ].map(({ r, icon, label }) => (
                <button
                  key={r}
                  onClick={() => setSelectedApp(r)}
                  className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase transition-all flex items-center gap-2 ${
                    effectiveRole === r ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <i className={`fa-solid ${icon}`}></i>
                  <span className="hidden lg:inline">{label}</span>
                </button>
              ))}
            </div>
          )}

          {userProfile?.role !== UserRole.PATIENT && (
            <div className="flex items-center gap-4 pl-6 border-l border-slate-200">
              <button onClick={() => setIsProfileModalOpen(true)} className="text-right hidden sm:block hover:opacity-70">
                <p className="text-xs font-black text-slate-900 leading-none">{userProfile?.name}</p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase">{userProfile?.role}</p>
                  {user.email?.toLowerCase() === ADMIN_EMAIL && (
                    <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-black uppercase">Admin Verified</span>
                  )}
                </div>
              </button>
              <button onClick={() => setIsProfileModalOpen(true)} className="relative group">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm" />
                ) : (
                  <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center text-slate-500">
                    <i className="fa-solid fa-user"></i>
                  </div>
                )}
              </button>
              <button onClick={handleLogout} className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-100">
                <i className="fa-solid fa-right-from-bracket"></i>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 w-full max-w-lg pointer-events-none px-4">
        {notifications.map(n => (
          <div key={n.id} className="p-4 rounded-2xl shadow-xl border-2 animate-in slide-in-from-top duration-500 pointer-events-auto flex items-center gap-4 bg-white border-blue-50 text-blue-900 font-black text-[11px] uppercase">
            {n.message}
          </div>
        ))}
      </div>

      <main className="flex-1 overflow-hidden relative">
        {isProfileModalOpen && userProfile && (
          <ProfileModal profile={userProfile} onClose={() => setIsProfileModalOpen(false)} onUpdate={handleProfileUpdate} />
        )}
        {effectiveRole === UserRole.PATIENT && (
          <PatientApp
            t={t}
            onNewOrder={addOrder}
            orders={orders}
            onUpdateOrder={updateOrder}
            activeOrderId={activeOrderId}
            setActiveOrderId={setActiveOrderId}
            addNotification={addNotification}
            paymentMethods={paymentMethods}
            mockUser={{
              uid: user.uid,
              name: user.displayName || 'Utilisateur',
              photoURL: user.photoURL
            }}
            onLogout={handleLogout}
            onOpenProfileModal={() => setIsProfileModalOpen(true)}
          />
        )}
        {effectiveRole === UserRole.PHARMACY && (
          <PharmacyApp
            t={t}
            orders={orders}
            onUpdateOrder={updateOrder}
            drafts={pharmacyDrafts}
            onUpdateDraft={handleUpdateDraft}
            onRefuseOrder={handlePharmacyRefusal}
            onAcceptOrder={handlePharmacyAcceptance}
            onlineStatus={pharmacyOnlineStatus}
            onToggleStatus={handleTogglePharmacy}
            currentPharmacyId={currentPharmacyId}
            onSetCurrentPharmacy={setCurrentPharmacyId}
            user={userProfile!}
            users={allUsers}
            addNotification={addNotification}
            pharmacies={pharmacies}
          />
        )}
        {effectiveRole === UserRole.DRIVER && (
          <DriverApp
            t={t}
            orders={orders}
            onUpdateOrder={updateOrder}
            user={userProfile!}
            users={allUsers}
            addNotification={addNotification}
          />
        )}
        {effectiveRole === UserRole.ADMIN && (
          <AdminDashboard
            t={t}
            orders={orders}
            pharmacyOnlineStatus={pharmacyOnlineStatus}
            pharmacyOfflineSince={{}}
            onTogglePharmacy={handleTogglePharmacy}
            deactivatedDriverIds={new Set()}
            onToggleDriver={() => {}}
            deliveryZones={[]}
            onUpdateZones={() => {}}
            slaMinutes={slaMinutes}
            onSlaMinutesChange={handleSlaMinutesChange}
            paymentMethods={paymentMethods}
            onUpdatePaymentMethods={handleUpdatePaymentMethods}
            users={allUsers}
            onSwitchRole={(r) => setSelectedApp(r)}
            routingConfig={routingConfig}
            onUpdateRoutingConfig={handleUpdateRoutingConfig}
            pharmacies={pharmacies}
          />
        )}
      </main>
    </div>
  );
};

export default App;