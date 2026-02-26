import React, { useRef, useState, useMemo, useEffect } from 'react';
import { OrderStatus, Order, Quote, PaymentMethod } from '@/types';

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

const DesktopOrderCard = ({ order, onClick, t }: { order: Order; onClick: (id: string) => void; t: any }) => {
  const timerResult = useTimer(order.deadline || new Date().toISOString());
  const timer = order.status === OrderStatus.AWAITING_QUOTES && !order.pharmacyId ? timerResult : null;
  
  const statusColors = {
    [OrderStatus.AWAITING_QUOTES]: 'bg-amber-100 text-amber-700 border-amber-200',
    [OrderStatus.PREPARING]: 'bg-blue-100 text-blue-700 border-blue-200',
    [OrderStatus.READY_FOR_PICKUP]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [OrderStatus.OUT_FOR_DELIVERY]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    [OrderStatus.DELIVERED]: 'bg-gray-100 text-gray-700 border-gray-200',
    [OrderStatus.CANCELLED]: 'bg-red-100 text-red-700 border-red-200',
  };
  const statusText = {
    [OrderStatus.AWAITING_QUOTES]: 'En attente de devis',
    [OrderStatus.PREPARING]: 'Préparation',
    [OrderStatus.READY_FOR_PICKUP]: 'Prêt',
    [OrderStatus.OUT_FOR_DELIVERY]: 'Livraison',
    [OrderStatus.DELIVERED]: 'Livré',
    [OrderStatus.CANCELLED]: 'Annulé',
  };

  return (
    <div
      onClick={() => onClick(order.id)}
      className="bg-white rounded-2xl p-6 border-2 border-gray-100 shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{order.id}</p>
          <h3 className="text-xl font-black text-gray-900 mt-1">{order.patientName}</h3>
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
  
  const statusColors = {
    [OrderStatus.AWAITING_QUOTES]: 'bg-amber-100 text-amber-700 border-amber-200',
    [OrderStatus.PREPARING]: 'bg-blue-100 text-blue-700 border-blue-200',
    [OrderStatus.READY_FOR_PICKUP]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [OrderStatus.OUT_FOR_DELIVERY]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    [OrderStatus.DELIVERED]: 'bg-gray-100 text-gray-700 border-gray-200',
    [OrderStatus.CANCELLED]: 'bg-red-100 text-red-700 border-red-200',
  };
  const statusText = {
    [OrderStatus.AWAITING_QUOTES]: 'Devis en attente',
    [OrderStatus.PREPARING]: 'Préparation',
    [OrderStatus.READY_FOR_PICKUP]: 'Prêt',
    [OrderStatus.OUT_FOR_DELIVERY]: 'Livraison',
    [OrderStatus.DELIVERED]: 'Livré',
    [OrderStatus.CANCELLED]: 'Annulé',
  };

  return (
    <div
      onClick={() => onClick(order.id)}
      className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase">{order.id}</p>
          <h4 className="text-base font-black text-gray-900 mt-0.5">{order.patientName}</h4>
        </div>
        <span className={`text-[9px] font-black px-2 py-1 rounded-full border ${statusColors[order.status] || 'bg-gray-100'}`}>
          {statusText[order.status] || order.status}
        </span>
      </div>
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

const QuoteDetails = ({ quote, t }: { quote: Quote; t: any }) => {
  const totalArticles = quote.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-md space-y-4">
      <div className="flex justify-between items-center border-b border-gray-100 pb-4">
        <div>
          <p className="text-xs font-black text-blue-600 uppercase">Offre #{quote.pharmacyId.slice(-4)}</p>
          <p className="text-sm text-gray-500">{quote.pharmacyName}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-gray-900">{quote.totalAmount.toLocaleString()} <span className="text-xs font-black text-gray-400">DJF</span></p>
          <p className="text-[8px] font-black text-gray-400 uppercase">dont livraison {quote.deliveryFee} DJF</p>
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Détail des produits</h4>
        {quote.items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0">
            <div className="flex-1">
              <p className="text-xs font-black text-gray-900">{item.name}</p>
              <div className="flex items-center gap-1 mt-1">
                {item.isColdChain && <span className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-[7px] font-black">❄️ Froid</span>}
                {item.isPsychotropic && <span className="px-1 py-0.5 bg-amber-100 text-amber-600 rounded text-[7px] font-black">⚠️ Psycho</span>}
                {item.status === 'GENERIC_AVAILABLE' && <span className="px-1 py-0.5 bg-emerald-100 text-emerald-600 rounded text-[7px] font-black">🔄 Générique</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-gray-900">{item.price?.toLocaleString()} DJF</p>
              <p className="text-[8px] text-gray-400">x {item.quantity}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-2 flex justify-between items-center text-sm font-black">
        <span className="text-xs text-gray-500">Total TTC</span>
        <span className="text-blue-600">{(totalArticles + quote.deliveryFee).toLocaleString()} DJF</span>
      </div>
    </div>
  );
};

interface PatientAppProps {
  t: any;
  onNewOrder: (order: any) => void;
  orders: Order[];
  onUpdateOrder: (orderId: string, updates: Partial<Order>) => void;
  step: string;
  setStep: any;
  activeOrderId: string | null;
  setActiveOrderId: (id: string | null) => void;
  addNotification?: (message: string, type?: 'info' | 'urgent') => void;
  mockUser?: any;
  paymentMethods: PaymentMethod[];
}

const PatientApp: React.FC<PatientAppProps> = ({
  t, onNewOrder, orders, onUpdateOrder, activeOrderId, setActiveOrderId, addNotification, mockUser, paymentMethods
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const user = mockUser || { uid: 'p-demo', name: 'Ahmed Abdallah' };
  const [notifiedOrderIds, setNotifiedOrderIds] = useState<Set<string>>(new Set());

  const [selectedQuote, setSelectedQuote] = useState<{ orderId: string; quote: Quote } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTypeChoice, setPaymentTypeChoice] = useState<'online' | 'cod' | null>(null);

  const selectedOrder = useMemo(() => orders.find(o => o.id === activeOrderId) || null, [orders, activeOrderId]);
  const myOrders = useMemo(() => orders.filter(o => o.patientId === user.uid), [orders, user]);

  const pendingOrders = useMemo(() => myOrders.filter(o => o.status === OrderStatus.AWAITING_QUOTES), [myOrders]);
  const inProgressOrders = useMemo(() => myOrders.filter(o => 
    [OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY].includes(o.status)
  ), [myOrders]);
  const completedOrders = useMemo(() => myOrders.filter(o => o.status === OrderStatus.DELIVERED), [myOrders]);
  const cancelledOrders = useMemo(() => myOrders.filter(o => o.status === OrderStatus.CANCELLED), [myOrders]);

  useEffect(() => {
    if (selectedOrder && selectedOrder.quotes.length > 0 && selectedOrder.status === OrderStatus.AWAITING_QUOTES) {
      if (!notifiedOrderIds.has(selectedOrder.id)) {
        setNotifiedOrderIds(prev => new Set(prev).add(selectedOrder.id));
        addNotification?.(`📄 Un devis est disponible pour votre commande ${selectedOrder.id}`, 'info');
      }
    }
  }, [selectedOrder, addNotification, notifiedOrderIds]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      onNewOrder({
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
        prescriptionImageUrl: reader.result as string
      });
      setIsUploading(false);
      if (addNotification) addNotification('🚀 Ordonnance transmise aux officines', 'info');
    };
    reader.readAsDataURL(file);
  };

  const handleAcceptQuote = (orderId: string, quote: Quote) => {
    setSelectedQuote({ orderId, quote });
    setPaymentMethod('');
    setPaymentTypeChoice(null);
    setShowPaymentModal(true);
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
        paymentType: method?.type
      });
      setProcessingOrderId(null);
      setShowPaymentModal(false);
      setSelectedQuote(null);
      setActiveOrderId(null);
      setPaymentTypeChoice(null);
      setPaymentMethod('');
      if (addNotification) addNotification(`✅ Paiement ${method?.type === 'cod' ? 'à la livraison' : 'en ligne'} confirmé – Préparation en cours`, 'info');
    }, 500);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 pt-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-black text-gray-900">Bonjour, {user.name.split(' ')[0]}</h1>
            <p className="text-sm text-gray-500 mt-1">{t.patient.subtitle}</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full md:w-auto px-8 py-4 md:py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl md:rounded-2xl font-black uppercase text-base md:text-lg tracking-wider shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4"
          >
            {isUploading ? (
              <i className="fa-solid fa-spinner fa-spin text-xl md:text-2xl"></i>
            ) : (
              <>
                <i className="fa-solid fa-camera text-xl md:text-2xl"></i>
                <span className="whitespace-nowrap">{t.patient.upload_btn}</span>
              </>
            )}
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
        </header>

        <section className="space-y-8">
          {pendingOrders.length > 0 && (
            <div>
              <h2 className="text-lg md:text-xl font-black text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-amber-400 rounded-full"></span>
                En attente de devis ({pendingOrders.length})
              </h2>
              <div className="space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
                {pendingOrders.map(order => (
                  <div key={order.id} className="hidden md:block">
                    <DesktopOrderCard order={order} onClick={setActiveOrderId} t={t} />
                  </div>
                ))}
                {pendingOrders.map(order => (
                  <div key={order.id} className="md:hidden">
                    <CompactOrderCard order={order} onClick={setActiveOrderId} t={t} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {inProgressOrders.length > 0 && (
            <div>
              <h2 className="text-lg md:text-xl font-black text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                En cours ({inProgressOrders.length})
              </h2>
              <div className="space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
                {inProgressOrders.map(order => (
                  <div key={order.id} className="hidden md:block">
                    <DesktopOrderCard order={order} onClick={setActiveOrderId} t={t} />
                  </div>
                ))}
                {inProgressOrders.map(order => (
                  <div key={order.id} className="md:hidden">
                    <CompactOrderCard order={order} onClick={setActiveOrderId} t={t} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedOrders.length > 0 && (
            <div>
              <h2 className="text-lg md:text-xl font-black text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                Livrées ({completedOrders.length})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {completedOrders.map(order => (
                  <div
                    key={order.id}
                    onClick={() => setActiveOrderId(order.id)}
                    className="group relative aspect-square bg-white rounded-xl md:rounded-2xl overflow-hidden border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-all"
                  >
                    <img src={order.prescriptionImageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 md:p-3 flex flex-col justify-end">
                      <p className="text-white text-[8px] md:text-xs font-black uppercase">{order.id}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cancelledOrders.length > 0 && (
            <div>
              <h2 className="text-lg md:text-xl font-black text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                Annulées ({cancelledOrders.length})
              </h2>
              <div className="space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
                {cancelledOrders.map(order => (
                  <div key={order.id} className="hidden md:block">
                    <DesktopOrderCard order={order} onClick={setActiveOrderId} t={t} />
                  </div>
                ))}
                {cancelledOrders.map(order => (
                  <div key={order.id} className="md:hidden">
                    <CompactOrderCard order={order} onClick={setActiveOrderId} t={t} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {myOrders.length === 0 && (
            <div className="py-16 md:py-24 bg-white rounded-2xl md:rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 text-3xl md:text-4xl">
                <i className="fa-solid fa-prescription"></i>
              </div>
              <p className="text-lg md:text-xl font-black text-gray-300">Aucune commande</p>
              <p className="text-sm text-gray-400">Scannez votre première ordonnance</p>
            </div>
          )}
        </section>

        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              <div className="relative h-20 md:h-24 bg-gradient-to-r from-blue-600 to-indigo-600 p-4 md:p-6 flex items-end">
                <button
                  onClick={() => setActiveOrderId(null)}
                  className="absolute top-3 right-3 md:top-4 md:right-4 w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                >
                  <i className="fa-solid fa-xmark text-sm md:text-lg"></i>
                </button>
                <p className="text-white/80 text-[10px] md:text-xs font-black uppercase tracking-wider">Détails de la commande</p>
                <h3 className="text-lg md:text-xl font-black text-white ml-4">{selectedOrder.id}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
                {selectedOrder.quotes && selectedOrder.quotes.length > 0 ? (
                  <div className="space-y-4">
                    {selectedOrder.quotes.map((q, idx) => (
                      <div key={idx} className="space-y-3">
                        <QuoteDetails quote={q} t={t} />
                        {selectedOrder.status === OrderStatus.AWAITING_QUOTES && (
                          <button
                            onClick={() => handleAcceptQuote(selectedOrder.id, q)}
                            disabled={processingOrderId === selectedOrder.id}
                            className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-sm tracking-wider shadow-md hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-50"
                          >
                            {processingOrderId === selectedOrder.id ? 'Traitement...' : t.patient.confirm_pay}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : selectedOrder.status === OrderStatus.AWAITING_QUOTES ? (
                  <div className="py-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <i className="fa-solid fa-clock text-4xl text-gray-300 mb-3"></i>
                    <p className="text-sm font-black text-gray-800">Recherche en cours</p>
                    <p className="text-xs text-gray-500 mt-1">Nous trouvons la meilleure pharmacie</p>
                  </div>
                ) : selectedOrder.status === OrderStatus.CANCELLED ? (
                  <div className="py-12 text-center bg-red-50 rounded-xl border-2 border-red-200">
                    <i className="fa-solid fa-circle-exclamation text-4xl text-red-300 mb-3"></i>
                    <p className="text-sm font-black text-red-800">Commande annulée</p>
                    <p className="text-xs text-red-500 mt-1">Aucune pharmacie disponible au moment de la demande</p>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm font-black text-gray-800">Statut : {selectedOrder.status.replace(/_/g, ' ')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showPaymentModal && selectedQuote && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
                <h3 className="text-white text-xl font-black">
                  {paymentTypeChoice ? 'Choisissez votre mode de paiement' : 'Comment souhaitez-vous payer ?'}
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
                      onClick={() => setPaymentTypeChoice('cod')}
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
                  <>
                    {paymentMethods.filter(m => m.active && m.type === paymentTypeChoice).map(method => (
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
    </div>
  );
};

export default PatientApp;