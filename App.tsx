import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, setDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { UserRole, UserStatus, UserProfile, Order, OrderStatus, PrescriptionItem, PaymentMethod } from '@/types';
import PatientApp from '@/views/PatientApp';
import PharmacyApp from '@/views/PharmacyApp';
import DriverApp from '@/views/DriverApp';
import AdminDashboard from '@/views/AdminDashboard';
import Auth from '@/views/Auth';
import Portal from '@/views/Portal';
import ProfileModal from '@/components/ProfileModal';
import { INITIAL_ORDERS, MOCK_PHARMACIES } from '@/mockData';
import { t } from '@/i18n';

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: '1', name: 'Waafi', icon: 'fa-wallet', code: 'waafi', active: true, type: 'online' },
  { id: '2', name: 'D-Money', icon: 'fa-money-bill', code: 'dmoney', active: true, type: 'online' },
  { id: '3', name: 'Cac Pay', icon: 'fa-credit-card', code: 'cacpay', active: true, type: 'online' },
  { id: '4', name: 'Paiement à la livraison', icon: 'fa-truck', code: 'cod', active: true, type: 'cod' },
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
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

  // 🔁 Détection du sous-domaine pour forcer l'application cible
  useEffect(() => {
    const host = window.location.hostname;
    console.log("🌐 hostname détecté :", host);
    if (host === 'admin.pharmaconnect-dj.com') {
      console.log("👉 admin détecté");
      setSelectedApp(UserRole.ADMIN);
    } else if (host === 'shop.pharmaconnect-dj.com') {
      console.log("👉 shop détecté");
      setSelectedApp(UserRole.PHARMACY);
    } else if (host.includes('localhost') || host.includes('127.0.0.1')) {
      console.log("👉 localhost, on garde le portail");
      // rien
    } else {
      // Pour tous les autres domaines (pharmaconnect-dj.com, www.pharmaconnect-dj.com, l'URL temporaire Firebase, etc.)
      console.log("👉 autre domaine, on force PATIENT");
      setSelectedApp(UserRole.PATIENT);
    }
  }, []);

  // Charger les méthodes de paiement depuis Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'paymentMethods'), (snap) => {
      if (snap.exists()) {
        setPaymentMethods(snap.data().methods);
      } else {
        setDoc(doc(db, 'config', 'paymentMethods'), { methods: DEFAULT_PAYMENT_METHODS })
          .then(() => setPaymentMethods(DEFAULT_PAYMENT_METHODS));
      }
    });
    return unsubscribe;
  }, []);

  // Charger les commandes depuis Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData: Order[] = [];
      snapshot.forEach((doc) => {
        ordersData.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(ordersData);
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
    });
    return unsubscribe;
  }, [user, userProfile, currentPharmacyId]);

  // Récupérer le dernier numéro de commande depuis Firestore
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
      setUser(currentUser);
      
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          const isSpecialAdmin = currentUser.email?.toLowerCase() === 'nassert93@gmail.com';
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            name: currentUser.displayName || (isSpecialAdmin ? 'Admin Principal' : 'Utilisateur'),
            email: currentUser.email || '',
            phone: '',
            role: isSpecialAdmin ? UserRole.ADMIN : UserRole.PATIENT,
            status: UserStatus.APPROVED,
            createdAt: new Date().toISOString()
          };
          await setDoc(docRef, newProfile);
        }

        unsubscribeProfile = onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            let profile = snap.data() as UserProfile;
            
            if (currentUser.email?.toLowerCase() === 'nassert93@gmail.com') {
              profile = { ...profile, role: UserRole.ADMIN, status: UserStatus.APPROVED };
            }

            setUserProfile(profile);

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
          console.error("Profile snapshot error:", error);
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
  };

  const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, updates);
  };

  const moveToNextPharmacy = useCallback((order: Order): Order => {
    const refused = order.refusedByPharmacyIds || [];
    const nextPharmacy = MOCK_PHARMACIES
      .filter(p => pharmacyOnlineStatus[p.id] && !refused.includes(p.id))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!nextPharmacy) {
      addNotification(`⚠️ Aucune officine disponible pour #${order.id}`, 'urgent');
      return { ...order, status: OrderStatus.CANCELLED, targetedPharmacyIds: [] };
    }
    const newDeadline = new Date();
    newDeadline.setMinutes(newDeadline.getMinutes() + 5);
    addNotification(`🔄 Transfert: #${order.id} vers ${nextPharmacy.name}`, 'info');
    return {
      ...order,
      deadline: newDeadline.toISOString(),
      targetedPharmacyIds: [nextPharmacy.id],
      refusedByPharmacyIds: refused
    };
  }, [pharmacyOnlineStatus, addNotification]);

  const handlePharmacyRefusal = async (orderId: string, pharmacyId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const orderWithRefusal = { ...order, refusedByPharmacyIds: [...(order.refusedByPharmacyIds || []), pharmacyId] };
    const updatedOrder = moveToNextPharmacy(orderWithRefusal);
    await updateOrder(orderId, updatedOrder);
  };

  const handlePharmacyAcceptance = async (orderId: string, pharmacyId: string) => {
    await updateOrder(orderId, {
      pharmacyId,
      pharmacyName: MOCK_PHARMACIES.find(p => p.id === pharmacyId)?.name,
      acceptedByPharmacyIds: [pharmacyId]
    });
    addNotification(`✅ Mission verrouillée par l'officine`, 'info');
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();
      const q = query(
        collection(db, 'orders'),
        where('status', '==', OrderStatus.AWAITING_QUOTES),
        where('pharmacyId', '==', null),
        where('deadline', '<', now.toISOString())
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(async (docSnap) => {
        const order = { id: docSnap.id, ...docSnap.data() } as Order;
        const currentTarget = order.targetedPharmacyIds?.[0];
        if (currentTarget) {
          const updatedOrder = {
            ...order,
            refusedByPharmacyIds: [...(order.refusedByPharmacyIds || []), currentTarget]
          };
          const nextOrder = moveToNextPharmacy(updatedOrder);
          await updateOrder(order.id, nextOrder);
        } else {
          await updateOrder(order.id, { status: OrderStatus.CANCELLED, targetedPharmacyIds: [] });
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [moveToNextPharmacy]);

  const addOrder = async (orderData: any): Promise<boolean> => {
    const topPharmacy = MOCK_PHARMACIES
      .filter(p => pharmacyOnlineStatus[p.id])
      .sort((a, b) => a.distance - b.distance)[0];
    if (!topPharmacy) {
      addNotification('❌ Aucune pharmacie disponible', 'urgent');
      return false;
    }
    const deadline = new Date();
    deadline.setMinutes(deadline.getMinutes() + 5);
    
    const counterRef = doc(db, 'config', 'counters');
    const newOrderNumber = lastOrderNumber + 1;
    await setDoc(counterRef, { lastOrderNumber: newOrderNumber }, { merge: true });
    setLastOrderNumber(newOrderNumber);

    const newOrder: Order = {
      id: `CMD-${newOrderNumber}`,
      patientId: orderData.patientId,
      patientName: orderData.patientName,
      status: OrderStatus.AWAITING_QUOTES,
      items: orderData.items || [],
      isPsychotropicDetected: orderData.isPsychotropicDetected || false,
      deliveryAddress: orderData.deliveryAddress || 'Djibouti-Ville',
      timestamp: new Date().toISOString(),
      quotes: orderData.quotes || [],
      targetedPharmacyIds: [topPharmacy.id],
      refusedByPharmacyIds: [],
      acceptedByPharmacyIds: [],
      prescriptionImageUrl: orderData.prescriptionImageUrl,
      deadline: deadline.toISOString(),
    };

    await setDoc(doc(db, 'orders', newOrder.id), newOrder);
    addNotification(`🚀 Ordonnance ${newOrder.id} transmise`, 'info');
    return true;
  };

  const handleUpdatePaymentMethods = async (methods: PaymentMethod[]) => {
    await setDoc(doc(db, 'config', 'paymentMethods'), { methods });
    setPaymentMethods(methods);
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

  // Si l'utilisateur n'est pas connecté et qu'un rôle cible est défini (via le sous-domaine), on affiche la page de connexion adaptée
  if (!user) {
    if (selectedApp) {
      return (
        <div className="relative">
          <button 
            onClick={() => setSelectedApp(null)}
            className="fixed top-6 left-6 z-[100] flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:text-blue-600 transition-all shadow-sm"
          >
            <i className="fa-solid fa-arrow-left"></i>
            Retour au portail
          </button>
          <Auth 
            targetRole={selectedApp} 
            onAuthSuccess={(u, p) => { 
              setUser(u); 
              let profile = p;
              if (u.email?.toLowerCase() === 'nassert93@gmail.com') {
                profile = { ...p, role: UserRole.ADMIN, status: UserStatus.APPROVED };
              }
              setUserProfile(profile); 
            }} 
          />
        </div>
      );
    } else {
      return <Portal onSelectApp={(role) => setSelectedApp(role)} />;
    }
  }

  // Gestion des statuts pending/rejected
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
          <button 
            onClick={handleLogout}
            className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
          >
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
          <button 
            onClick={handleLogout}
            className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // Utilisateur connecté, on détermine le rôle à afficher
  // Si un sous-domaine a forcé un rôle, on l'utilise en priorité, sinon on prend le rôle du profil
  const effectiveRole = selectedApp || userProfile?.role || UserRole.PATIENT;

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans text-slate-900">
      <header className="h-20 bg-white border-b-2 border-slate-100 px-8 flex items-center justify-between z-[100] shrink-0">
        <div className="flex items-center gap-5">
          <img 
            src="/logo.png" 
            alt="PharmaConnect Logo" 
            className="w-12 h-12 object-contain"
          />
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{t.common.hub_name}</h1>
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.3em] mt-1 italic">{t.common.hub_subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {(userProfile?.role === UserRole.ADMIN || user?.email?.toLowerCase() === 'nassert93@gmail.com') && (
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
                  title={label}
                >
                  <i className={`fa-solid ${icon}`}></i>
                  <span className="hidden lg:inline">{label}</span>
                </button>
              ))}
            </div>
          )}
          
          <div className="flex items-center gap-4 pl-6 border-l border-slate-200">
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="text-right hidden sm:block hover:opacity-70 transition-opacity"
            >
              <p className="text-xs font-black text-slate-900 leading-none">{userProfile?.name || 'Utilisateur'}</p>
              <div className="flex items-center justify-end gap-2 mt-1">
                <p className="text-[9px] font-black text-slate-400 uppercase">{userProfile?.role}</p>
                {user.email?.toLowerCase() === 'nassert93@gmail.com' && (
                  <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-black uppercase">Admin Verified</span>
                )}
              </div>
            </button>
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="relative group"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm group-hover:border-blue-200 transition-all" />
              ) : (
                <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-slate-300 transition-all">
                  <i className="fa-solid fa-user"></i>
                </div>
              )}
            </button>
            <button 
              onClick={handleLogout}
              className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors"
              title="Déconnexion"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
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
          <ProfileModal 
            profile={userProfile} 
            onClose={() => setIsProfileModalOpen(false)}
            onUpdate={(updated) => setUserProfile(updated)}
          />
        )}
        {effectiveRole === UserRole.PATIENT && (
          <PatientApp
            t={t}
            onNewOrder={addOrder}
            orders={orders}
            onUpdateOrder={updateOrder}
            step="tracking"
            setStep={() => {}}
            activeOrderId={activeOrderId}
            setActiveOrderId={setActiveOrderId}
            addNotification={addNotification}
            paymentMethods={paymentMethods}
            mockUser={{
              uid: user.uid,
              name: user.displayName || 'Utilisateur',
              photoURL: user.photoURL
            }}
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
            onToggleStatus={pid => setPharmacyOnlineStatus(prev => ({ ...prev, [pid]: !prev[pid] }))}
            currentPharmacyId={currentPharmacyId}
            onSetCurrentPharmacy={setCurrentPharmacyId}
            user={{
              uid: user.uid,
              name: user.displayName || 'Pharmacien',
              photoURL: user.photoURL
            }}
          />
        )}
        {effectiveRole === UserRole.DRIVER && (
          <DriverApp 
            t={t} 
            orders={orders} 
            onUpdateOrder={updateOrder} 
            user={{
              uid: user.uid,
              name: user.displayName || 'Livreur',
              photoURL: user.photoURL
            }}
          />
        )}
        {effectiveRole === UserRole.ADMIN && (
          <AdminDashboard
            t={t}
            orders={orders}
            pharmacyOnlineStatus={pharmacyOnlineStatus}
            pharmacyOfflineSince={{}}
            onTogglePharmacy={pid => setPharmacyOnlineStatus(prev => ({ ...prev, [pid]: !prev[pid] }))}
            deactivatedDriverIds={new Set()}
            onToggleDriver={() => {}}
            deliveryZones={[]}
            onUpdateZones={() => {}}
            slaMinutes={5}
            onSlaMinutesChange={() => {}}
            paymentMethods={paymentMethods}
            onUpdatePaymentMethods={handleUpdatePaymentMethods}
            users={allUsers}
            onSwitchRole={(r) => setSelectedApp(r)}
          />
        )}
      </main>
    </div>
  );
};

export default App;
