import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Order, OrderStatus, PrescriptionItem, UserProfile, Pharmacy } from '@/types';
import { runTransaction, doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useSoundReminder } from '@/hooks/useSoundReminder';
import useTimer from '@/hooks/useTimer';

type MedicineVariant = {
  id: string;
  baseName: string;
  dci?: string;
  packaging: string;
  defaultPrice: number;
};

interface MedicineLineProps {
  t: any;
  item: PrescriptionItem;
  disabled: boolean;
  onUpdate?: (updates: Partial<PrescriptionItem>) => void;
  onRemove?: () => void;
  onPriceSave?: (medicineName: string, price: number) => void;
  storedPrices?: Record<string, number>;
  medicines: MedicineVariant[];
}

const MedicineLine: React.FC<MedicineLineProps> = ({ 
  t,
  item, 
  disabled, 
  onUpdate,
  onRemove,
  onPriceSave,
  storedPrices,
  medicines
}) => {
  const [suggestions, setSuggestions] = useState<Record<string, MedicineVariant[]>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const status = item.status || 'AVAILABLE';
  const isAvailable = status === 'AVAILABLE';
  const isGeneric = status === 'GENERIC_AVAILABLE';
  const isUnavailable = status === 'UNAVAILABLE';

  const cardBg = isUnavailable ? 'bg-rose-50/70' : isGeneric ? 'bg-amber-50/70' : 'bg-emerald-50/30';
  const borderColor = isUnavailable ? 'border-rose-200' : isGeneric ? 'border-amber-200' : 'border-emerald-100';

  const flatVariants = useMemo(() => Object.values(suggestions).flat(), [suggestions]);

  const normalizeString = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const handleNameChange = (val: string) => {
    onUpdate?.({ name: val });
    if (val.trim().length > 0) {
      const normalizedVal = normalizeString(val);
      const filtered = medicines.filter(m =>
        normalizeString(m.baseName).includes(normalizedVal)
      );
      const grouped = filtered.reduce((acc, curr) => {
        const key = curr.baseName;
        if (!acc[key]) acc[key] = [];
        acc[key].push(curr);
        return acc;
      }, {} as Record<string, MedicineVariant[]>);
      setSuggestions(grouped);
      setShowSuggestions(true);
      setActiveIdx(0);
    } else {
      setSuggestions({});
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (variant: MedicineVariant) => {
    const storedPrice = storedPrices?.[variant.baseName] || 0;
    onUpdate?.({ 
      name: variant.baseName,
      price: storedPrice > 0 ? storedPrice : (isUnavailable ? 0 : variant.defaultPrice),
      quantity: 1,
      packaging: variant.packaging,
      variantId: variant.id,
    });
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && flatVariants.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(prev => (prev < flatVariants.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectSuggestion(flatVariants[activeIdx]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`p-4 rounded-[20px] border-2 transition-all duration-300 ${cardBg} ${borderColor} ${disabled ? 'opacity-90' : 'hover:shadow-md'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0" ref={containerRef}>
          <div className="flex items-center gap-3 mb-2">
            {disabled ? (
              <p className={`text-sm font-black uppercase tracking-tight truncate ${isUnavailable ? 'text-rose-400 line-through' : 'text-slate-900'}`}>
                {item.name || "---"}
              </p>
            ) : (
              <div className="relative flex-1">
                <input 
                  value={item.name} 
                  onChange={e => handleNameChange(e.target.value)} 
                  onKeyDown={handleKeyDown}
                  onFocus={(e) => {
                    if (item.name) handleNameChange(item.name);
                    setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                  }}
                  className="w-full bg-white border-0 p-2 rounded-lg text-sm font-black text-slate-900 outline-none focus:ring-2 ring-blue-500/20 shadow-sm" 
                  placeholder={t.pharmacy.item_name_placeholder}
                  tabIndex={0}
                />
                {showSuggestions && Object.keys(suggestions).length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {Object.entries(suggestions).map(([baseName, variants]) => (
                      <div key={baseName} className="border-b border-slate-50 last:border-0">
                        <div className="px-4 py-2 bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <i className="fa-solid fa-tag text-[8px]"></i> {baseName}
                        </div>
                        {variants.map((v) => {
                          const vIdx = flatVariants.indexOf(v);
                          return (
                            <button 
                              key={v.id}
                              onClick={() => selectSuggestion(v)}
                              onMouseEnter={() => setActiveIdx(vIdx)}
                              className={`w-full px-6 py-2.5 text-left text-xs font-bold uppercase tracking-tight flex items-center justify-between transition-colors ${activeIdx === vIdx ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">{v.baseName}</span>
                                {v.dci && <span className={`text-[8px] opacity-60 font-black ${activeIdx === vIdx ? 'text-white' : 'text-slate-400'}`}>{v.dci}</span>}
                              </div>
                              <span className={`text-[9px] font-black shrink-0 ml-4 ${activeIdx === vIdx ? 'text-white' : 'text-blue-600'}`}>
                                {v.defaultPrice} DJF
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                disabled={disabled}
                onClick={() => onUpdate?.({ isColdChain: !item.isColdChain })}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border-2 ${item.isColdChain ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-200' : 'bg-white text-slate-200 border-slate-100 hover:text-blue-400 hover:border-blue-100'}`}
                title="Chaîne du froid"
              >
                <i className="fa-solid fa-snowflake text-xs"></i>
              </button>
              <button
                disabled={disabled}
                onClick={() => onUpdate?.({ isPsychotropic: !item.isPsychotropic })}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border-2 ${item.isPsychotropic ? 'bg-red-600 text-white border-red-400 shadow-md shadow-red-200' : 'bg-white text-slate-200 border-slate-100 hover:text-red-400 hover:border-red-100'}`}
                title="Psychotrope / Réglementé"
              >
                <i className="fa-solid fa-triangle-exclamation text-xs"></i>
              </button>
            </div>
          </div>
        </div>

        {!disabled && (
          <button onClick={onRemove} className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-white rounded-xl transition-all">
            <i className="fa-solid fa-trash-can text-sm"></i>
          </button>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
        
        <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-2xl border border-slate-100 gap-1 shrink-0">
          <button
            disabled={disabled}
            onClick={() => onUpdate?.({ status: 'AVAILABLE' })}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all flex items-center gap-2 ${status === 'AVAILABLE' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}
          >
            <i className="fa-solid fa-check"></i> Stock
          </button>
          <button
            disabled={disabled}
            onClick={() => onUpdate?.({ status: 'GENERIC_AVAILABLE' })}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all flex items-center gap-2 ${status === 'GENERIC_AVAILABLE' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}
          >
            <i className="fa-solid fa-repeat"></i> Générique
          </button>
          <button
            disabled={disabled}
            onClick={() => onUpdate?.({ status: 'UNAVAILABLE' })}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all flex items-center gap-2 ${status === 'UNAVAILABLE' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}
          >
            <i className="fa-solid fa-circle-xmark"></i> Rupture
          </button>
        </div>

        <div className="flex items-center gap-6 ml-auto">
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qté</span>
            <div className="flex items-center bg-white rounded-xl p-1 shadow-sm border border-slate-100">
              <input 
                disabled={disabled || isUnavailable} 
                type="number" 
                value={item.quantity} 
                onChange={e => onUpdate?.({quantity: Math.max(1, parseInt(e.target.value) || 1)})} 
                className="w-12 bg-transparent text-xs font-black text-center outline-none disabled:opacity-30" 
              />
            </div>
          </div>

          <div className="relative shrink-0">
            <input 
              disabled={disabled || isUnavailable}
              type="number" 
              value={isUnavailable ? 0 : (item.price || '')} 
              onChange={e => {
                const newPrice = parseInt(e.target.value) || 0;
                onUpdate?.({ price: newPrice });
                if (item.name && item.name.trim() !== '') {
                  onPriceSave?.(item.name, newPrice);
                }
              }} 
              className={`w-28 bg-white border-2 rounded-2xl px-4 py-2.5 text-sm text-right pr-10 font-black outline-none focus:border-blue-500 transition-all shadow-sm ${isUnavailable ? 'border-slate-100 bg-slate-50 text-slate-300' : 'border-slate-100'}`} 
              placeholder="0" 
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300 uppercase">DJF</span>
          </div>
        </div>
      </div>

      {isGeneric && (
        <p className="mt-2 text-[8px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1.5 px-1">
          <i className="fa-solid fa-circle-info"></i> Note : Substitution par un générique équivalent
        </p>
      )}
    </div>
  );
};

interface PharmacyAppProps {
  t: any;
  orders: Order[];
  onUpdateOrder: (orderId: string, updates: Partial<Order>) => void;
  drafts: Record<string, Record<string, PrescriptionItem[]>>;
  onUpdateDraft: (orderId: string, pharmacyId: string, items: PrescriptionItem[]) => void;
  onRefuseOrder: (orderId: string, pharmacyId: string) => void;
  onAcceptOrder: (orderId: string, pharmacyId: string) => void;
  onlineStatus: Record<string, boolean>;
  onToggleStatus: (id: string) => void;
  currentPharmacyId: string;
  onSetCurrentPharmacy: (id: string) => void;
  user: UserProfile;
  users: UserProfile[];
  addNotification: (message: string, type?: 'info' | 'urgent') => void;
  pharmacies: Pharmacy[];
}

const PharmacyApp: React.FC<PharmacyAppProps> = ({ 
  t, orders, onUpdateOrder, drafts, onUpdateDraft, onAcceptOrder, onRefuseOrder,
  currentPharmacyId, onSetCurrentPharmacy, onToggleStatus, onlineStatus, user, users,
  addNotification,
  pharmacies
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [linesToGenerate, setLinesToGenerate] = useState<number>(1);
  const [storedPrices, setStoredPrices] = useState<Record<string, number>>({});
  const [isSending, setIsSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [, setTimerTick] = useState(0);
  const [medicines, setMedicines] = useState<MedicineVariant[]>([]);

  const [localItems, setLocalItems] = useState<PrescriptionItem[]>([]);

  const [newOrdersIds, setNewOrdersIds] = useState<Set<string>>(new Set());
  const [preparingOrdersIds, setPreparingOrdersIds] = useState<Set<string>>(new Set());

  // ── Pharmacie de garde ────────────────────────────────────────────────────
  const [isOnDuty, setIsOnDuty] = useState<boolean>(user.isOnDuty || false);
  const [dutyNote, setDutyNote] = useState<string>(user.dutyNote || '');

  // ── Horaires d'ouverture ──────────────────────────────────────────────────
  const [showHoraires, setShowHoraires] = useState(false);
  const DEFAULT_SCHEDULE: DaySchedule = { closed: false, open: '08:00', close: '20:00' };
  const CLOSED_SCHEDULE: DaySchedule = { closed: true, open: '08:00', close: '20:00' };
  const [openingHours, setOpeningHours] = useState<OpeningHours>(user.openingHours || {
    monday:    { ...DEFAULT_SCHEDULE },
    tuesday:   { ...DEFAULT_SCHEDULE },
    wednesday: { ...DEFAULT_SCHEDULE },
    thursday:  { ...DEFAULT_SCHEDULE },
    friday:    { ...DEFAULT_SCHEDULE },
    saturday:  { closed: false, open: '09:00', close: '13:00' },
    sunday:    { ...CLOSED_SCHEDULE },
  });

  // ── Notifications push reçues ─────────────────────────────────────────────
  const [pushNotifications, setPushNotifications] = useState<PushNotification[]>([]);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [latestPush, setLatestPush] = useState<PushNotification | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isOnline = onlineStatus[currentPharmacyId];
  
  const pharmacyOrders = useMemo(() => {
    return orders.filter(o => 
      o.pharmacyId === currentPharmacyId || 
      (o.targetedPharmacyIds && o.targetedPharmacyIds.includes(currentPharmacyId))
    );
  }, [orders, currentPharmacyId]);

  const newOrders = useMemo(() => {
    return pharmacyOrders.filter(o => 
      o.status === OrderStatus.AWAITING_QUOTES && 
      !o.pharmacyId && 
      o.targetedPharmacyIds?.includes(currentPharmacyId) &&
      !o.refusedByPharmacyIds?.includes(currentPharmacyId) &&
      !o.acceptedByPharmacyIds?.includes(currentPharmacyId)
    );
  }, [pharmacyOrders, currentPharmacyId]);

  const preparingOrders = useMemo(() => {
    return pharmacyOrders.filter(o => 
      o.status === OrderStatus.PREPARING && 
      o.pharmacyId === currentPharmacyId
    );
  }, [pharmacyOrders, currentPharmacyId]);

  useSoundReminder({
    condition: newOrders.length > 0 && !(newOrdersIds.has(newOrders[0]?.id)),
    intervalMs: 60000,
    soundEnabled: true,
    onStop: () => {
      setNewOrdersIds(prev => {
        const newSet = new Set(prev);
        newOrders.forEach(o => newSet.add(o.id));
        return newSet;
      });
    }
  });

  useSoundReminder({
    condition: preparingOrders.length > 0 && !(preparingOrdersIds.has(preparingOrders[0]?.id)),
    intervalMs: 60000,
    soundEnabled: true,
    onStop: () => {
      setPreparingOrdersIds(prev => {
        const newSet = new Set(prev);
        preparingOrders.forEach(o => newSet.add(o.id));
        return newSet;
      });
    }
  });

  useEffect(() => {
    setNewOrdersIds(new Set());
    setPreparingOrdersIds(new Set());
  }, [currentPharmacyId]);

  // Charger les médicaments depuis Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'medicines'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicineVariant));
      setMedicines(list);
    });
    return unsubscribe;
  }, []);

  // ── Écouter les notifications push pour cette pharmacie ───────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'pushNotifications'),
      where('targetUid', '==', user.uid),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() } as PushNotification));
      if (notifs.length > 0) {
        setPushNotifications(notifs);
        setLatestPush(notifs[0]);
        setShowPushBanner(true);
        addNotification(notifs[0].title, 'urgent');
      }
    });
    return unsub;
  }, [user?.uid]);

  // ── Toggle pharmacie de garde ─────────────────────────────────────────────
  const handleToggleDuty = async () => {
    const newDuty = !isOnDuty;
    setIsOnDuty(newDuty);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isOnDuty: newDuty,
        dutyNote: dutyNote,
      });
      addNotification(newDuty ? '🌙 Mode garde activé' : '☀️ Mode garde désactivé', 'info');
    } catch (err) { console.error(err); }
  };

  // ── Sauvegarder les horaires ──────────────────────────────────────────────
  const handleSaveHoraires = async () => {
    try {
      await updateDoc(doc(db, 'users', user.uid), { openingHours });
      setShowHoraires(false);
      addNotification('✅ Horaires sauvegardés', 'info');
    } catch (err) { console.error(err); }
  };

  // ── Marquer notification comme lue ───────────────────────────────────────
  const handleDismissPush = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'pushNotifications', notifId), { read: true });
      setShowPushBanner(false);
      setLatestPush(null);
    } catch (err) { console.error(err); }
  };

  // ── Calcul ouverture actuelle ─────────────────────────────────────────────
  const isOpenNow = (): boolean => {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const now = new Date();
    const day = days[now.getDay()] as keyof OpeningHours;
    const schedule = openingHours[day];
    if (!schedule || schedule.closed) return false;
    const [oh, om] = schedule.open.split(':').map(Number);
    const [ch, cm] = schedule.close.split(':').map(Number);
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const openMins = oh * 60 + om;
    const closeMins = ch * 60 + cm;
    return currentMins >= openMins && currentMins <= closeMins;
  };

  const filteredOrders = useMemo(() => {
    if (filterStatus === 'all') return pharmacyOrders;
    return pharmacyOrders.filter(o => o.status === filterStatus);
  }, [pharmacyOrders, filterStatus]);

  const currentOrder = orders.find(o => o.id === selectedOrderId);
  const isAcceptedByMe = currentOrder?.pharmacyId === currentPharmacyId;
  const hasAccepted = currentOrder?.acceptedByPharmacyIds?.includes(currentPharmacyId);
  const sentQuote = currentOrder?.quotes?.find(q => q.pharmacyId === currentPharmacyId);
  
  const rawSla = useTimer(currentOrder?.deadline);
  const shouldShowTimer = currentOrder && 
    currentOrder.status === OrderStatus.AWAITING_QUOTES && 
    !currentOrder.pharmacyId && 
    !sentQuote;
  const sla = shouldShowTimer ? rawSla : null;

  useEffect(() => {
    if (currentOrder) {
      const items = sentQuote ? sentQuote.items : (drafts[currentOrder.id]?.[currentPharmacyId] || currentOrder.items || []);
      setLocalItems(items);
    } else {
      setLocalItems([]);
    }
  }, [currentOrder, drafts, sentQuote, currentPharmacyId]);

  const awaitingQuotes = pharmacyOrders.filter(o => o.status === OrderStatus.AWAITING_QUOTES && !o.pharmacyId).length;
  const inPreparation = pharmacyOrders.filter(o => o.status === OrderStatus.PREPARING).length;
  const outForDelivery = pharmacyOrders.filter(o => o.status === OrderStatus.OUT_FOR_DELIVERY).length;
  const delivered = pharmacyOrders.filter(o => o.status === OrderStatus.DELIVERED).length;
  const cancelled = pharmacyOrders.filter(o => o.status === OrderStatus.CANCELLED).length;
  const totalOrders = pharmacyOrders.length;
  const responseRate = totalOrders === 0 ? 0 : 
    Math.round(((awaitingQuotes + inPreparation + outForDelivery + delivered) / totalOrders) * 100);
  const todayRevenue = pharmacyOrders
    .filter(o => o.status === OrderStatus.DELIVERED && new Date(o.timestamp).toDateString() === new Date().toDateString())
    .reduce((sum, o) => sum + (o.totalAmount || 0) + (o.deliveryFee || 0), 0);

  useEffect(() => {
    const key = `prices_${currentPharmacyId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setStoredPrices(JSON.parse(stored));
    } else {
      setStoredPrices({});
    }
  }, [currentPharmacyId]);

  const handlePriceSave = (medicineName: string, price: number) => {
    setStoredPrices(prev => {
      const newPrices = { ...prev, [medicineName]: price };
      localStorage.setItem(`prices_${currentPharmacyId}`, JSON.stringify(newPrices));
      return newPrices;
    });
  };

  const currentItems = localItems;

  useEffect(() => {
    setLinesToGenerate(currentItems.length > 0 ? currentItems.length : 1);
  }, [currentOrder?.id, currentItems.length]);

  const addItemToDraft = () => {
    if (!currentOrder) {
      addNotification("Erreur : aucune commande sélectionnée", 'urgent');
      return;
    }
    const newItem: PrescriptionItem = { 
      name: '', 
      dosage: '', 
      quantity: 1, 
      isPsychotropic: false, 
      isColdChain: false,
      status: 'AVAILABLE', 
      price: 0 
    };
    const newItems = [...currentItems, newItem];
    setLocalItems(newItems);
    onUpdateDraft(currentOrder.id, currentPharmacyId, newItems);
    addNotification("Ligne ajoutée", 'info');
  };

  const generateEmptyLines = (count: number) => {
    if (!currentOrder) return;
    if (currentItems.length > 0) {
      if (!window.confirm(`Remplacer les ${currentItems.length} lignes actuelles par ${count} nouvelles lignes vides ?`)) {
        return;
      }
    }
    const newLines = Array.from({ length: count }, () => ({
      name: '',
      dosage: '',
      quantity: 1,
      isPsychotropic: false,
      isColdChain: false,
      status: 'AVAILABLE' as const,
      price: 0
    }));
    setLocalItems(newLines);
    onUpdateDraft(currentOrder.id, currentPharmacyId, newLines);
  };

  const handleItemUpdate = (index: number, updates: Partial<PrescriptionItem>) => {
    const newItems = [...currentItems];
    newItems[index] = { ...newItems[index], ...updates };
    setLocalItems(newItems);
    onUpdateDraft(currentOrder.id, currentPharmacyId, newItems);
    setValidationError(null);
  };

  const handleItemRemove = (index: number) => {
    const newItems = currentItems.filter((_, i) => i !== index);
    setLocalItems(newItems);
    onUpdateDraft(currentOrder.id, currentPharmacyId, newItems);
  };

  const sendQuote = async () => {
    if (!currentOrder || isSending) return;
    const items = currentItems;
    
    for (const item of items) {
      if (!item.name || item.name.trim() === '') {
        setValidationError("ERREUR : Un nom est requis pour chaque médicament.");
        return;
      }
      if (item.status !== 'UNAVAILABLE') {
        if (!item.price || item.price <= 0) {
          setValidationError(`ERREUR PRIX : Saisissez un montant valide pour "${item.name}".`);
          return;
        }
        if (!item.quantity || item.quantity <= 0) {
          setValidationError(`ERREUR QUANTITÉ : La quantité pour "${item.name}" doit être au moins de 1.`);
          return;
        }
      }
    }

    setIsSending(true);
    const total = items.reduce((s, i) => i.status !== 'UNAVAILABLE' ? s + ((i.price || 0) * (i.quantity || 1)) : s, 0);
    
    const pharmacyName = pharmacies.find(p => p.id === currentPharmacyId)?.name
      || user.pharmacyName
      || currentPharmacyId;
    const pharmacyAddress = user.pharmacyAddress || '';

    onUpdateOrder(currentOrder.id, {
      quotes: [...(currentOrder.quotes || []), {
        pharmacyId: currentPharmacyId,
        pharmacyName,
        pharmacyAddress,
        items,
        totalAmount: total,
        deliveryFee: 500,
        estimatedTime: 15,
        isOnDuty,           // ✅ Info garde incluse dans le devis
        isOpenNow: isOpenNow(), // ✅ Info horaires incluse dans le devis
      }]
    });
    addNotification('📤 Devis envoyé avec succès', 'info');
    setValidationError(null);
    setSelectedOrderId(null);
    setIsSending(false);
  };

  const groupedItems = useMemo(() => {
    const list = currentItems.map((item, originalIndex) => ({ item, originalIndex }));
    return {
      stock: list.filter(x => (x.item.status || 'AVAILABLE') === 'AVAILABLE'),
      generic: list.filter(x => x.item.status === 'GENERIC_AVAILABLE'),
      unavailable: list.filter(x => x.item.status === 'UNAVAILABLE')
    };
  }, [currentItems]);

  const handleAccept = (orderId: string) => {
    onAcceptOrder(orderId, currentPharmacyId);
    setSelectedOrderId(orderId);
    setNewOrdersIds(prev => new Set(prev).add(orderId));
  };

  const handleRefuse = (orderId: string) => {
    onRefuseOrder(orderId, currentPharmacyId);
    setSelectedOrderId(null);
    setNewOrdersIds(prev => new Set(prev).add(orderId));
  };

  const getActionButton = (order: Order) => {
    const isAwaiting = order.status === OrderStatus.AWAITING_QUOTES && !order.pharmacyId;
    const isPreparing = order.status === OrderStatus.PREPARING;
    const isReady = order.status === OrderStatus.READY_FOR_PICKUP;
    const isOut = order.status === OrderStatus.OUT_FOR_DELIVERY;
    const isDelivered = order.status === OrderStatus.DELIVERED;
    const isCancelled = order.status === OrderStatus.CANCELLED;

    if (isAwaiting) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedOrderId(order.id); }}
          className="text-[9px] font-black uppercase px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all"
        >
          Répondre
        </button>
      );
    } else if (isPreparing) {
      return <span className="text-[9px] font-black uppercase px-4 py-2 rounded-xl bg-amber-100 text-amber-600 cursor-default">En préparation</span>;
    } else if (isReady) {
      return <span className="text-[9px] font-black uppercase px-4 py-2 rounded-xl bg-emerald-100 text-emerald-600 cursor-default">Prête</span>;
    } else if (isOut) {
      return <span className="text-[9px] font-black uppercase px-4 py-2 rounded-xl bg-blue-100 text-blue-600 cursor-default">En livraison</span>;
    } else if (isDelivered) {
      return <span className="text-[9px] font-black uppercase px-4 py-2 rounded-xl bg-slate-200 text-slate-500 cursor-default">Livrée</span>;
    } else if (isCancelled) {
      return <span className="text-[9px] font-black uppercase px-4 py-2 rounded-xl bg-red-100 text-red-600 cursor-default">Annulée</span>;
    }
    return null;
  };

  useEffect(() => {
    if (currentOrder) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [currentOrder]);

  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentOrder && modalContentRef.current) {
      modalContentRef.current.scrollTop = 0;
    }
  }, [currentOrder]);

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <nav className="bg-white px-6 py-4 border-b flex justify-between items-center shrink-0">
        <div className="flex gap-2 overflow-x-auto">
          {pharmacies.map(p => (
            <button key={p.id} onClick={() => { onSetCurrentPharmacy(p.id); setSelectedOrderId(null); }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${currentPharmacyId === p.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Onglets */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            <button onClick={() => setActiveSection('orders')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeSection === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <i className="fa-solid fa-list-check"></i> Commandes
            </button>
            <button onClick={() => setActiveSection('catalogue')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeSection === 'catalogue' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <i className="fa-solid fa-box"></i> Catalogue
            </button>
          </div>

          {/* Horaires */}
          <button onClick={() => setShowHoraires(true)}
            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase border-2 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-all">
            <i className="fa-solid fa-clock"></i>
            {isOpenNow() ? <span className="text-emerald-600">OUVERT</span> : <span className="text-red-500">FERMÉ</span>}
          </button>

          {/* Garde */}
          <button onClick={handleToggleDuty}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase border-2 flex items-center gap-1.5 transition-all ${
              isOnDuty ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
            }`}>
            <i className={`fa-solid fa-moon ${isOnDuty ? 'animate-pulse' : ''}`}></i>
            {isOnDuty ? 'DE GARDE' : 'Garde'}
          </button>

          {/* Statut en ligne */}
          <button onClick={() => onToggleStatus(currentPharmacyId)}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase border-2 flex items-center gap-2 ${isOnline ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
            {isOnline ? t.pharmacy.online : t.pharmacy.offline}
          </button>
        </div>
      </nav>

      {/* ── Bandeau notification push urgente ── */}
      {showPushBanner && latestPush && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 flex items-center justify-between animate-in slide-in-from-top duration-300 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <i className="fa-solid fa-bell text-lg animate-bounce"></i>
            </div>
            <div>
              <p className="font-black text-sm">{latestPush.title}</p>
              <p className="text-emerald-100 text-xs mt-0.5">{latestPush.message}</p>
            </div>
          </div>
          <button onClick={() => handleDismissPush(latestPush.id!)}
            className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all shrink-0 ml-4">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* ── Modal Horaires d'ouverture ── */}
      {showHoraires && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-slate-900 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-white font-black text-lg uppercase tracking-tight">Horaires d'ouverture</h2>
                <p className="text-slate-400 text-xs mt-0.5">Définissez vos heures pour chaque jour</p>
              </div>
              <button onClick={() => setShowHoraires(false)} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map(day => {
                const labels: Record<string, string> = {
                  monday:'Lundi', tuesday:'Mardi', wednesday:'Mercredi',
                  thursday:'Jeudi', friday:'Vendredi', saturday:'Samedi', sunday:'Dimanche'
                };
                const schedule = openingHours[day];
                return (
                  <div key={day} className="flex items-center gap-3">
                    <p className="w-24 text-xs font-black text-slate-700 uppercase shrink-0">{labels[day]}</p>
                    <label className="flex items-center gap-1.5 shrink-0">
                      <input type="checkbox" checked={!schedule.closed}
                        onChange={e => setOpeningHours(prev => ({ ...prev, [day]: { ...prev[day], closed: !e.target.checked } }))}
                        className="w-4 h-4 accent-emerald-600" />
                      <span className="text-[10px] font-bold text-slate-500">{schedule.closed ? 'FERMÉ' : 'OUVERT'}</span>
                    </label>
                    {!schedule.closed && (
                      <>
                        <input type="time" value={schedule.open}
                          onChange={e => setOpeningHours(prev => ({ ...prev, [day]: { ...prev[day], open: e.target.value } }))}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-slate-900" />
                        <span className="text-slate-400 text-xs font-bold">→</span>
                        <input type="time" value={schedule.close}
                          onChange={e => setOpeningHours(prev => ({ ...prev, [day]: { ...prev[day], close: e.target.value } }))}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-slate-900" />
                      </>
                    )}
                    {schedule.closed && <div className="flex-1 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-[10px] text-slate-400 font-bold">Fermé ce jour</div>}
                  </div>
                );
              })}

              {/* Note de garde */}
              <div className="pt-3 border-t border-slate-100">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1.5">Note de garde (optionnel)</label>
                <input value={dutyNote} onChange={e => setDutyNote(e.target.value)}
                  placeholder="Ex: Garde de nuit jusqu'à 6h00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-900" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowHoraires(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-xs tracking-widest transition-all">
                Annuler
              </button>
              <button onClick={handleSaveHoraires}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all">
                <i className="fa-solid fa-floppy-disk mr-2"></i>Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 relative">
        {currentOrder && (
          <div 
            className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 pt-10"
            onClick={() => setSelectedOrderId(null)}
          >
            <div 
              className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl h-[90vh] overflow-hidden flex flex-col md:flex-row relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedOrderId(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>

              <div className="w-full md:w-2/5 bg-slate-900 p-6 flex items-center justify-center relative">
                <img src={currentOrder.prescriptionImageUrl} alt="Ordonnance" className="max-w-full max-h-full object-contain rounded-lg" />
                {sla && (
                  <div className={`absolute top-2 right-2 px-3 py-1 rounded-lg text-xs font-black ${sla.isUrgent ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-white'}`}>
                    {sla.text}
                  </div>
                )}
                {sentQuote && !sla && (
                  <div className="absolute top-2 right-2 px-3 py-1 rounded-lg text-xs font-black bg-green-600 text-white">
                    Devis envoyé
                  </div>
                )}
              </div>

              <div className="w-full md:w-3/5 flex flex-col h-full">
                <div className="sticky top-0 bg-white z-10 p-6 pb-4 border-b border-slate-100 shadow-sm">
                  <p className="text-blue-600 text-xs font-black">Dossier {currentOrder.id}</p>
                  <h3 className="text-xl font-black">{users.find(u => u.uid === currentOrder.patientId)?.name || currentOrder.patientName}</h3>
                </div>

                <div ref={modalContentRef} className="flex-1 overflow-y-auto p-6">
                  {currentOrder.pharmacyId && currentOrder.pharmacyId !== currentPharmacyId ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <p className="text-lg font-black mb-4 text-red-600">Commande déjà attribuée</p>
                      <p className="text-sm text-slate-500 text-center">Cette commande a été prise par une autre pharmacie.</p>
                    </div>
                  ) : !isAcceptedByMe && !hasAccepted && currentOrder.status === OrderStatus.AWAITING_QUOTES ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <p className="text-lg font-black mb-8">Nouvelle mission</p>
                      <p className="text-sm text-slate-500 mb-8 text-center">Acceptez pour saisir le devis et verrouiller la mission.</p>
                      <div className="flex gap-4">
                        <button onClick={() => handleAccept(currentOrder.id)} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-black">Accepter</button>
                        <button onClick={() => handleRefuse(currentOrder.id)} className="px-8 py-4 bg-red-50 text-red-600 rounded-xl font-black border border-red-200">Refuser</button>
                      </div>
                    </div>
                  ) : (isAcceptedByMe || hasAccepted) ? (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-black text-xs text-slate-400">Articles ({currentItems.length})</h4>
                        {!sentQuote && (
                          <div className="flex gap-2">
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={linesToGenerate}
                                onChange={e => setLinesToGenerate(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-10 bg-white border-0 text-center text-[10px] font-black rounded-lg focus:ring-2 ring-blue-500/10 outline-none"
                              />
                              <button
                                onClick={() => generateEmptyLines(linesToGenerate)}
                                className="px-3 py-1 text-[9px] font-black uppercase text-slate-500 hover:text-blue-600 transition-colors"
                                title="Générer plusieurs lignes vides"
                              >
                                Générer
                              </button>
                            </div>
                            <button onClick={addItemToDraft} className="text-blue-600 font-black text-[10px] uppercase hover:text-slate-950 flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 active:scale-95 transition-all shadow-sm">
                              <i className="fa-solid fa-plus-circle"></i> Ajouter
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-6">
                        {groupedItems.stock.length > 0 && (
                          <div>
                            <h5 className="text-[10px] font-black uppercase text-emerald-600 mb-2">En stock</h5>
                            {groupedItems.stock.map(x => (
                              <MedicineLine
                                key={x.originalIndex}
                                t={t}
                                item={x.item}
                                disabled={!!sentQuote}
                                storedPrices={storedPrices}
                                onPriceSave={handlePriceSave}
                                onUpdate={(u) => handleItemUpdate(x.originalIndex, u)}
                                onRemove={() => handleItemRemove(x.originalIndex)}
                                medicines={medicines}
                              />
                            ))}
                          </div>
                        )}
                        {groupedItems.generic.length > 0 && (
                          <div>
                            <h5 className="text-[10px] font-black uppercase text-amber-600 mb-2">Génériques</h5>
                            {groupedItems.generic.map(x => (
                              <MedicineLine
                                key={x.originalIndex}
                                t={t}
                                item={x.item}
                                disabled={!!sentQuote}
                                storedPrices={storedPrices}
                                onPriceSave={handlePriceSave}
                                onUpdate={(u) => handleItemUpdate(x.originalIndex, u)}
                                onRemove={() => handleItemRemove(x.originalIndex)}
                                medicines={medicines}
                              />
                            ))}
                          </div>
                        )}
                        {groupedItems.unavailable.length > 0 && (
                          <div>
                            <h5 className="text-[10px] font-black uppercase text-rose-600 mb-2">Rupture</h5>
                            {groupedItems.unavailable.map(x => (
                              <MedicineLine
                                key={x.originalIndex}
                                t={t}
                                item={x.item}
                                disabled={!!sentQuote}
                                storedPrices={storedPrices}
                                onPriceSave={handlePriceSave}
                                onUpdate={(u) => handleItemUpdate(x.originalIndex, u)}
                                onRemove={() => handleItemRemove(x.originalIndex)}
                                medicines={medicines}
                              />
                            ))}
                          </div>
                        )}
                        {currentItems.length === 0 && (
                          <div className="py-10 text-center text-slate-400 text-sm">Aucun article saisi</div>
                        )}
                      </div>

                      <div className="border-t pt-4 mt-4">
                        {validationError && <p className="text-red-500 text-xs mb-2">{validationError}</p>}
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-xs text-slate-400">Total</p>
                            <p className="text-2xl font-black">
                              {currentItems.reduce((s, i) => i.status !== 'UNAVAILABLE' ? s + (i.price || 0) * i.quantity : s, 0)} DJF
                            </p>
                          </div>

                          {currentOrder.status === OrderStatus.AWAITING_QUOTES && !sentQuote && (
                            <button
                              disabled={currentItems.length === 0 || isSending}
                              onClick={sendQuote}
                              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-xs disabled:opacity-50"
                            >
                              {isSending ? 'Envoi...' : 'Envoyer le devis'}
                            </button>
                          )}
                          {currentOrder.status === OrderStatus.AWAITING_QUOTES && sentQuote && (
                            <span className="text-blue-600 text-xs font-black">Devis envoyé</span>
                          )}
                          {currentOrder.status === OrderStatus.PREPARING && (
                            <button
                              onClick={() => {
                                onUpdateOrder(currentOrder.id, { status: OrderStatus.READY_FOR_PICKUP });
                                setSelectedOrderId(null);
                              }}
                              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs"
                            >
                              {t.pharmacy.ready_to_pick || "Colis prêt"}
                            </button>
                          )}
                          {currentOrder.status === OrderStatus.READY_FOR_PICKUP && (
                            <span className="text-emerald-600 text-xs font-black">Prêt à être retiré</span>
                          )}
                          {currentOrder.status === OrderStatus.OUT_FOR_DELIVERY && (
                            <span className="text-blue-600 text-xs font-black">En livraison</span>
                          )}
                          {currentOrder.status === OrderStatus.DELIVERED && (
                            <span className="text-slate-600 text-xs font-black">Livrée</span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{user.pharmacyName || 'PharmaDash'}</h1>
              <p className="text-blue-600 font-black text-[10px] uppercase tracking-[0.3em] mt-1 italic">Responsable : {user.name}</p>
            </div>
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Officine Connectée</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Ordonnances en attente</p>
              <div className="flex items-end justify-between">
                <span className="text-4xl font-black text-slate-900">{awaitingQuotes}</span>
                <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">Répondre &lt; 5 min</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2">En préparation</p>
              <div className="flex items-end justify-between">
                <span className="text-4xl font-black text-slate-900">{inPreparation}</span>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">À livrer</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Livraisons du jour</p>
              <div className="flex items-end justify-between">
                <span className="text-4xl font-black text-slate-900">{outForDelivery}</span>
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">En cours</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Revenus</p>
              <div className="flex items-end justify-between">
                <span className="text-4xl font-black text-slate-900">{todayRevenue.toLocaleString()} <span className="text-xs font-black text-slate-400">FDJ</span></span>
                <span className="text-[10px] font-black text-slate-400">Aujourd'hui</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 mb-8 p-4 bg-white rounded-3xl border-2 border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400">Taux réponse</span>
              <span className="text-sm font-black text-emerald-600">{responseRate}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400">Traitées</span>
              <span className="text-sm font-black text-slate-900">{awaitingQuotes + inPreparation + outForDelivery + delivered}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400">Livrées</span>
              <span className="text-sm font-black text-slate-900">{delivered}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400">Annulées</span>
              <span className="text-sm font-black text-red-500">{cancelled}</span>
            </div>
          </div>

          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {['all', OrderStatus.AWAITING_QUOTES, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.CANCELLED].map(status => {
              let label = 'Toutes';
              if (status === OrderStatus.AWAITING_QUOTES) label = 'En attente';
              else if (status === OrderStatus.PREPARING) label = 'En préparation';
              else if (status === OrderStatus.READY_FOR_PICKUP) label = 'Prêtes';
              else if (status === OrderStatus.OUT_FOR_DELIVERY) label = 'En livraison';
              else if (status === OrderStatus.DELIVERED) label = 'Livrées';
              else if (status === OrderStatus.CANCELLED) label = 'Annulées';
              return (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status as any)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all ${
                    filterStatus === status ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-3xl border-2 border-slate-100 p-6">
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 mb-6">Gestion des ordonnances</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[8px] font-black uppercase text-slate-400 border-b border-slate-100">
                    <th className="pb-4">N°</th>
                    <th className="pb-4">Patient</th>
                    <th className="pb-4">Produits</th>
                    <th className="pb-4">Distance</th>
                    <th className="pb-4">Temps</th>
                    <th className="pb-4">Statut</th>
                    <th className="pb-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map(order => {
                    const deadline = order.deadline ? new Date(order.deadline) : null;
                    const now = new Date();
                    const isExpired = deadline && deadline < now;
                    const productCount = order.items?.length || order.quotes?.[0]?.items?.length || 0;
                    const pharmacy = order.targetedPharmacyIds?.[0] ? pharmacies.find(p => p.id === order.targetedPharmacyIds[0]) : null;
                    const distance = pharmacy ? pharmacy.distance.toFixed(1) + ' km' : '—';

                    let statusText = '';
                    if (order.status === OrderStatus.AWAITING_QUOTES) statusText = order.pharmacyId ? 'Acceptée' : 'En attente';
                    else if (order.status === OrderStatus.PREPARING) statusText = 'Préparation';
                    else if (order.status === OrderStatus.READY_FOR_PICKUP) statusText = 'Prête';
                    else if (order.status === OrderStatus.OUT_FOR_DELIVERY) statusText = 'En livraison';
                    else if (order.status === OrderStatus.DELIVERED) statusText = 'Livrée';
                    else if (order.status === OrderStatus.CANCELLED) statusText = 'Annulée';

                    return (
                      <tr key={order.id} onClick={() => setSelectedOrderId(order.id)} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                        <td className="py-4 text-xs font-black text-blue-400">#{order.id.slice(-6)}</td>
                        <td className="py-4 text-sm font-black text-slate-900">{order.patientName}</td>
                        <td className="py-4 text-xs font-bold text-slate-600">{productCount} Produits</td>
                        <td className="py-4 text-xs text-slate-500">{distance}</td>
                        <td className="py-4">
                          {order.status === OrderStatus.DELIVERED ? (
                            <span className="text-[9px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded">Livrée</span>
                          ) : order.status === OrderStatus.CANCELLED ? (
                            <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-1 rounded">Annulée</span>
                          ) : isExpired ? (
                            <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-1 rounded">Expiré</span>
                          ) : order.deadline ? (
                            (() => {
                              const now = new Date();
                              const deadline = new Date(order.deadline);
                              const diffSeconds = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
                              const minutes = Math.floor(diffSeconds / 60);
                              const seconds = diffSeconds % 60;
                              const isUrgent = diffSeconds < 120;
                              return (
                                <span className={`text-[9px] font-black px-2 py-1 rounded ${isUrgent ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                  {minutes}:{seconds < 10 ? '0' : ''}{seconds}
                                </span>
                              );
                            })()
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-4">
                          <span className="text-[9px] font-black text-slate-600">{statusText}</span>
                        </td>
                        <td className="py-4" onClick={(e) => e.stopPropagation()}>
                          {getActionButton(order)}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-sm italic">Aucune commande</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PharmacyApp;