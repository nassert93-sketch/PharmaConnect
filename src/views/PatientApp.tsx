import React, { useRef, useState, useMemo, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/firebase';
import { OrderStatus, Order, Quote, PaymentMethod } from '@/types';
import MapView from '@/components/MapView';
import { useSoundReminder } from '@/hooks/useSoundReminder';

// ==================== HOOK PERSONNALISÉ ====================
const useTimer = (deadline: string) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  useEffect(() => {
    const calculate = () => {
      const diff = new Date(deadline).getTime() - new Date().getTime();
      setTimeLeft(Math.max(0, Math.floor(diff / 1000)));
    };
    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  return { text: `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`, raw: timeLeft };
};

// ==================== COMPOSANTS DE STEPPER ====================
const OrderStepper = ({ status }: { status: OrderStatus }) => {
  const steps = [
    { id: OrderStatus.AWAITING_QUOTES, icon: 'fa-search', label: 'Recherche' },
    { id: OrderStatus.PREPARING, icon: 'fa-mortar-pestle', label: 'Préparation' },
    { id: OrderStatus.OUT_FOR_DELIVERY, icon: 'fa-motorcycle', label: 'Livraison' },
    { id: OrderStatus.DELIVERED, icon: 'fa-check-circle', label: 'Reçu' },
  ];
  const getCurrentIdx = () => {
    if (status === OrderStatus.AWAITING_QUOTES) return 0;
    if (status === OrderStatus.PREPARING || status === OrderStatus.READY_FOR_PICKUP) return 1;
    if (status === OrderStatus.OUT_FOR_DELIVERY) return 2;
    if (status === OrderStatus.DELIVERED) return 3;
    return -1;
  };
  const currentIdx = getCurrentIdx();
  return (
    <div className="flex items-center justify-between w-full mt-4">
      {steps.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all duration-500 ${
              idx <= currentIdx ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-300'
            }`}>
              <i className={`fa-solid ${step.icon}`}></i>
            </div>
            <span className={`text-xs font-bold uppercase tracking-tighter ${idx <= currentIdx ? 'text-blue-600' : 'text-gray-300'}`}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-1 rounded-full transition-all duration-1000 ${
              idx < currentIdx ? 'bg-blue-600' : 'bg-gray-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const CompactStepper = ({ status }: { status: OrderStatus }) => {
  const steps = [
    { id: OrderStatus.AWAITING_QUOTES, icon: 'fa-search' },
    { id: OrderStatus.PREPARING, icon: 'fa-mortar-pestle' },
    { id: OrderStatus.OUT_FOR_DELIVERY, icon: 'fa-motorcycle' },
    { id: OrderStatus.DELIVERED, icon: 'fa-check-circle' },
  ];
  const getCurrentIdx = () => {
    if (status === OrderStatus.AWAITING_QUOTES) return 0;
    if (status === OrderStatus.PREPARING || status === OrderStatus.READY_FOR_PICKUP) return 1;
    if (status === OrderStatus.OUT_FOR_DELIVERY) return 2;
    if (status === OrderStatus.DELIVERED) return 3;
    return -1;
  };
  const currentIdx = getCurrentIdx();
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] transition-all ${
            idx <= currentIdx ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-300'
          }`}>
            <i className={`fa-solid ${step.icon}`}></i>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-4 h-[2px] rounded-full ${idx < currentIdx ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ==================== CARTES DE COMMANDE ====================
const DesktopOrderCard = ({ order, onClick, t }: { order: Order; onClick: (id: string) => void; t: any }) => {
  const timerResult = useTimer(order.deadline || new Date().toISOString());
  const timer = order.status === OrderStatus.AWAITING_QUOTES && !order.pharmacyId ? timerResult : null;
  
  const statusColors: Record<OrderStatus, string> = {
    [OrderStatus.AWAITING_QUOTES]: 'bg-amber-100 text-amber-700 border-amber-200',
    [OrderStatus.PREPARING]: 'bg-blue-100 text-blue-700 border-blue-200',
    [OrderStatus.READY_FOR_PICKUP]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [OrderStatus.OUT_FOR_DELIVERY]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    [OrderStatus.DELIVERED]: 'bg-gray-100 text-gray-700 border-gray-200',
    [OrderStatus.CANCELLED]: 'bg-red-100 text-red-700 border-red-200',
  };
  const statusText: Record<OrderStatus, string> = {
    [OrderStatus.AWAITING_QUOTES]: 'EN ATTENTE',
    [OrderStatus.PREPARING]: 'EN PRÉPARATION',
    [OrderStatus.READY_FOR_PICKUP]: 'PRÊT',
    [OrderStatus.OUT_FOR_DELIVERY]: 'EN COURS DE LIVRAISON',
    [OrderStatus.DELIVERED]: 'LIVRÉ',
    [OrderStatus.CANCELLED]: 'ANNULÉ',
  };

  const formattedDate = new Date(order.timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const displayName = order.pharmacyName || order.patientName;

  return (
    <div
      onClick={() => onClick(order.id)}
      className="bg-white rounded-2xl p-6 border-2 border-gray-100 shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{order.id}</p>
          <h3 className="text-xl font-black text-gray-900 mt-1">{displayName}</h3>
          <p className="text-sm text-gray-500 mt-1">{formattedDate}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`text-xs font-black px-3 py-1 rounded-full border ${statusColors[order.status] || 'bg-gray-100'}`}>
            {statusText[order.status] || order.status}
          </span>
          {timer && (
            <div className={`text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 ${
              timer.raw < 60 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
            }`}>
              <i className="fa-solid fa-hourglass-half"></i> {timer.text}
            </div>
          )}
        </div>
      </div>
      {order.status !== OrderStatus.CANCELLED && <OrderStepper status={order.status} />}
      {order.quotes.length > 0 && order.status === OrderStatus.AWAITING_QUOTES && (
        <div className="mt-4 text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg inline-flex items-center gap-2">
          <i className="fa-solid fa-file-invoice"></i> Devis disponible
        </div>
      )}
      {order.status === OrderStatus.CANCELLED && (
        <div className="mt-4 text-xs font-black text-red-600 bg-red-50 px-3 py-2 rounded-lg inline-flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation"></i> Aucune pharmacie disponible
        </div>
      )}
    </div>
  );
};

const CompactOrderCard = ({ order, onClick, t }: { order: Order; onClick: (id: string) => void; t: any }) => {
  const timerResult = useTimer(order.deadline || new Date().toISOString());
  const timer = order.status === OrderStatus.AWAITING_QUOTES && !order.pharmacyId ? timerResult : null;
  
  const statusColors: Record<OrderStatus, string> = {
    [OrderStatus.AWAITING_QUOTES]: 'bg-amber-100 text-amber-700 border-amber-200',
    [OrderStatus.PREPARING]: 'bg-blue-100 text-blue-700 border-blue-200',
    [OrderStatus.READY_FOR_PICKUP]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [OrderStatus.OUT_FOR_DELIVERY]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    [OrderStatus.DELIVERED]: 'bg-gray-100 text-gray-700 border-gray-200',
    [OrderStatus.CANCELLED]: 'bg-red-100 text-red-700 border-red-200',
  };
  const statusText: Record<OrderStatus, string> = {
    [OrderStatus.AWAITING_QUOTES]: 'EN ATTENTE',
    [OrderStatus.PREPARING]: 'EN PRÉPARATION',
    [OrderStatus.READY_FOR_PICKUP]: 'PRÊT',
    [OrderStatus.OUT_FOR_DELIVERY]: 'EN COURS DE LIVRAISON',
    [OrderStatus.DELIVERED]: 'LIVRÉ',
    [OrderStatus.CANCELLED]: 'ANNULÉ',
  };

  const formattedDate = new Date(order.timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const displayName = order.pharmacyName || order.patientName;

  return (
    <div
      onClick={() => onClick(order.id)}
      className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase">{order.id}</p>
          <h4 className="text-base font-black text-gray-900 mt-0.5">{displayName}</h4>
        </div>
        <span className={`text-[9px] font-black px-2 py-1 rounded-full border ${statusColors[order.status] || 'bg-gray-100'}`}>
          {statusText[order.status] || order.status}
        </span>
      </div>
      
      <p className="text-xs text-gray-500 mb-2">{formattedDate}</p>

      <div className="flex items-center justify-between mt-3">
        {order.status !== OrderStatus.CANCELLED ? (
          <CompactStepper status={order.status} />
        ) : (
          <span className="text-[9px] font-black text-red-600">Commande annulée</span>
        )}
        {timer && (
          <div className={`text-[9px] font-black px-2 py-1 rounded-full flex items-center gap-1 ${
            timer.raw < 60 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
          }`}>
            <i className="fa-solid fa-hourglass-half"></i> {timer.text}
          </div>
        )}
      </div>
      {order.quotes.length > 0 && order.status === OrderStatus.AWAITING_QUOTES && (
        <div className="mt-3 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full inline-block">
          <i className="fa-solid fa-file-invoice mr-1"></i> Devis dispo
        </div>
      )}
    </div>
  );
};

// ==================== DÉTAILS D'UN DEVIS ====================
const QuoteDetails = ({ quote, t }: { quote: Quote; t: any }) => {
  const totalArticles = quote.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm space-y-3">
      <div className="flex justify-between items-center border-b border-gray-100 pb-3">
        <div>
          <p className="text-[10px] font-black text-blue-600 uppercase">Offre #{quote.pharmacyId.slice(-4)}</p>
          <p className="text-sm font-black text-gray-900 mt-0.5">{quote.pharmacyName}</p>
          {quote.pharmacyAddress && (
            <p className="text-[9px] text-gray-400 mt-0.5">
              <i className="fa-solid fa-location-dot mr-1"></i>{quote.pharmacyAddress}
            </p>
          )}
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {quote.isOnDuty && (
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[9px] font-black flex items-center gap-1">
                <i className="fa-solid fa-moon text-[8px]"></i> DE GARDE
              </span>
            )}
            {quote.isOpenNow === true && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black flex items-center gap-1">
                <i className="fa-solid fa-circle text-[6px]"></i> OUVERT
              </span>
            )}
            {quote.isOpenNow === false && (
              <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[9px] font-black">
                FERMÉ
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-gray-900">{quote.totalAmount.toLocaleString()} <span className="text-[8px] font-black text-gray-400">DJF</span></p>
          <p className="text-[7px] font-black text-gray-400 uppercase">dont livraison {quote.deliveryFee} DJF</p>
        </div>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        <h4 className="text-[7px] font-black uppercase text-gray-400 tracking-wider">Détail des produits</h4>
        {quote.items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0">
            <div className="flex-1">
              <p className="text-xs font-black text-gray-900">{item.name}</p>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {item.isColdChain && <span className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-[6px] font-black">❄️ Froid</span>}
                {item.isPsychotropic && <span className="px-1 py-0.5 bg-amber-100 text-amber-600 rounded text-[6px] font-black">⚠️ Psycho</span>}
                {item.status === 'GENERIC_AVAILABLE' && <span className="px-1 py-0.5 bg-emerald-100 text-emerald-600 rounded text-[6px] font-black">🔄 Générique</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-gray-900">{item.price?.toLocaleString()} DJF</p>
              <p className="text-[7px] text-gray-400">x {item.quantity}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-2 flex justify-between items-center text-sm font-black border-t border-gray-100">
        <span className="text-xs text-gray-500">Total TTC</span>
        <span className="text-blue-600">{(totalArticles + quote.deliveryFee).toLocaleString()} DJF</span>
      </div>
    </div>
  );
};

// ==================== ÉCRANS POUR CHAQUE ONGLET ====================

// Onglet Accueil
const HomeTab: React.FC<{
  user: any;
  pendingOrders: Order[];
  inProgressOrders: Order[];
  onUpload: () => void;
  isUploading: boolean;
  uploadProgress: number;
  onOrderClick: (id: string) => void;
  t: any;
}> = ({ user, pendingOrders, inProgressOrders, onUpload, isUploading, uploadProgress, onOrderClick, t }) => {
  const displayOrders = [...pendingOrders, ...inProgressOrders].slice(0, 3);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">
          Bonjour, {user?.name?.split(' ')[0] || 'cher patient'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Envoyez votre ordonnance aux pharmacies proches de vous
        </p>
      </div>

      <button
        onClick={onUpload}
        disabled={isUploading}
        className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black uppercase text-lg tracking-wider shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-50"
      >
        {isUploading ? (
          <div className="w-full flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-cloud-arrow-up fa-spin text-xl"></i>
              <span className="text-sm font-bold">Envoi en cours... {uploadProgress}%</span>
            </div>
            <div className="w-full bg-white/30 rounded-full h-2">
              <div
                className="bg-white rounded-full h-2 transition-all duration-300"
                style={{width: `${uploadProgress}%`}}
              ></div>
            </div>
          </div>
        ) : (
          <>
            <i className="fa-solid fa-camera text-2xl"></i>
            <span>Scanner une ordonnance</span>
          </>
        )}
      </button>

      {displayOrders.length > 0 && (
        <section>
          <h2 className="text-lg font-black text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Commandes en cours ({displayOrders.length})
          </h2>
          <div className="space-y-3">
            {displayOrders.map(order => (
              <CompactOrderCard key={order.id} order={order} onClick={onOrderClick} t={t} />
            ))}
          </div>
        </section>
      )}

      {displayOrders.length === 0 && (
        <div className="py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <i className="fa-solid fa-prescription text-4xl text-gray-300 mb-3"></i>
          <p className="text-gray-500 font-medium">Aucune commande en cours</p>
          <p className="text-sm text-gray-400 mt-1">
            Scannez votre première ordonnance pour commencer
          </p>
        </div>
      )}
    </div>
  );
};

// Onglet Historique
const HistoryTab: React.FC<{
  orders: Order[];
  onOrderClick: (id: string) => void;
  t: any;
}> = ({ orders, onOrderClick, t }) => {
  const pendingOrders = orders.filter(o => o.status === OrderStatus.AWAITING_QUOTES);
  const processedOrders = orders.filter(o => o.status !== OrderStatus.AWAITING_QUOTES);

  const sortByDate = (a: Order, b: Order) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  const sortedPending = [...pendingOrders].sort(sortByDate);
  const sortedProcessed = [...processedOrders].sort(sortByDate);

  if (orders.length === 0) {
    return (
      <div className="p-8 text-center">
        <i className="fa-solid fa-clock-rotate-left text-5xl text-gray-300 mb-4"></i>
        <p className="text-gray-500">Aucun historique</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {sortedPending.length > 0 && (
        <section>
          <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
            Commandes en attente ({sortedPending.length})
          </h3>
          <div className="space-y-3">
            {sortedPending.map(order => (
              <CompactOrderCard key={order.id} order={order} onClick={onOrderClick} t={t} />
            ))}
          </div>
        </section>
      )}

      {sortedProcessed.length > 0 && (
        <section>
          <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            Ordonnances traitées ({sortedProcessed.length})
          </h3>
          <div className="space-y-3">
            {sortedProcessed.map(order => (
              <CompactOrderCard key={order.id} order={order} onClick={onOrderClick} t={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// Onglet Notifications
const NotificationsTab: React.FC<{
  notifications: Array<{ id: string; message: string; type: string; timestamp: Date }>;
}> = ({ notifications }) => {
  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center">
        <i className="fa-solid fa-bell-slash text-5xl text-gray-300 mb-4"></i>
        <p className="text-gray-500">Aucune notification</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {notifications.map(n => (
        <div key={n.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-800">{n.message}</p>
          <p className="text-[10px] text-gray-400 mt-1">
            {n.timestamp.toLocaleTimeString()}
          </p>
        </div>
      ))}
    </div>
  );
};

// Onglet Profil
const ProfileTab: React.FC<{
  user: any;
  onLogout: () => void;
  onEditProfile: () => void;
}> = ({ user, onLogout, onEditProfile }) => {
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-4">
        {user?.photoURL ? (
          <img src={user.photoURL} alt="profile" className="w-16 h-16 rounded-2xl object-cover" />
        ) : (
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 text-2xl">
            <i className="fa-solid fa-user"></i>
          </div>
        )}
        <div>
          <h2 className="text-xl font-black text-gray-900">{user?.name}</h2>
          <p className="text-sm text-gray-500">{user?.email}</p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={onEditProfile}
          className="w-full p-4 bg-gray-100 rounded-xl text-left font-black text-gray-700 flex items-center gap-3"
        >
          <i className="fa-solid fa-pen-to-square w-6"></i>
          <span>Modifier le profil</span>
        </button>
        <button
          onClick={onLogout}
          className="w-full p-4 bg-red-50 text-red-600 rounded-xl text-left font-black flex items-center gap-3"
        >
          <i className="fa-solid fa-right-from-bracket w-6"></i>
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
};

// ==================== COMPOSANT PRINCIPAL PATIENTAPP ====================
interface PatientAppProps {
  t: any;
  onNewOrder: (order: any) => Promise<boolean> | void;
  orders: Order[];
  onUpdateOrder: (orderId: string, updates: Partial<Order>) => void;
  activeOrderId: string | null;
  setActiveOrderId: (id: string | null) => void;
  addNotification?: (message: string, type?: 'info' | 'urgent') => void;
  mockUser?: any;
  paymentMethods: PaymentMethod[];
  onLogout: () => void;
  onOpenProfileModal: () => void;
}

const PatientApp: React.FC<PatientAppProps> = ({
  t,
  onNewOrder,
  orders,
  onUpdateOrder,
  activeOrderId,
  setActiveOrderId,
  addNotification,
  mockUser,
  paymentMethods,
  onLogout,
  onOpenProfileModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // progression upload 0-100
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const user = mockUser || { uid: 'p-demo', name: 'Ahmed Abdallah' };

  const [notifiedOrderIds, setNotifiedOrderIds] = useState<Set<string>>(new Set());
  const [patientLocation, setPatientLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'notifications' | 'profile'>('home');
  const [notificationsList, setNotificationsList] = useState<Array<{ id: string; message: string; type: string; timestamp: Date }>>([]);

  const [selectedQuote, setSelectedQuote] = useState<{ orderId: string; quote: Quote } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTypeChoice, setPaymentTypeChoice] = useState<'online' | 'cod' | null>(null);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [quotesList, setQuotesList] = useState<Quote[]>([]);
  const [showQuote, setShowQuote] = useState(false);

  // État pour les notifications sonores répétées
  const [notifiedQuotes, setNotifiedQuotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPatientLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          setLocationError("Impossible d'obtenir votre position.");
          console.error(error);
        }
      );
    }
  }, []);

  const myOrders = useMemo(() => orders.filter(o => o.patientId === user.uid), [orders, user]);
  const pendingOrders = useMemo(() => myOrders.filter(o => o.status === OrderStatus.AWAITING_QUOTES), [myOrders]);
  const inProgressOrders = useMemo(
    () => myOrders.filter(o => [OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY].includes(o.status)),
    [myOrders]
  );
  const allOrders = useMemo(() => myOrders, [myOrders]);

  const selectedOrder = useMemo(() => orders.find(o => o.id === activeOrderId) || null, [orders, activeOrderId]);

  // Détection des commandes avec nouveaux devis
  const ordersWithNewQuotes = useMemo(() => {
    return myOrders.filter(o => 
      o.status === OrderStatus.AWAITING_QUOTES && 
      o.quotes?.length > 0 && 
      !o.pharmacyId
    );
  }, [myOrders]);

  // Hook pour sonnerie répétée (toujours active)
  useSoundReminder({
    condition: ordersWithNewQuotes.length > 0 && !(notifiedQuotes.has(ordersWithNewQuotes[0]?.id)),
    intervalMs: 60000,
    soundEnabled: true,
    onStop: () => {
      setNotifiedQuotes(prev => {
        const newSet = new Set(prev);
        ordersWithNewQuotes.forEach(o => newSet.add(o.id));
        return newSet;
      });
    }
  });

  useEffect(() => {
    if (selectedOrder && selectedOrder.quotes && selectedOrder.quotes.length > 0) {
      const sorted = [...selectedOrder.quotes].sort((a, b) => {
        const getPriority = (q: Quote) => {
          const hasUnavailable = q.items.some(i => i.status === 'UNAVAILABLE');
          const hasGeneric = q.items.some(i => i.status === 'GENERIC_AVAILABLE');
          if (hasUnavailable) return 2;
          if (hasGeneric) return 1;
          return 0;
        };
        const prioA = getPriority(a);
        const prioB = getPriority(b);
        if (prioA !== prioB) return prioA - prioB;
        return (a.totalAmount + a.deliveryFee) - (b.totalAmount + b.deliveryFee);
      });
      setQuotesList(sorted);
      setCurrentQuoteIndex(0);
      setShowQuote(true);
    } else {
      setQuotesList([]);
      setShowQuote(false);
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (selectedOrder && selectedOrder.quotes.length > 0 && selectedOrder.status === OrderStatus.AWAITING_QUOTES) {
      if (!notifiedOrderIds.has(selectedOrder.id)) {
        setNotifiedOrderIds(prev => new Set(prev).add(selectedOrder.id));
        addNotification?.(`📄 Un devis est disponible pour votre commande ${selectedOrder.id}`, 'info');
        setNotificationsList(prev => [
          { id: Date.now().toString(), message: `Devis reçu pour ${selectedOrder.id}`, type: 'info', timestamp: new Date() },
          ...prev,
        ]);
      }
    }
  }, [selectedOrder, addNotification, notifiedOrderIds]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérification taille max 10MB
    if (file.size > 10 * 1024 * 1024) {
      addNotification?.('❌ Image trop lourde. Maximum 10MB.', 'urgent');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Upload vers Firebase Storage (stockage permanent)
      const timestamp = Date.now();
      const fileName = `prescriptions/${user.uid}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      // 2. Attendre la fin de l'upload avec suivi de la progression
      const downloadURL = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress(progress);
          },
          (error) => {
            console.error('Erreur upload Storage:', error);
            reject(error);
          },
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });

      // 3. Créer la commande avec l'URL permanente Firebase Storage
      await onNewOrder({
        patientId: user.uid,
        patientName: user.name,
        status: OrderStatus.AWAITING_QUOTES,
        items: [],
        isPsychotropicDetected: false,
        deliveryAddress: 'Djibouti-Ville',
        timestamp: new Date().toISOString(),
        quotes: [],
        targetedPharmacyIds: [],
        refusedByPharmacyIds: [],
        acceptedByPharmacyIds: [],
        prescriptionImageUrl: downloadURL, // ✅ URL permanente Firebase Storage
        patientLocation: patientLocation || undefined,
      });

      addNotification?.('🚀 Ordonnance transmise aux officines', 'info');
      setNotificationsList(prev => [
        { id: Date.now().toString(), message: 'Ordonnance envoyée', type: 'info', timestamp: new Date() },
        ...prev,
      ]);
    } catch (error: any) {
      console.error('Erreur upload:', error);
      if (error?.code === 'storage/unauthorized') {
        addNotification?.('❌ Accès refusé. Vérifiez vos permissions Firebase.', 'urgent');
      } else {
        addNotification?.('❌ Erreur lors de l\'envoi. Réessayez.', 'urgent');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset input pour permettre le même fichier
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleAcceptQuote = (orderId: string, quote: Quote) => {
    // Marquer comme notifiée pour arrêter la sonnerie
    setNotifiedQuotes(prev => new Set(prev).add(orderId));
    setSelectedQuote({ orderId, quote });
    setPaymentMethod('');
    setPaymentTypeChoice(null);
    setShowPaymentModal(true);
  };

  const handleRejectQuote = () => {
    if (selectedOrder) {
      setNotifiedQuotes(prev => new Set(prev).add(selectedOrder.id));
    }
    if (currentQuoteIndex < quotesList.length - 1) {
      setCurrentQuoteIndex(prev => prev + 1);
    } else {
      setShowQuote(false);
      if (window.confirm('Aucune autre offre. Voulez-vous annuler cette commande ?')) {
        onUpdateOrder(selectedOrder!.id, { status: OrderStatus.CANCELLED });
        setActiveOrderId(null);
      }
    }
  };

  const confirmPayment = () => {
    if (!selectedQuote || !paymentMethod) return;
    const method = paymentMethods.find(m => m.code === paymentMethod);
    setProcessingOrderId(selectedQuote.orderId);
    setTimeout(() => {
      onUpdateOrder(selectedQuote.orderId, {
        status: OrderStatus.PREPARING,
        pharmacyId: selectedQuote.quote.pharmacyId,
        pharmacyName: selectedQuote.quote.pharmacyName,
        totalAmount: selectedQuote.quote.totalAmount,
        deliveryFee: selectedQuote.quote.deliveryFee,
        items: selectedQuote.quote.items,
        paymentMethod,
        paymentType: method?.type,
      });
      setProcessingOrderId(null);
      setShowPaymentModal(false);
      setSelectedQuote(null);
      setActiveOrderId(null);
      setPaymentTypeChoice(null);
      setPaymentMethod('');
      addNotification?.(`✅ Paiement ${method?.type === 'cod' ? 'à la livraison' : 'en ligne'} confirmé – Préparation en cours`, 'info');
      setNotificationsList(prev => [
        { id: Date.now().toString(), message: `Commande ${selectedQuote.orderId} confirmée`, type: 'info', timestamp: new Date() },
        ...prev,
      ]);
    }, 500);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'home' && (
          <HomeTab
            user={user}
            pendingOrders={pendingOrders}
            inProgressOrders={inProgressOrders}
            onUpload={triggerUpload}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            onOrderClick={setActiveOrderId}
            t={t}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab
            orders={allOrders}
            onOrderClick={setActiveOrderId}
            t={t}
          />
        )}
        {activeTab === 'notifications' && (
          <NotificationsTab notifications={notificationsList} />
        )}
        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            onLogout={onLogout}
            onEditProfile={onOpenProfileModal}
          />
        )}
      </main>

      <nav className="bg-white border-t border-gray-200 flex items-center justify-around py-2 shrink-0">
        {[
          { id: 'home', icon: 'fa-house', label: 'Accueil' },
          { id: 'history', icon: 'fa-clock-rotate-left', label: 'Historique' },
          { id: 'notifications', icon: 'fa-bell', label: 'Notifications', badge: notificationsList.length },
          { id: 'profile', icon: 'fa-user', label: 'Profil' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
              activeTab === item.id ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <div className="relative">
              <i className={`fa-solid ${item.icon} text-xl`}></i>
              {item.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium mt-1">{item.label}</span>
          </button>
        ))}
      </nav>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

      {/* MODALE DE DÉTAIL D'UNE COMMANDE */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 animate-in fade-in duration-200"
          onClick={() => setActiveOrderId(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between">
              <button
                onClick={() => setActiveOrderId(null)}
                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                aria-label="Fermer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
              <div className="flex-1 text-center">
                <p className="text-white/80 text-[8px] font-black uppercase tracking-wider">Détails de la commande</p>
                <h3 className="text-sm font-black text-white">{selectedOrder.id}</h3>
              </div>
              <div className="w-10" />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {showQuote && quotesList.length > 0 && (
                <div className="space-y-3">
                  <QuoteDetails quote={quotesList[currentQuoteIndex]} t={t} />
                  {selectedOrder.status === OrderStatus.AWAITING_QUOTES && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptQuote(selectedOrder.id, quotesList[currentQuoteIndex])}
                        disabled={processingOrderId === selectedOrder.id}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-black uppercase text-xs tracking-wider shadow-md hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        {processingOrderId === selectedOrder.id ? 'Traitement...' : t.patient?.confirm_pay || 'Confirmer et payer'}
                      </button>
                      <button
                        onClick={handleRejectQuote}
                        disabled={processingOrderId === selectedOrder.id}
                        className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-black uppercase text-xs tracking-wider hover:bg-gray-300 transition-all disabled:opacity-50"
                      >
                        Refuser
                      </button>
                    </div>
                  )}
                  {currentQuoteIndex < quotesList.length - 1 && (
                    <p className="text-xs text-gray-500 text-center">Offre {currentQuoteIndex + 1}/{quotesList.length}</p>
                  )}
                </div>
              )}
              {!showQuote && selectedOrder.status === OrderStatus.AWAITING_QUOTES && (
                <div className="py-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <i className="fa-solid fa-clock text-3xl text-gray-300 mb-2"></i>
                  <p className="text-sm font-black text-gray-800">Recherche en cours</p>
                  <p className="text-xs text-gray-500 mt-1">Nous trouvons la meilleure pharmacie</p>
                </div>
              )}
              {selectedOrder.status === OrderStatus.CANCELLED && (
                <div className="py-8 text-center bg-red-50 rounded-lg border-2 border-red-200">
                  <i className="fa-solid fa-circle-exclamation text-3xl text-red-300 mb-2"></i>
                  <p className="text-sm font-black text-red-800">Commande annulée</p>
                  <p className="text-xs text-red-500 mt-1">Aucune pharmacie disponible au moment de la demande</p>
                </div>
              )}
              {![OrderStatus.AWAITING_QUOTES, OrderStatus.CANCELLED].includes(selectedOrder.status) && (
                <div className="py-4 text-center">
                  <p className="text-sm font-black text-gray-800">Statut : {selectedOrder.status.replace(/_/g, ' ')}</p>
                  {selectedOrder.status === OrderStatus.DELIVERED && selectedOrder.pharmacyName && (
                    <p className="text-xs text-gray-600 mt-2">Pharmacie : {selectedOrder.pharmacyName}</p>
                  )}
                </div>
              )}

              {selectedOrder.status === OrderStatus.OUT_FOR_DELIVERY && selectedOrder.driverId && (
                <div className="mt-2 border-t pt-3">
                  <h4 className="font-black text-xs text-slate-400 mb-2">Suivi du livreur</h4>
                  <MapView
                    center={selectedOrder.patientLocation ? [selectedOrder.patientLocation.lat, selectedOrder.patientLocation.lng] : undefined}
                    markers={[
                      ...(selectedOrder.patientLocation ? [{ position: [selectedOrder.patientLocation.lat, selectedOrder.patientLocation.lng] as [number, number], popup: 'Votre adresse', icon: 'patient' as const }] : []),
                      ...(selectedOrder.driverLocation ? [{ position: [selectedOrder.driverLocation.lat, selectedOrder.driverLocation.lng] as [number, number], popup: 'Livreur', icon: 'driver' as const }] : [])
                    ]}
                    height="250px"
                    zoomControl={true}
                  />
                </div>
              )}

              {(!showQuote || (showQuote && selectedOrder.status !== OrderStatus.AWAITING_QUOTES)) && (
                <button
                  onClick={() => setActiveOrderId(null)}
                  className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-black uppercase text-sm tracking-wider hover:bg-gray-300 transition-colors mt-2"
                >
                  Fermer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODALE DE PAIEMENT */}
      {showPaymentModal && selectedQuote && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
              <h3 className="text-white text-xl font-black">
                Comment souhaitez-vous payer ?
              </h3>
              <p className="text-white/80 text-sm mt-1">
                Montant total : {(selectedQuote.quote.totalAmount + selectedQuote.quote.deliveryFee).toLocaleString()} DJF
              </p>
            </div>
            <div className="p-6 space-y-4">
              {!paymentTypeChoice ? (
                <div className="space-y-3">
                  <button
                    onClick={() => setPaymentTypeChoice('online')}
                    className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-blue-600 transition-all flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <i className="fa-solid fa-credit-card"></i>
                    </div>
                    <span className="flex-1 text-left font-black text-gray-900">Payer en ligne</span>
                    <i className="fa-solid fa-chevron-right text-gray-400"></i>
                  </button>
                  <button
                    onClick={() => {
                      // Paiement à la livraison : validation immédiate
                      setPaymentMethod('cod');
                      setTimeout(() => confirmPayment(), 0);
                    }}
                    className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-blue-600 transition-all flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <i className="fa-solid fa-truck"></i>
                    </div>
                    <span className="flex-1 text-left font-black text-gray-900">Payer à la livraison</span>
                    <i className="fa-solid fa-chevron-right text-gray-400"></i>
                  </button>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="w-full py-4 text-gray-500 font-black uppercase text-sm hover:text-gray-700 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                // Sélection des moyens de paiement en ligne
                <>
                  {paymentMethods.filter(m => m.active && m.type === 'online').map(method => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.code)}
                      className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                        paymentMethod === method.code
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        paymentMethod === method.code ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {method.logo ? (
                          <img src={method.logo} alt={method.name} className="w-6 h-6 object-contain" />
                        ) : (
                          <i className={`fa-solid ${method.icon}`}></i>
                        )}
                      </div>
                      <span className="flex-1 text-left font-black text-gray-900">{method.name}</span>
                      {paymentMethod === method.code && (
                        <i className="fa-solid fa-check-circle text-blue-600 text-xl"></i>
                      )}
                    </button>
                  ))}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setPaymentTypeChoice(null);
                        setPaymentMethod('');
                      }}
                      className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-black uppercase text-sm hover:bg-gray-200 transition-colors"
                    >
                      Retour
                    </button>
                    <button
                      onClick={confirmPayment}
                      disabled={!paymentMethod}
                      className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirmer
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientApp;