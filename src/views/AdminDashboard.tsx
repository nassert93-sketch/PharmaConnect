import React, { useMemo, useState } from 'react';
import { Order, OrderStatus, PaymentMethod, UserProfile, UserStatus, UserRole } from '@/types';
import { MOCK_PHARMACIES } from '@/mockData';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  time: number;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}

interface AdminDashboardProps {
  t: any;
  orders: Order[];
  pharmacyOnlineStatus: Record<string, boolean>;
  pharmacyOfflineSince: Record<string, string | null>;
  onTogglePharmacy: (id: string) => void;
  deactivatedDriverIds: Set<string>;
  onToggleDriver: (id: string) => void;
  deliveryZones: DeliveryZone[];
  onUpdateZones: (zones: DeliveryZone[]) => void;
  slaMinutes: number;
  onSlaMinutesChange: (minutes: number) => void;
  paymentMethods: PaymentMethod[];
  onUpdatePaymentMethods: (methods: PaymentMethod[]) => void;
  users: UserProfile[];
  onSwitchRole?: (role: UserRole) => void;
}

const Card = ({ title, children, className = "" }: { title: string, children: React.ReactNode, className?: string }) => (
  <div className={`bg-slate-800/50 p-6 rounded-[32px] border-2 border-slate-700 shadow-inner ${className}`}>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{title}</p>
    {children}
  </div>
);

const Toggle = ({ active, onToggle, label }: { active: boolean, onToggle: () => void, label: string }) => (
  <div className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-slate-700">
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">{label}</span>
    <button 
      onClick={onToggle}
      className={`w-12 h-6 rounded-full relative transition-all duration-300 ${active ? 'bg-blue-600' : 'bg-slate-600'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${active ? 'left-7' : 'left-1'}`} />
    </button>
  </div>
);

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  t,
  orders, 
  pharmacyOnlineStatus, 
  onTogglePharmacy,
  deactivatedDriverIds,
  onToggleDriver,
  deliveryZones,
  onUpdateZones,
  slaMinutes,
  onSlaMinutesChange,
  paymentMethods,
  onUpdatePaymentMethods,
  users,
  onSwitchRole
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'pharmacies' | 'drivers' | 'gallery' | 'settings' | 'campaigns' | 'loyalty' | 'notifications' | 'orders' | 'payments' | 'users'>('analytics');

  const handleUpdateUserStatus = async (uid: string, status: UserStatus) => {
    try {
      await updateDoc(doc(db, 'users', uid), { status });
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const pendingUsers = users.filter(u => u.status === UserStatus.PENDING);
  const approvedUsers = users.filter(u => u.status === UserStatus.APPROVED);

  const [settings, setSettings] = useState({
    currency: 'DJF',
    taxes: {
      commission: 10,
      tva: 5,
      serviceFee: 200
    },
    featureFlags: {
      campaigns: true,
      loyalty: true,
      cashback: false,
      pushNotifications: true,
      onlinePayment: false
    }
  });

  const [campaigns, setCampaigns] = useState([
    { id: '1', name: 'Ouverture PharmaConnect', type: 'FIXED', value: 1000, minAmount: 5000, active: true, start: '2023-10-01', end: '2023-12-31' },
    { id: '2', name: 'Livraison Offerte Héron', type: 'FREE_DELIVERY', value: 0, minAmount: 2000, active: false, start: '2023-11-01', end: '2023-11-30' }
  ]);

  const [notifications, setSentNotifications] = useState([
    { id: '1', title: 'Maintenance Hub', message: 'Le hub sera en maintenance ce soir à 23h.', date: '2023-10-25', status: 'SENT' }
  ]);

  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: 'percentage',
    value: 0,
    minAmount: 0,
    startDate: '',
    endDate: ''
  });

  const [showNewZoneForm, setShowNewZoneForm] = useState(false);
  const [newZone, setNewZone] = useState({
    name: '',
    fee: 0,
    time: 0,
    centerLat: '',
    centerLng: '',
    radiusKm: ''
  });

  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingZoneData, setEditingZoneData] = useState({
    name: '',
    fee: 0,
    time: 0,
    centerLat: '',
    centerLng: '',
    radiusKm: ''
  });

  const [newNotification, setNewNotification] = useState({
    target: 'all',
    title: '',
    message: ''
  });

  const [loyaltyConfig, setLoyaltyConfig] = useState({
    type: 'points',
    accumulation: 100,
    pointsToDjf: 100,
    djfValue: 500
  });

  // États pour la gestion des moyens de paiement (avec logo et type)
  const [newPaymentMethod, setNewPaymentMethod] = useState({ name: '', icon: '', code: '', logo: '', type: 'online' as 'online' | 'cod' });
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [editMethodData, setEditMethodData] = useState({ name: '', icon: '', code: '', active: true, logo: '', type: 'online' as 'online' | 'cod' });

  // Calcul des statistiques de paiement par méthode
  const paymentStats = useMemo(() => {
    const ordersWithPayment = orders.filter(o => o.paymentMethod && (o.paymentType || paymentMethods.find(p => p.code === o.paymentMethod)?.type));
    const total = ordersWithPayment.length;
    
    // Par méthode de paiement
    const methodStats = paymentMethods.map(method => {
      const ordersOfMethod = ordersWithPayment.filter(o => o.paymentMethod === method.code);
      const count = ordersOfMethod.length;
      const totalAmount = ordersOfMethod.reduce((sum, o) => sum + (o.totalAmount || 0) + (o.deliveryFee || 0), 0);
      const percent = total ? (count / total) * 100 : 0;
      return {
        ...method,
        count,
        totalAmount,
        percent: Math.round(percent * 10) / 10
      };
    }).filter(m => m.count > 0); // ne garder que ceux utilisés

    // Total par type (online / cod)
    const onlineCount = methodStats.filter(m => m.type === 'online').reduce((acc, m) => acc + m.count, 0);
    const codCount = methodStats.filter(m => m.type === 'cod').reduce((acc, m) => acc + m.count, 0);
    const onlinePercent = total ? (onlineCount / total) * 100 : 0;
    const codPercent = total ? (codCount / total) * 100 : 0;

    // Données pour le graphique en camembert (répartition par méthode)
    const pieData = methodStats.map(m => ({
      name: m.name,
      value: m.count,
      percent: m.percent
    }));

    // Données pour le graphique en barres (montants par méthode)
    const barData = methodStats.map(m => ({
      name: m.name,
      montant: m.totalAmount,
      type: m.type
    }));

    return {
      total,
      onlineCount,
      codCount,
      onlinePercent: Math.round(onlinePercent * 10) / 10,
      codPercent: Math.round(codPercent * 10) / 10,
      methodStats,
      pieData,
      barData
    };
  }, [orders, paymentMethods]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

  const toggleFlag = (flag: keyof typeof settings.featureFlags) => {
    setSettings(prev => ({
      ...prev,
      featureFlags: { ...prev.featureFlags, [flag]: !prev.featureFlags[flag] }
    }));
  };

  const addCampaign = () => {
    if (!newCampaign.name) return;
    const newId = (campaigns.length + 1).toString();
    setCampaigns([...campaigns, {
      id: newId,
      name: newCampaign.name,
      type: newCampaign.type.toUpperCase(),
      value: newCampaign.value,
      minAmount: newCampaign.minAmount,
      start: newCampaign.startDate,
      end: newCampaign.endDate,
      active: true
    }]);
    setShowNewCampaignForm(false);
    setNewCampaign({ name: '', type: 'percentage', value: 0, minAmount: 0, startDate: '', endDate: '' });
  };

  const addZone = () => {
    if (!newZone.name || newZone.fee <= 0 || newZone.time <= 0 || !newZone.centerLat || !newZone.centerLng || !newZone.radiusKm) return;
    const newId = (deliveryZones.length + 1).toString();
    onUpdateZones([
      ...deliveryZones,
      {
        id: newId,
        name: newZone.name,
        fee: newZone.fee,
        time: newZone.time,
        centerLat: parseFloat(newZone.centerLat),
        centerLng: parseFloat(newZone.centerLng),
        radiusKm: parseFloat(newZone.radiusKm)
      }
    ]);
    setShowNewZoneForm(false);
    setNewZone({ name: '', fee: 0, time: 0, centerLat: '', centerLng: '', radiusKm: '' });
  };

  const removeZone = (id: string) => {
    onUpdateZones(deliveryZones.filter(z => z.id !== id));
  };

  const startEditZone = (zone: DeliveryZone) => {
    setEditingZoneId(zone.id);
    setEditingZoneData({
      name: zone.name,
      fee: zone.fee,
      time: zone.time,
      centerLat: zone.centerLat?.toString() || '',
      centerLng: zone.centerLng?.toString() || '',
      radiusKm: zone.radiusKm?.toString() || ''
    });
  };

  const saveEditZone = (id: string) => {
    onUpdateZones(deliveryZones.map(z =>
      z.id === id
        ? {
            ...z,
            name: editingZoneData.name,
            fee: editingZoneData.fee,
            time: editingZoneData.time,
            centerLat: parseFloat(editingZoneData.centerLat),
            centerLng: parseFloat(editingZoneData.centerLng),
            radiusKm: parseFloat(editingZoneData.radiusKm)
          }
        : z
    ));
    setEditingZoneId(null);
    setEditingZoneData({ name: '', fee: 0, time: 0, centerLat: '', centerLng: '', radiusKm: '' });
  };

  const cancelEditZone = () => {
    setEditingZoneId(null);
    setEditingZoneData({ name: '', fee: 0, time: 0, centerLat: '', centerLng: '', radiusKm: '' });
  };

  const sendNotification = () => {
    if (!newNotification.title || !newNotification.message) return;
    const newId = (notifications.length + 1).toString();
    setSentNotifications([
      {
        id: newId,
        title: newNotification.title,
        message: newNotification.message,
        date: new Date().toISOString().split('T')[0],
        status: 'SENT'
      },
      ...notifications
    ]);
    setNewNotification({ target: 'all', title: '', message: '' });
    alert('Notification envoyée (simulation)');
  };

  const saveLoyaltyConfig = () => {
    alert('Configuration fidélité sauvegardée');
  };

  // Gestion des moyens de paiement avec logo
  const addPaymentMethod = () => {
    if (!newPaymentMethod.name || !newPaymentMethod.icon || !newPaymentMethod.code) return;
    const newMethod: PaymentMethod = {
      id: Math.random().toString(36).substr(2, 9),
      name: newPaymentMethod.name,
      icon: newPaymentMethod.icon,
      code: newPaymentMethod.code,
      logo: newPaymentMethod.logo || undefined,
      type: newPaymentMethod.type,
      active: true,
    };
    onUpdatePaymentMethods([...paymentMethods, newMethod]);
    setNewPaymentMethod({ name: '', icon: '', code: '', logo: '', type: 'online' });
  };

  const togglePaymentMethod = (id: string) => {
    onUpdatePaymentMethods(paymentMethods.map(m =>
      m.id === id ? { ...m, active: !m.active } : m
    ));
  };

  const deletePaymentMethod = (id: string) => {
    if (window.confirm('Supprimer cette méthode de paiement ?')) {
      onUpdatePaymentMethods(paymentMethods.filter(m => m.id !== id));
    }
  };

  const startEditMethod = (method: PaymentMethod) => {
    setEditingMethodId(method.id);
    setEditMethodData({
      name: method.name,
      icon: method.icon,
      code: method.code,
      active: method.active,
      logo: method.logo || '',
      type: method.type
    });
  };

  const saveEditMethod = (id: string) => {
    onUpdatePaymentMethods(paymentMethods.map(m =>
      m.id === id ? { ...m, ...editMethodData } : m
    ));
    setEditingMethodId(null);
  };

  const stats = useMemo(() => {
    const revenue = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
    const completedOrders = orders.filter(o => o.status === OrderStatus.DELIVERED);
    const aov = completedOrders.length > 0 ? revenue / completedOrders.length : 0;
    return {
      revenue,
      aov,
      alerts: orders.filter(o => o.isPsychotropicDetected).length,
      active: orders.filter(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED).length,
      trend: "+12.4%"
    };
  }, [orders]);

  const orderStats = useMemo(() => {
    return orders.map(order => {
      const createdAt = new Date(order.timestamp);
      const now = new Date();
      const elapsedMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000);
      let statusInfo = '';
      if (order.status === OrderStatus.DELIVERED) statusInfo = 'Livrée';
      else if (order.status === OrderStatus.CANCELLED) statusInfo = 'Annulée';
      else if (order.status === OrderStatus.PREPARING) statusInfo = 'En préparation';
      else if (order.status === OrderStatus.READY_FOR_PICKUP) statusInfo = 'Prête';
      else if (order.status === OrderStatus.OUT_FOR_DELIVERY) statusInfo = 'En livraison';
      else if (order.status === OrderStatus.AWAITING_QUOTES) {
        if (order.pharmacyId) statusInfo = 'Acceptée (devis)';
        else if (order.refusedByPharmacyIds?.length) statusInfo = `Refusée par ${order.refusedByPharmacyIds.length} pharmacie(s)`;
        else statusInfo = 'En attente';
      }
      return {
        ...order,
        elapsedMinutes,
        statusInfo
      };
    });
  }, [orders]);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6 lg:p-10 space-y-8 custom-scrollbar text-white">
      <header className="bg-slate-800/50 backdrop-blur-xl p-8 rounded-[40px] border-4 border-slate-700 shadow-2xl flex flex-col justify-between gap-8 sticky top-0 z-50">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-8 w-full">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-[24px] flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(37,99,235,0.3)]">
              <i className="fa-solid fa-tower-observation"></i>
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">{t.admin.title}</h2>
              <p className="text-blue-400 font-bold uppercase text-[10px] tracking-[0.4em] mt-2 italic">{t.admin.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 bg-slate-900 p-2 rounded-3xl border-2 border-slate-700">
             {[
               { id: 'analytics', icon: 'fa-chart-pie', label: t.admin.dashboard, show: true },
               { id: 'orders', icon: 'fa-clipboard-list', label: 'Suivi commandes', show: true },
               { id: 'gallery', icon: 'fa-images', label: t.admin.gallery, show: true },
               { id: 'payments', icon: 'fa-credit-card', label: 'Paiements', show: true },
               { id: 'campaigns', icon: 'fa-bullhorn', label: 'Campagnes', show: settings.featureFlags.campaigns },
               { id: 'loyalty', icon: 'fa-gift', label: 'Fidélité', show: settings.featureFlags.loyalty || settings.featureFlags.cashback },
               { id: 'notifications', icon: 'fa-bell', label: 'Alertes', show: settings.featureFlags.pushNotifications },
               { id: 'users', icon: 'fa-users-gear', label: 'Utilisateurs', show: true },
               { id: 'pharmacies', icon: 'fa-mortar-pestle', label: t.admin.manage_pharmacies, show: true },
               { id: 'drivers', icon: 'fa-motorcycle', label: t.admin.logistics, show: true },
               { id: 'settings', icon: 'fa-gear', label: 'Paramètres', show: true }
             ].filter(tab => tab.show).map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
                   activeTab === tab.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                 }`}
               >
                 <i className={`fa-solid ${tab.icon}`}></i>
                 <span className="hidden xl:inline">{tab.label}</span>
               </button>
             ))}
          </div>
        </div>
      </header>

      {/* Onglet Users (Gestion des approbations) */}
      {activeTab === 'users' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <Card title="Approbations en attente">
            <div className="space-y-4">
              {pendingUsers.length > 0 ? (
                pendingUsers.map(u => (
                  <div key={u.uid} className="flex items-center justify-between p-6 bg-slate-900 rounded-3xl border border-slate-800">
                    <div className="flex items-center gap-4">
                      {u.photoURL ? (
                        <img src={u.photoURL} className="w-12 h-12 rounded-xl object-cover" alt={u.name} />
                      ) : (
                        <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                          <i className="fa-solid fa-user"></i>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-black uppercase">{u.name}</p>
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
                          {u.role} 
                          {u.pharmacyName && ` • ${u.pharmacyName}`}
                          {u.vehicleType && ` • ${u.vehicleType} (${u.vehiclePlate})`}
                          {` • ${u.email}`}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-1">{u.phone}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleUpdateUserStatus(u.uid, UserStatus.APPROVED)}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase transition-all"
                      >
                        Approuver
                      </button>
                      <button 
                        onClick={() => handleUpdateUserStatus(u.uid, UserStatus.REJECTED)}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase transition-all"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-10 text-slate-500 text-xs font-black uppercase italic">Aucune demande en attente</p>
              )}
            </div>
          </Card>

          <Card title="Utilisateurs Approuvés">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-600 text-[8px] font-black uppercase text-slate-300 tracking-[0.2em]">
                    <th className="pb-4">Utilisateur</th>
                    <th className="pb-4">Rôle</th>
                    <th className="pb-4">Email</th>
                    <th className="pb-4">Status</th>
                    <th className="pb-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {approvedUsers.map(u => (
                    <tr key={u.uid} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500">
                            <i className={`fa-solid ${u.role === UserRole.PHARMACY ? 'fa-hospital' : u.role === UserRole.DRIVER ? 'fa-motorcycle' : 'fa-user'} text-[10px]`}></i>
                          </div>
                          <div>
                            <p className="text-xs font-black text-white">{u.name}</p>
                            {u.pharmacyName && <p className="text-[8px] text-slate-500 font-bold uppercase">{u.pharmacyName}</p>}
                            {u.vehicleType && <p className="text-[8px] text-slate-500 font-bold uppercase">{u.vehicleType} - {u.vehiclePlate}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-[10px] font-black text-blue-400 uppercase">{u.role}</td>
                      <td className="py-4 text-xs text-slate-300">{u.email}</td>
                      <td className="py-4">
                        <span className="text-[8px] font-black px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded uppercase">Actif</span>
                      </td>
                      <td className="py-4">
                        <button 
                          onClick={() => handleUpdateUserStatus(u.uid, UserStatus.REJECTED)}
                          className="text-[9px] font-black text-red-400 hover:text-red-300 uppercase"
                        >
                          Désactiver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Onglet Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          {onSwitchRole && (
            <Card title="Accès Rapide aux Modules">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { r: UserRole.PATIENT, icon: 'fa-user', label: 'Interface Patient', desc: 'Commander des médicaments' },
                  { r: UserRole.PHARMACY, icon: 'fa-mortar-pestle', label: 'Interface Pharmacie', desc: 'Gérer les ordonnances' },
                  { r: UserRole.DRIVER, icon: 'fa-motorcycle', label: 'Interface Livreur', desc: 'Effectuer les livraisons' }
                ].map(module => (
                  <button
                    key={module.r}
                    onClick={() => onSwitchRole(module.r)}
                    className="flex items-center gap-4 p-4 bg-slate-800 rounded-2xl border border-slate-700 hover:border-blue-500 hover:bg-slate-700 transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                      <i className={`fa-solid ${module.icon} text-xl`}></i>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-white">{module.label}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{module.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card title={t.admin.revenue}>
              <div className="flex items-baseline justify-between">
                <p className="text-4xl font-black tracking-tighter text-white">{stats.revenue.toLocaleString()} <span className="text-xs font-bold opacity-50 tracking-normal">{settings.currency}</span></p>
                <span className="text-emerald-400 text-[10px] font-black">{stats.trend}</span>
              </div>
            </Card>
            <Card title="Panier Moyen">
              <p className="text-4xl font-black tracking-tighter text-white">{Math.round(stats.aov).toLocaleString()} <span className="text-xs font-bold opacity-50 tracking-normal">{settings.currency}</span></p>
            </Card>
            <Card title="Unités en Transit">
              <p className="text-4xl font-black text-blue-400 tracking-tighter">{stats.active}</p>
            </Card>
            <Card title={t.admin.alerts} className={stats.alerts > 0 ? 'border-red-700/50 bg-red-900/20' : ''}>
              <p className={`text-4xl font-black tracking-tighter ${stats.alerts > 0 ? 'text-red-400' : 'text-white'}`}>{stats.alerts}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card title="Performances des Campagnes" className={!settings.featureFlags.campaigns ? 'opacity-30' : ''}>
              <div className="space-y-4">
                {campaigns.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-slate-700">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">{c.name}</span>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-lg ${c.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                      {c.active ? 'ACTIF' : 'INACTIF'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Volume Fidélité" className={!settings.featureFlags.loyalty ? 'opacity-30' : ''}>
              <div className="flex flex-col justify-center items-center py-6 gap-2">
                <p className="text-3xl font-black text-slate-500 italic uppercase">Aucune donnée</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Le programme de fidélité est en attente d'utilisateurs</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Onglet Orders (Suivi commandes) */}
      {activeTab === 'orders' && (
        <Card title="Suivi des commandes" className="animate-in fade-in duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-600 text-[8px] font-black uppercase text-slate-300 tracking-[0.2em]">
                  <th className="pb-4">ID</th>
                  <th className="pb-4">Patient</th>
                  <th className="pb-4">Statut</th>
                  <th className="pb-4">Pharmacie</th>
                  <th className="pb-4">Création</th>
                  <th className="pb-4">Temps écoulé</th>
                  <th className="pb-4">Deadline</th>
                  <th className="pb-4">Refus</th>
                  <th className="pb-4">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {orderStats.map(order => {
                  const deadlineDate = order.deadline ? new Date(order.deadline) : null;
                  const now = new Date();
                  const deadlinePassed = deadlineDate && deadlineDate < now;
                  const timeRemaining = deadlineDate ? Math.max(0, Math.floor((deadlineDate.getTime() - now.getTime()) / 60000)) : null;
                  
                  const displayAmount = order.totalAmount 
                    ? order.totalAmount 
                    : (order.quotes && order.quotes.length > 0 
                        ? order.quotes[order.quotes.length-1].totalAmount 
                        : null);

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 text-xs font-black text-blue-400">#{order.id.slice(-6)}</td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-200">
                            {users.find(u => u.uid === order.patientId)?.name || order.patientName}
                          </span>
                          <span className="text-[8px] text-slate-500 font-bold uppercase">Patient</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`text-[10px] font-black px-2 py-1 rounded ${
                          order.status === OrderStatus.DELIVERED ? 'bg-emerald-500/20 text-emerald-400' :
                          order.status === OrderStatus.CANCELLED ? 'bg-red-500/20 text-red-400' :
                          order.status === OrderStatus.PREPARING ? 'bg-blue-500/20 text-blue-400' :
                          order.status === OrderStatus.AWAITING_QUOTES ? (order.pharmacyId ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400') :
                          'bg-slate-600/20 text-slate-400'
                        }`}>
                          {order.statusInfo}
                        </span>
                      </td>
                      <td className="py-4 text-xs text-slate-200">{order.pharmacyName || '-'}</td>
                      <td className="py-4 text-xs text-slate-200">{new Date(order.timestamp).toLocaleDateString()} {new Date(order.timestamp).toLocaleTimeString()}</td>
                      <td className="py-4 text-xs text-slate-200">{order.elapsedMinutes} min</td>
                      <td className="py-4 text-xs">
                        {deadlineDate ? (
                          <span className={deadlinePassed ? 'text-red-400' : 'text-green-400'}>
                            {deadlinePassed ? 'Expiré' : `${timeRemaining} min`}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-4 text-xs text-slate-200">{order.refusedByPharmacyIds?.length || 0}</td>
                      <td className="py-4 text-xs text-slate-200">
                        {displayAmount ? `${displayAmount.toLocaleString()} DJF` : '-'}
                      </td>
                    </tr>
                  );
                })}
                {orderStats.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-20 text-center text-slate-500 text-xs">Aucune commande</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Onglet Pharmacies */}
      {activeTab === 'pharmacies' && (
        <Card title="Réseau des Officines" className="animate-in fade-in duration-500">
           <div className="space-y-4">
              {MOCK_PHARMACIES.map(p => (
                <div key={p.id} className="flex items-center justify-between p-6 bg-slate-900 rounded-3xl border border-slate-800">
                   <div>
                      <p className="text-sm font-black uppercase">{p.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{p.address}</p>
                   </div>
                   <Toggle active={pharmacyOnlineStatus[p.id]} onToggle={() => onTogglePharmacy(p.id)} label={pharmacyOnlineStatus[p.id] ? "EN LIGNE" : "HORS LIGNE"} />
                </div>
              ))}
           </div>
        </Card>
      )}

      {/* Onglet Drivers */}
      {activeTab === 'drivers' && (
        <Card title="Gestion des Livreurs">
          <div className="py-20 text-center text-slate-500 font-black uppercase italic tracking-[0.2em]">Module en cours d'optimisation</div>
        </Card>
      )}

      {/* Onglet Gallery */}
      {activeTab === 'gallery' && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           {orders.map(o => (
             <div key={o.id} className="bg-slate-800 p-4 rounded-3xl border-2 border-slate-700 hover:border-blue-600 transition-all flex flex-col gap-4 group cursor-pointer shadow-lg hover:shadow-blue-900/10">
                <div className="overflow-hidden rounded-xl">
                  <img src={o.prescriptionImageUrl} className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-110" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">#{o.id.slice(-6)}</p>
                   <p className="text-[9px] font-bold text-slate-300 uppercase truncate mt-1">{o.patientName}</p>
                   <div className="mt-3 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${o.status === OrderStatus.DELIVERED ? 'bg-slate-600' : 'bg-emerald-400 animate-pulse'}`}></span>
                      <span className={`text-[8px] font-black uppercase ${o.status === OrderStatus.DELIVERED ? 'text-slate-500' : 'text-emerald-400'}`}>
                        {o.status === OrderStatus.DELIVERED ? 'ARCHIVÉ' : 'Dossier Actif'}
                      </span>
                   </div>
                </div>
             </div>
           ))}
           {orders.length === 0 && <div className="col-span-full py-40 text-center text-slate-600 font-black uppercase italic tracking-[0.3em]">Aucun flux visuel détecté sur le hub</div>}
        </div>
      )}

      {/* Onglet Payments - Statistiques détaillées */}
      {activeTab === 'payments' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <Card title="Statistiques globales des paiements">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Total commandes payées</p>
                <p className="text-4xl font-black text-white">{paymentStats.total}</p>
              </div>
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Paiements en ligne</p>
                <p className="text-4xl font-black text-blue-400">{paymentStats.onlineCount} <span className="text-sm font-black text-slate-400">({paymentStats.onlinePercent}%)</span></p>
              </div>
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Paiements à la livraison</p>
                <p className="text-4xl font-black text-emerald-400">{paymentStats.codCount} <span className="text-sm font-black text-slate-400">({paymentStats.codPercent}%)</span></p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Camembert répartition par méthode */}
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <h3 className="text-sm font-black uppercase text-white mb-4">Répartition par méthode de paiement</h3>
                {paymentStats.pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={paymentStats.pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${percent}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {paymentStats.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} commandes`, 'Nombre']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-20 text-slate-500">Aucune donnée de paiement</p>
                )}
              </div>

              {/* Barres montants par méthode */}
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <h3 className="text-sm font-black uppercase text-white mb-4">Montants totaux par méthode</h3>
                {paymentStats.barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={paymentStats.barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <Tooltip formatter={(value) => [`${value.toLocaleString()} DJF`, 'Montant']} />
                      <Bar dataKey="montant" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-20 text-slate-500">Aucune donnée de paiement</p>
                )}
              </div>
            </div>

            {/* Tableau détaillé par méthode */}
            <div className="mt-8">
              <h3 className="text-sm font-black uppercase text-white mb-4">Détail par méthode de paiement</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-600 text-[8px] font-black uppercase text-slate-300 tracking-[0.2em]">
                      <th className="pb-4">Méthode</th>
                      <th className="pb-4">Type</th>
                      <th className="pb-4">Nombre d'utilisations</th>
                      <th className="pb-4">Montant total</th>
                      <th className="pb-4">Part (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {paymentStats.methodStats.map(method => (
                      <tr key={method.code} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            {method.logo ? (
                              <img src={method.logo} alt={method.name} className="w-6 h-6 object-contain" />
                            ) : (
                              <i className={`fa-solid ${method.icon} text-blue-400`}></i>
                            )}
                            <span className="text-xs font-black text-white">{method.name}</span>
                          </div>
                        </td>
                        <td className="py-4 text-xs text-slate-300">
                          {method.type === 'online' ? 'En ligne' : 'À la livraison'}
                        </td>
                        <td className="py-4 text-xs font-black text-white">{method.count}</td>
                        <td className="py-4 text-xs font-black text-blue-400">{method.totalAmount.toLocaleString()} DJF</td>
                        <td className="py-4 text-xs text-slate-300">{method.percent}%</td>
                      </tr>
                    ))}
                    {paymentStats.methodStats.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">Aucune transaction enregistrée</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Onglet Settings (paramètres généraux et gestion des méthodes de paiement) */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
          <Card title="Feature Flags (Activation Fonctions)">
            <div className="space-y-3">
              <Toggle active={settings.featureFlags.campaigns} onToggle={() => toggleFlag('campaigns')} label="Campagnes Promotionnelles" />
              <Toggle active={settings.featureFlags.loyalty} onToggle={() => toggleFlag('loyalty')} label="Programme de Fidélité" />
              <Toggle active={settings.featureFlags.cashback} onToggle={() => toggleFlag('cashback')} label="Système Cashback" />
              <Toggle active={settings.featureFlags.pushNotifications} onToggle={() => toggleFlag('pushNotifications')} label="Notifications Push Hub" />
              <Toggle active={settings.featureFlags.onlinePayment} onToggle={() => toggleFlag('onlinePayment')} label="Paiement en Ligne (DJ-PAY)" />
            </div>
          </Card>

          <Card title="Frais et Commission Plateforme">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Commission Hub (%)</label>
                  <input 
                    type="number" 
                    value={settings.taxes.commission} 
                    onChange={e => setSettings({ ...settings, taxes: { ...settings.taxes, commission: parseFloat(e.target.value) || 0 } })}
                    className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-xs font-black text-white outline-none focus:border-blue-600 transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">TVA (%)</label>
                  <input 
                    type="number" 
                    value={settings.taxes.tva} 
                    onChange={e => setSettings({ ...settings, taxes: { ...settings.taxes, tva: parseFloat(e.target.value) || 0 } })}
                    className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-xs font-black text-white outline-none focus:border-blue-600 transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Frais de Service Fixes ({settings.currency})</label>
                <input 
                  type="number" 
                  value={settings.taxes.serviceFee} 
                  onChange={e => setSettings({ ...settings, taxes: { ...settings.taxes, serviceFee: parseFloat(e.target.value) || 0 } })}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-xs font-black text-white outline-none focus:border-blue-600 transition-all" 
                />
              </div>
            </div>
          </Card>

          <Card title="Paramètres SLA" className="lg:col-span-2">
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest w-48">Délai de réponse (minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={slaMinutes}
                  onChange={(e) => onSlaMinutesChange(parseInt(e.target.value) || 5)}
                  className="w-24 bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-xs font-black text-white outline-none focus:border-blue-600 transition-all text-center"
                />
                <span className="text-[10px] text-slate-400">minutes (actuellement {slaMinutes} min)</span>
              </div>
              <p className="text-[9px] text-slate-500 italic">Ce délai correspond au temps accordé aux pharmacies pour répondre à une commande avant transfert automatique.</p>
            </div>
          </Card>

          <Card title="Zones de Livraison Actives" className="lg:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-600 text-[8px] font-black uppercase text-slate-300 tracking-[0.2em]">
                    <th className="pb-4">Zone</th>
                    <th className="pb-4">Frais ({settings.currency})</th>
                    <th className="pb-4">Délai (min)</th>
                    <th className="pb-4">Latitude</th>
                    <th className="pb-4">Longitude</th>
                    <th className="pb-4">Rayon (km)</th>
                    <th className="pb-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {deliveryZones.map(zone => {
                    if (editingZoneId === zone.id) {
                      return (
                        <tr key={zone.id} className="bg-slate-800/50">
                          <td className="py-4">
                            <input
                              type="text"
                              value={editingZoneData.name}
                              onChange={e => setEditingZoneData({ ...editingZoneData, name: e.target.value })}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-xs font-black text-white"
                            />
                          </td>
                          <td className="py-4">
                            <input
                              type="number"
                              value={editingZoneData.fee}
                              onChange={e => setEditingZoneData({ ...editingZoneData, fee: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-xs font-black text-white"
                            />
                          </td>
                          <td className="py-4">
                            <input
                              type="number"
                              value={editingZoneData.time}
                              onChange={e => setEditingZoneData({ ...editingZoneData, time: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-xs font-black text-white"
                            />
                          </td>
                          <td className="py-4">
                            <input
                              type="number"
                              step="any"
                              value={editingZoneData.centerLat}
                              onChange={e => setEditingZoneData({ ...editingZoneData, centerLat: e.target.value })}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-xs font-black text-white"
                            />
                          </td>
                          <td className="py-4">
                            <input
                              type="number"
                              step="any"
                              value={editingZoneData.centerLng}
                              onChange={e => setEditingZoneData({ ...editingZoneData, centerLng: e.target.value })}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-xs font-black text-white"
                            />
                          </td>
                          <td className="py-4">
                            <input
                              type="number"
                              step="0.1"
                              value={editingZoneData.radiusKm}
                              onChange={e => setEditingZoneData({ ...editingZoneData, radiusKm: e.target.value })}
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-xs font-black text-white"
                            />
                          </td>
                          <td className="py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEditZone(zone.id)}
                                className="text-emerald-400 hover:text-emerald-300 transition-all px-2"
                                title="Sauvegarder"
                              >
                                <i className="fa-solid fa-check"></i>
                              </button>
                              <button
                                onClick={cancelEditZone}
                                className="text-slate-400 hover:text-slate-300 transition-all px-2"
                                title="Annuler"
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    } else {
                      return (
                        <tr key={zone.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-4 text-xs font-bold uppercase text-slate-200">{zone.name}</td>
                          <td className="py-4 text-xs font-black text-blue-400">{zone.fee}</td>
                          <td className="py-4 text-xs font-black text-slate-200">{zone.time}</td>
                          <td className="py-4 text-xs font-black text-slate-200">{zone.centerLat?.toFixed(4)}</td>
                          <td className="py-4 text-xs font-black text-slate-200">{zone.centerLng?.toFixed(4)}</td>
                          <td className="py-4 text-xs font-black text-slate-200">{zone.radiusKm}</td>
                          <td className="py-4 text-xs font-black">
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEditZone(zone)}
                                className="text-slate-400 hover:text-blue-400 transition-all"
                                title="Modifier"
                              >
                                <i className="fa-solid fa-pen"></i>
                              </button>
                              <button
                                onClick={() => removeZone(zone.id)}
                                className="text-slate-400 hover:text-red-400 transition-all"
                                title="Supprimer"
                              >
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>

              {showNewZoneForm && (
                <div className="mt-6 p-4 bg-slate-800 rounded-2xl border border-slate-700 space-y-4">
                  <h5 className="text-[10px] font-black uppercase text-slate-200">Nouvelle zone</h5>
                  <div className="grid grid-cols-7 gap-4">
                    <input
                      type="text"
                      placeholder="Nom"
                      value={newZone.name}
                      onChange={e => setNewZone({ ...newZone, name: e.target.value })}
                      className="col-span-1 bg-slate-700 border border-slate-600 rounded-xl p-2 text-xs font-black text-white placeholder-slate-400"
                    />
                    <input
                      type="number"
                      placeholder="Frais"
                      value={newZone.fee || ''}
                      onChange={e => setNewZone({ ...newZone, fee: parseFloat(e.target.value) || 0 })}
                      className="col-span-1 bg-slate-700 border border-slate-600 rounded-xl p-2 text-xs font-black text-white placeholder-slate-400"
                    />
                    <input
                      type="number"
                      placeholder="Délai (min)"
                      value={newZone.time || ''}
                      onChange={e => setNewZone({ ...newZone, time: parseFloat(e.target.value) || 0 })}
                      className="col-span-1 bg-slate-700 border border-slate-600 rounded-xl p-2 text-xs font-black text-white placeholder-slate-400"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="Latitude"
                      value={newZone.centerLat}
                      onChange={e => setNewZone({ ...newZone, centerLat: e.target.value })}
                      className="col-span-1 bg-slate-700 border border-slate-600 rounded-xl p-2 text-xs font-black text-white placeholder-slate-400"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="Longitude"
                      value={newZone.centerLng}
                      onChange={e => setNewZone({ ...newZone, centerLng: e.target.value })}
                      className="col-span-1 bg-slate-700 border border-slate-600 rounded-xl p-2 text-xs font-black text-white placeholder-slate-400"
                    />
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Rayon (km)"
                      value={newZone.radiusKm}
                      onChange={e => setNewZone({ ...newZone, radiusKm: e.target.value })}
                      className="col-span-1 bg-slate-700 border border-slate-600 rounded-xl p-2 text-xs font-black text-white placeholder-slate-400"
                    />
                    <div className="col-span-1 flex gap-2">
                      <button onClick={addZone} className="flex-1 py-2 bg-blue-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all">
                        Ajouter
                      </button>
                      <button onClick={() => setShowNewZoneForm(false)} className="flex-1 py-2 bg-slate-700 rounded-xl text-[10px] font-black uppercase hover:bg-slate-600 transition-all">
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowNewZoneForm(true)}
                className="mt-6 w-full py-3 bg-slate-800 rounded-2xl text-[9px] font-black uppercase border-2 border-dashed border-slate-600 hover:bg-slate-700 transition-all text-slate-300"
              >
                + Ajouter une zone stratégique
              </button>
            </div>
          </Card>

          {/* Section Méthodes de paiement avec logo et type */}
          <Card title="Moyens de paiement acceptés" className="lg:col-span-2 mt-8">
            <div className="space-y-4">
              {paymentMethods.map(method => (
                <div key={method.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-slate-700">
                  {editingMethodId === method.id ? (
                    // Mode édition
                    <div className="flex-1 grid grid-cols-6 gap-2">
                      <input
                        type="text"
                        value={editMethodData.name}
                        onChange={e => setEditMethodData({ ...editMethodData, name: e.target.value })}
                        className="bg-slate-700 border border-slate-600 rounded-lg p-2 text-xs text-white"
                        placeholder="Nom"
                      />
                      <input
                        type="text"
                        value={editMethodData.icon}
                        onChange={e => setEditMethodData({ ...editMethodData, icon: e.target.value })}
                        className="bg-slate-700 border border-slate-600 rounded-lg p-2 text-xs text-white"
                        placeholder="Icône"
                      />
                      <input
                        type="text"
                        value={editMethodData.code}
                        onChange={e => setEditMethodData({ ...editMethodData, code: e.target.value })}
                        className="bg-slate-700 border border-slate-600 rounded-lg p-2 text-xs text-white"
                        placeholder="Code"
                      />
                      <input
                        type="text"
                        value={editMethodData.logo || ''}
                        onChange={e => setEditMethodData({ ...editMethodData, logo: e.target.value })}
                        className="bg-slate-700 border border-slate-600 rounded-lg p-2 text-xs text-white"
                        placeholder="Logo URL"
                      />
                      <select
                        value={editMethodData.type}
                        onChange={e => setEditMethodData({ ...editMethodData, type: e.target.value as 'online' | 'cod' })}
                        className="bg-slate-700 border border-slate-600 rounded-lg p-2 text-xs text-white"
                      >
                        <option value="online">En ligne</option>
                        <option value="cod">À la livraison</option>
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => saveEditMethod(method.id)} className="text-emerald-400 hover:text-emerald-300 px-2">
                          <i className="fa-solid fa-check"></i>
                        </button>
                        <button onClick={() => setEditingMethodId(null)} className="text-slate-400 hover:text-slate-300 px-2">
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Affichage normal
                    <>
                      <div className="flex items-center gap-4">
                        {method.logo ? (
                          <img src={method.logo} alt={method.name} className="w-8 h-8 object-contain" />
                        ) : (
                          <i className={`fa-solid ${method.icon} text-blue-400 text-xl w-8`}></i>
                        )}
                        <div>
                          <p className="text-sm font-black text-white">{method.name}</p>
                          <p className="text-[9px] text-slate-400">Code: {method.code}</p>
                          <p className="text-[8px] text-slate-500">{method.type === 'online' ? 'En ligne' : 'À la livraison'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Toggle
                          active={method.active}
                          onToggle={() => togglePaymentMethod(method.id)}
                          label=""
                        />
                        <button onClick={() => startEditMethod(method)} className="text-slate-400 hover:text-blue-400 transition-colors">
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button onClick={() => deletePaymentMethod(method.id)} className="text-slate-400 hover:text-red-400 transition-colors">
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Formulaire d'ajout avec logo et type */}
              <div className="mt-6 p-4 bg-slate-800 rounded-2xl border border-slate-700">
                <h5 className="text-[10px] font-black uppercase text-slate-200 mb-4">Ajouter une méthode de paiement</h5>
                <div className="grid grid-cols-5 gap-4">
                  <input
                    type="text"
                    placeholder="Nom"
                    value={newPaymentMethod.name}
                    onChange={e => setNewPaymentMethod({ ...newPaymentMethod, name: e.target.value })}
                    className="col-span-1 bg-slate-700 border border-slate-600 rounded-xl p-3 text-xs font-black text-white placeholder-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Icône (ex: fa-wallet)"
                    value={newPaymentMethod.icon}
                    onChange={e => setNewPaymentMethod({ ...newPaymentMethod, icon: e.target.value })}
                    className="col-span-1 bg-slate-700 border border-slate-600 rounded-xl p-3 text-xs font-black text-white placeholder-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Code (ex: waafi)"
                    value={newPaymentMethod.code}
                    onChange={e => setNewPaymentMethod({ ...newPaymentMethod, code: e.target.value })}
                    className="col-span-1 bg-slate-700 border border-slate-600 rounded-xl p-3 text-xs font-black text-white placeholder-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Logo URL (optionnel)"
                    value={newPaymentMethod.logo}
                    onChange={e => setNewPaymentMethod({ ...newPaymentMethod, logo: e.target.value })}
                    className="col-span-1 bg-slate-700 border border-slate-600 rounded-xl p-3 text-xs font-black text-white placeholder-slate-400"
                  />
                  <select
                    value={newPaymentMethod.type}
                    onChange={e => setNewPaymentMethod({ ...newPaymentMethod, type: e.target.value as 'online' | 'cod' })}
                    className="col-span-1 bg-slate-700 border border-slate-600 rounded-xl p-3 text-xs font-black text-white"
                  >
                    <option value="online">En ligne</option>
                    <option value="cod">À la livraison</option>
                  </select>
                  <button
                    onClick={addPaymentMethod}
                    className="col-span-1 py-3 bg-blue-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Onglet Campaigns */}
      {activeTab === 'campaigns' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black uppercase tracking-tighter text-white">Gestion des Offres</h3>
            <button 
              onClick={() => setShowNewCampaignForm(!showNewCampaignForm)}
              className="px-6 py-3 bg-blue-600 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-700 transition-all"
            >
              {showNewCampaignForm ? 'Annuler' : '+ Créer une campagne'}
            </button>
          </div>
          
          {showNewCampaignForm && (
            <div className="bg-slate-800 p-6 rounded-[32px] border-2 border-slate-700">
              <h4 className="text-sm font-black uppercase mb-4 text-white">Nouvelle campagne</h4>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Nom de la campagne"
                  value={newCampaign.name}
                  onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl p-3 text-xs font-black text-white placeholder-slate-400"
                />
                <select
                  value={newCampaign.type}
                  onChange={e => setNewCampaign({ ...newCampaign, type: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl p-3 text-xs font-black text-white"
                >
                  <option value="percentage">Pourcentage (%)</option>
                  <option value="fixed">Montant fixe (DJF)</option>
                  <option value="free_shipping">Livraison offerte</option>
                </select>
                <input
                  type="number"
                  placeholder="Valeur (ex: 15 pour 15%)"
                  value={newCampaign.value}
                  onChange={e => setNewCampaign({ ...newCampaign, value: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl p-3 text-xs font-black text-white placeholder-slate-400"
                />
                <input
                  type="number"
                  placeholder="Montant minimum (DJF)"
                  value={newCampaign.minAmount}
                  onChange={e => setNewCampaign({ ...newCampaign, minAmount: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl p-3 text-xs font-black text-white placeholder-slate-400"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="date"
                    value={newCampaign.startDate}
                    onChange={e => setNewCampaign({ ...newCampaign, startDate: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl p-3 text-xs font-black text-white"
                  />
                  <input
                    type="date"
                    value={newCampaign.endDate}
                    onChange={e => setNewCampaign({ ...newCampaign, endDate: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl p-3 text-xs font-black text-white"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={addCampaign}
                    className="flex-1 py-3 bg-blue-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700"
                  >
                    Ajouter
                  </button>
                  <button
                    onClick={() => setShowNewCampaignForm(false)}
                    className="flex-1 py-3 bg-slate-700 rounded-xl text-[10px] font-black uppercase hover:bg-slate-600"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {campaigns.map(c => (
              <div key={c.id}>
                <Card title={c.type}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="text-lg font-black uppercase text-white">{c.name}</h4>
                      <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Condition: Min {c.minAmount} {settings.currency}</p>
                    </div>
                    <Toggle 
                      active={c.active} 
                      onToggle={() => {
                        setCampaigns(prev => prev.map(camp => 
                          camp.id === c.id ? { ...camp, active: !camp.active } : camp
                        ));
                      }} 
                      label="" 
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-4 border-t border-slate-700">
                     <div className="text-center bg-slate-800 p-3 rounded-xl border border-slate-700 flex-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Valeur</p>
                        <p className="text-xl font-black text-white">{c.value > 0 ? `${c.value} ${c.type === 'percentage' ? '%' : settings.currency}` : 'OFFERTE'}</p>
                     </div>
                     <div className="text-center bg-slate-800 p-3 rounded-xl border border-slate-700 flex-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Fin</p>
                        <p className="text-xs font-black text-white">{c.end}</p>
                     </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Onglet Notifications */}
      {activeTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
          <Card title="Diffuser une Notification Push">
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); sendNotification(); }}>
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Cible stratégique</label>
                <select 
                  value={newNotification.target}
                  onChange={e => setNewNotification({ ...newNotification, target: e.target.value })}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-xs font-black text-white outline-none focus:border-blue-600 appearance-none"
                >
                  <option value="all">Tous les utilisateurs</option>
                  <option value="pharmacies">Pharmacies Uniquement</option>
                  <option value="drivers">Livreurs Uniquement</option>
                  <option value="patients">Clients Actifs</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Titre de l'alerte</label>
                <input 
                  type="text" 
                  value={newNotification.title}
                  onChange={e => setNewNotification({ ...newNotification, title: e.target.value })}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-xs font-black text-white outline-none focus:border-blue-600" 
                  placeholder="ex: Maintenance du Hub" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Message</label>
                <textarea 
                  value={newNotification.message}
                  onChange={e => setNewNotification({ ...newNotification, message: e.target.value })}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-xs font-black text-white outline-none focus:border-blue-600 h-32" 
                  placeholder="Saisissez votre message..." 
                />
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-700 transition-all">
                Envoyer l'alerte Push
              </button>
            </form>
          </Card>

          <Card title="Historique des diffusions">
            <div className="space-y-4">
              {notifications.map(n => (
                <div key={n.id} className="p-5 bg-slate-800 border border-slate-700 rounded-[24px] space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-blue-400 uppercase">{n.date}</span>
                    <span className="text-[8px] font-black px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">SENT</span>
                  </div>
                  <h5 className="text-xs font-black uppercase text-white">{n.title}</h5>
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic">"{n.message}"</p>
                </div>
              ))}
              {notifications.length === 0 && <p className="text-center py-10 text-slate-500 font-black uppercase text-[10px] italic">Aucune notification envoyée</p>}
            </div>
          </Card>
        </div>
      )}

      {/* Onglet Loyalty */}
      {activeTab === 'loyalty' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
          <Card title="Configuration Programme Fidélité">
             <div className="space-y-6">
                <div className="flex gap-4">
                   <button 
                     onClick={() => setLoyaltyConfig({ ...loyaltyConfig, type: 'points' })}
                     className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${loyaltyConfig.type === 'points' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:bg-slate-700'}`}
                   >
                     Points Accumulés
                   </button>
                   <button 
                     onClick={() => setLoyaltyConfig({ ...loyaltyConfig, type: 'cashback' })}
                     className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${loyaltyConfig.type === 'cashback' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:bg-slate-700'}`}
                   >
                     Cashback Direct
                   </button>
                </div>
                <div className="space-y-4">
                   <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Taux d'accumulation (1 point pour X {settings.currency})</label>
                      <input 
                        type="number" 
                        value={loyaltyConfig.accumulation} 
                        onChange={e => setLoyaltyConfig({ ...loyaltyConfig, accumulation: parseInt(e.target.value) || 0 })}
                        className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-xs font-black text-white outline-none focus:border-blue-600" 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Seuil de conversion (X points = Y {settings.currency})</label>
                      <div className="grid grid-cols-2 gap-4">
                        <input 
                          type="number" 
                          value={loyaltyConfig.pointsToDjf} 
                          onChange={e => setLoyaltyConfig({ ...loyaltyConfig, pointsToDjf: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-xs font-black text-white outline-none focus:border-blue-600" 
                        />
                        <input 
                          type="number" 
                          value={loyaltyConfig.djfValue} 
                          onChange={e => setLoyaltyConfig({ ...loyaltyConfig, djfValue: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 text-xs font-black text-white outline-none focus:border-blue-600" 
                        />
                      </div>
                   </div>
                </div>
                <button 
                  onClick={saveLoyaltyConfig}
                  className="w-full py-4 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white transition-all"
                >
                  Sauvegarder Configuration Fidélité
                </button>
             </div>
          </Card>
          
          <Card title="Vue d'ensemble Engagement">
             <div className="flex flex-col items-center justify-center py-10 grayscale opacity-20">
                <i className="fa-solid fa-gift text-6xl mb-6 text-slate-500"></i>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] italic text-slate-400">Statistiques indisponibles</p>
             </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;