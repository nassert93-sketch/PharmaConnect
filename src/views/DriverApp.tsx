import React, { useState, useMemo, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/firebase';
import { Order, OrderStatus, UserProfile, PushNotification } from '@/types';
import { useSoundReminder } from '@/hooks/useSoundReminder';

interface DriverAppProps {
  t: any;
  orders: Order[];
  onUpdateOrder: (orderId: string, updates: Partial<Order>) => void;
  user: UserProfile;
  users: UserProfile[];
  addNotification: (message: string, type?: 'info' | 'urgent') => void;
}

const DriverApp: React.FC<DriverAppProps> = ({ t, orders, onUpdateOrder, user, users, addNotification }) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'my'>('available');
  const [isTracking, setIsTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [notifiedMissions, setNotifiedMissions] = useState<Set<string>>(new Set());
  const [pushNotifications, setPushNotifications] = useState<PushNotification[]>([]);
  const [latestPush, setLatestPush] = useState<PushNotification | null>(null);
  const [showPushBanner, setShowPushBanner] = useState(false);

  const availableMissions = useMemo(() => {
    return orders.filter(o => o.status === OrderStatus.READY_FOR_PICKUP && !o.driverId);
  }, [orders]);

  const myMissions = useMemo(() => {
    return orders.filter(o => o.driverId === user.uid);
  }, [orders, user.uid]);

  useSoundReminder({
    condition: availableMissions.length > 0 && !(notifiedMissions.has(availableMissions[0]?.id)),
    intervalMs: 60000,
    soundEnabled: true,
    onStop: () => {
      setNotifiedMissions(prev => {
        const newSet = new Set(prev);
        availableMissions.forEach(m => newSet.add(m.id));
        return newSet;
      });
    }
  });

  // ── Écouter les notifications push pour les livreurs ──────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'pushNotifications'),
      where('targetRole', '==', 'DRIVER'),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() } as PushNotification));
      if (notifs.length > 0) {
        const latest = notifs[0];
        setLatestPush(latest);
        setShowPushBanner(true);
        addNotification(latest.title, 'urgent');
      }
      setPushNotifications(notifs);
    });
    return unsub;
  }, []);

  const handleDismissPush = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'pushNotifications', notifId), { read: true });
      setShowPushBanner(false);
      setLatestPush(null);
    } catch (err) { console.error(err); }
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  };

  useEffect(() => {
    if (myMissions.length === 0 && isTracking) {
      stopTracking();
    }
  }, [myMissions, isTracking]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setTrackingError("La géolocalisation n'est pas supportée.");
      return;
    }
    setIsTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          updatedAt: new Date().toISOString()
        };
        myMissions.forEach(mission => {
          onUpdateOrder(mission.id, { driverLocation: location });
        });
        setTrackingError(null);
      },
      (error) => {
        setTrackingError("Erreur de géolocalisation.");
        console.error(error);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleAcceptMission = (orderId: string) => {
    onUpdateOrder(orderId, { 
      driverId: user.uid,
      status: OrderStatus.OUT_FOR_DELIVERY 
    });
    setNotifiedMissions(prev => new Set(prev).add(orderId));
    addNotification('Mission acceptée', 'info');
  };

  const handleConfirmPickup = (orderId: string) => {
    onUpdateOrder(orderId, { status: OrderStatus.OUT_FOR_DELIVERY });
    addNotification('Colis récupéré', 'info');
  };

  const handleConfirmDelivery = (orderId: string) => {
    onUpdateOrder(orderId, { status: OrderStatus.DELIVERED });
    addNotification('Livraison confirmée', 'info');
  };

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  const MissionCard = ({ order, type }: { order: Order; type: 'available' | 'my' }) => {
    const total = ((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString();
    return (
      <div 
        onClick={() => setSelectedOrderId(order.id)}
        className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50"
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider">#{order.id.slice(-6)}</p>
            <h3 className="text-lg font-black text-gray-900 mt-1">{order.patientName}</h3>
          </div>
          <span className={`text-xs font-black px-3 py-1 rounded-full ${
            order.status === OrderStatus.READY_FOR_PICKUP 
              ? 'bg-amber-100 text-amber-700'
              : order.status === OrderStatus.OUT_FOR_DELIVERY
              ? 'bg-blue-100 text-blue-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {order.status === OrderStatus.READY_FOR_PICKUP && 'À retirer'}
            {order.status === OrderStatus.OUT_FOR_DELIVERY && 'En livraison'}
            {order.status === OrderStatus.DELIVERED && 'Livrée'}
          </span>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <i className="fa-solid fa-store text-gray-400 w-5"></i>
            <span className="font-medium text-gray-700">{order.pharmacyName || 'Pharmacie'}</span>
          </div>
          {order.pharmacyAddress && (
            <div className="flex items-center gap-2 text-sm">
              <i className="fa-solid fa-map-pin text-indigo-400 w-5"></i>
              <span className="font-bold text-indigo-600 text-xs">Récupérer à : {order.pharmacyAddress}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <i className="fa-solid fa-location-dot text-gray-400 w-5"></i>
            <span className="font-medium text-gray-700">{order.deliveryAddress}</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs text-gray-400 font-medium">Montant total</p>
            <p className="text-lg font-black text-gray-900">{total} {t.common.djf}</p>
          </div>
          {type === 'available' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAcceptMission(order.id); }}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              Accepter
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">

      {/* ── Bandeau notification mission urgente ── */}
      {showPushBanner && latestPush && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4 flex items-center justify-between animate-in slide-in-from-top duration-300 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <i className="fa-solid fa-motorcycle text-lg animate-bounce"></i>
            </div>
            <div className="min-w-0">
              <p className="font-black text-sm">{latestPush.title}</p>
              <p className="text-blue-100 text-xs mt-0.5 truncate">{latestPush.message}</p>
              {latestPush.pharmacyAddress && (
                <p className="text-blue-200 text-xs font-bold mt-0.5">
                  <i className="fa-solid fa-location-dot mr-1"></i>
                  {latestPush.pharmacyAddress}
                </p>
              )}
            </div>
          </div>
          <button onClick={() => handleDismissPush(latestPush.id!)}
            className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 shrink-0 ml-3">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900">{user.name}</h1>
            <p className="text-sm text-blue-600 font-black uppercase tracking-widest mt-1">
              {user.vehicleType || 'Livreur'} • {user.vehiclePlate || 'D-XXXXX'}
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
            <i className="fa-solid fa-motorcycle text-xl"></i>
          </div>
        </header>

        <div className="mb-4 flex gap-2">
          {!isTracking ? (
            <button
              onClick={startTracking}
              className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-black uppercase"
            >
              Activer le suivi de position
            </button>
          ) : (
            <button
              onClick={stopTracking}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase"
            >
              Désactiver le suivi
            </button>
          )}
          {trackingError && <p className="text-red-500 text-xs mt-2">{trackingError}</p>}
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('available')}
            className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${
              activeTab === 'available'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Disponibles ({availableMissions.length})
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${
              activeTab === 'my'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Mes missions ({myMissions.length})
          </button>
        </div>

        <div className="space-y-4 pb-20">
          {activeTab === 'available' && (
            availableMissions.length > 0 ? (
              availableMissions.map(order => (
                <div key={order.id}>
                  <MissionCard order={order} type="available" />
                </div>
              ))
            ) : (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
                <i className="fa-solid fa-motorcycle text-5xl text-gray-300 mb-4"></i>
                <p className="text-gray-500 font-medium">Aucune mission disponible</p>
                <p className="text-sm text-gray-400 mt-1">Revenez plus tard</p>
              </div>
            )
          )}

          {activeTab === 'my' && (
            myMissions.length > 0 ? (
              myMissions.map(order => {
                const total = ((order.totalAmount || 0) + (order.deliveryFee || 0)).toLocaleString();
                return (
                  <div key={order.id} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-wider">#{order.id.slice(-6)}</p>
                        <h3 className="text-lg font-black text-gray-900 mt-1">{order.patientName}</h3>
                      </div>
                      <span className={`text-xs font-black px-3 py-1 rounded-full ${
                        order.status === OrderStatus.READY_FOR_PICKUP 
                          ? 'bg-amber-100 text-amber-700'
                          : order.status === OrderStatus.OUT_FOR_DELIVERY
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {order.status === OrderStatus.READY_FOR_PICKUP && 'À retirer'}
                        {order.status === OrderStatus.OUT_FOR_DELIVERY && 'En livraison'}
                        {order.status === OrderStatus.DELIVERED && 'Livrée'}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <i className="fa-solid fa-store text-gray-400 w-5"></i>
                        <span className="font-medium text-gray-700">{order.pharmacyName || 'Pharmacie'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <i className="fa-solid fa-location-dot text-gray-400 w-5"></i>
                        <span className="font-medium text-gray-700">{order.deliveryAddress}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                      <div>
                        <p className="text-xs text-gray-400 font-medium">Montant total</p>
                        <p className="text-lg font-black text-gray-900">{total} {t.common.djf}</p>
                      </div>
                      {order.status === OrderStatus.READY_FOR_PICKUP && (
                        <button
                          onClick={() => handleConfirmPickup(order.id)}
                          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
                        >
                          {t.driver.confirm_pickup}
                        </button>
                      )}
                      {order.status === OrderStatus.OUT_FOR_DELIVERY && (
                        <button
                          onClick={() => handleConfirmDelivery(order.id)}
                          className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
                        >
                          {t.driver.confirm_delivery}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
                <i className="fa-solid fa-clock text-5xl text-gray-300 mb-4"></i>
                <p className="text-gray-500 font-medium">Aucune mission en cours</p>
                <p className="text-sm text-gray-400 mt-1">Acceptez une mission pour commencer</p>
              </div>
            )
          )}
        </div>

        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl">
              <div className="relative h-40 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex items-end">
                <button
                  onClick={() => setSelectedOrderId(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
                <div>
                  <p className="text-white/80 text-xs font-black uppercase tracking-wider">Détail mission</p>
                  <h3 className="text-2xl font-black text-white">#{selectedOrder.id.slice(-6)}</h3>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Patient</p>
                  <p className="text-lg font-black text-gray-900">{selectedOrder.patientName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pharmacie</p>
                  <p className="text-lg font-black text-gray-900">{selectedOrder.pharmacyName || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Adresse de livraison</p>
                  <p className="text-lg font-black text-gray-900">{selectedOrder.deliveryAddress}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Montant total</p>
                  <p className="text-2xl font-black text-blue-600">
                    {((selectedOrder.totalAmount || 0) + (selectedOrder.deliveryFee || 0)).toLocaleString()} {t.common.djf}
                  </p>
                </div>
                <div className="pt-4 flex gap-3">
                  {selectedOrder.status === OrderStatus.READY_FOR_PICKUP && (
                    <>
                      <button
                        onClick={() => {
                          handleAcceptMission(selectedOrder.id);
                          setSelectedOrderId(null);
                        }}
                        className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-sm tracking-wider hover:bg-blue-700 transition-colors"
                      >
                        {t.driver.accept_mission}
                      </button>
                      <button
                        onClick={() => setSelectedOrderId(null)}
                        className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-black uppercase text-sm tracking-wider hover:bg-gray-200 transition-colors"
                      >
                        Fermer
                      </button>
                    </>
                  )}
                  {(selectedOrder.status === OrderStatus.OUT_FOR_DELIVERY || selectedOrder.status === OrderStatus.DELIVERED) && (
                    <button
                      onClick={() => setSelectedOrderId(null)}
                      className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-black uppercase text-sm tracking-wider hover:bg-gray-200 transition-colors"
                    >
                      Fermer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default DriverApp;