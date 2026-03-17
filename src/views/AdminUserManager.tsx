import React, { useState } from 'react';
import { UserProfile, UserRole, UserStatus } from '@/types';
import { doc, updateDoc, setDoc, collection } from 'firebase/firestore';
import { db } from '@/firebase';
import { ADMIN_EMAIL } from '@/constants';

// ─── Envoi d'email via EmailJS (gratuit jusqu'à 200 emails/mois) ──────────────
// Si tu n'as pas EmailJS, les notifications passent par Firestore → à lire côté app
const sendNotificationEmail = async (
  toEmail: string,
  toName: string,
  subject: string,
  message: string
) => {
  try {
    // Écriture dans Firestore collection 'notifications' pour historique
    await setDoc(doc(collection(db, 'notifications')), {
      to: toEmail,
      toName,
      subject,
      message,
      sentAt: new Date().toISOString(),
      read: false,
    });

    // Envoi via EmailJS si configuré (optionnel)
    const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY) {
      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: SERVICE_ID,
          template_id: TEMPLATE_ID,
          user_id: PUBLIC_KEY,
          template_params: { to_email: toEmail, to_name: toName, subject, message }
        })
      });
    }
  } catch (err) {
    console.error('Notification error:', err);
  }
};

// ─── Modèles d'emails de notification ─────────────────────────────────────────
const EMAIL_TEMPLATES = {
  approved: (name: string, role: string) => ({
    subject: '✅ PharmaConnect — Votre compte est activé !',
    message: `Bonjour ${name},\n\nVotre compte ${role} sur PharmaConnect Djibouti a été approuvé par notre équipe.\n\nVous pouvez maintenant vous connecter sur https://pharmaconnect-dj.com et accéder à votre espace.\n\nBienvenue sur la plateforme !\n\nL'équipe PharmaConnect`
  }),
  rejected: (name: string) => ({
    subject: '❌ PharmaConnect — Demande refusée',
    message: `Bonjour ${name},\n\nNous avons examiné votre demande d'inscription sur PharmaConnect Djibouti et nous ne pouvons malheureusement pas y donner suite.\n\nPour toute question, contactez-nous à support@pharmaconnect-dj.com.\n\nCordialement,\nL'équipe PharmaConnect`
  }),
  created: (name: string, role: string, tempPassword: string) => ({
    subject: '🎉 PharmaConnect — Votre compte a été créé',
    message: `Bonjour ${name},\n\nUn compte ${role} a été créé pour vous sur PharmaConnect Djibouti.\n\nVos identifiants :\n• Email : (votre adresse email)\n• Mot de passe temporaire : ${tempPassword}\n\nConnectez-vous sur https://pharmaconnect-dj.com et changez votre mot de passe.\n\nL'équipe PharmaConnect`
  }),
};

// ─── Formulaire de création de compte ─────────────────────────────────────────
interface CreateUserFormProps {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const ROLES_OPTIONS = [
  { role: UserRole.PATIENT,  icon: 'fa-user',          label: 'Patient',         color: 'bg-blue-600'   },
  { role: UserRole.PHARMACY, icon: 'fa-mortar-pestle',  label: 'Pharmacie',       color: 'bg-emerald-600'},
  { role: UserRole.DRIVER,   icon: 'fa-motorcycle',     label: 'Livreur',         color: 'bg-amber-600'  },
  { role: UserRole.ADMIN,    icon: 'fa-shield-halved',  label: 'Administrateur',  color: 'bg-red-600'    },
];

const CreateUserForm: React.FC<CreateUserFormProps> = ({ onClose, onSuccess }) => {
  const [role, setRole]               = useState<UserRole>(UserRole.PATIENT);
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [phone, setPhone]             = useState('');
  const [pharmacyName, setPharmacyName]   = useState('');
  const [pharmacyAddress, setPharmacyAddress] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 8);
    const parts = [];
    for (let i = 0; i < digits.length; i += 2) parts.push(digits.slice(i, i + 2));
    return parts.join(' ');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const phoneDigits = phone.replace(/\s/g, '');
      const fullPhone = `+253${phoneDigits}`;

      // Mot de passe temporaire aléatoire
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

      // Création du compte Firebase Auth via API REST (sans déconnecter l'admin)
      const apiKey = 'AIzaSyCjQfPLdQdn1QFEEA7oc5BBsDWLMHvMQus'; // Firebase API key
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: tempPassword, returnSecureToken: true })
        }
      );
      const data = await res.json();
      if (data.error) {
        if (data.error.message === 'EMAIL_EXISTS') setError('Cet email est déjà utilisé.');
        else setError(`Erreur : ${data.error.message}`);
        return;
      }

      const uid = data.localId;
      const isAdminRole = role === UserRole.ADMIN || email.toLowerCase() === ADMIN_EMAIL;

      const profile: Partial<UserProfile> = {
        uid,
        name,
        email,
        phone: fullPhone,
        role: isAdminRole ? UserRole.ADMIN : role,
        status: UserStatus.APPROVED, // créé par admin = approuvé directement
        createdAt: new Date().toISOString(),
        soundEnabled: false,
      };

      if (role === UserRole.PHARMACY) Object.assign(profile, { pharmacyName, pharmacyAddress, licenseNumber });
      if (role === UserRole.DRIVER)   Object.assign(profile, { vehicleType, vehiclePlate });

      await setDoc(doc(db, 'users', uid), profile);

      // Notification email
      const roleLabel = ROLES_OPTIONS.find(r => r.role === role)?.label || role;
      const tpl = EMAIL_TEMPLATES.created(name, roleLabel, tempPassword);
      await sendNotificationEmail(email, name, tpl.subject, tpl.message);

      onSuccess(`✅ Compte ${roleLabel} créé pour ${name}. Un email avec le mot de passe temporaire a été envoyé.`);
      onClose();
    } catch (err: any) {
      setError('Une erreur est survenue. Réessayez.');
      console.error(err);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">Créer un compte</h2>
            <p className="text-blue-200 text-xs mt-0.5">Le compte sera approuvé automatiquement</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Sélecteur de rôle */}
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Rôle</p>
            <div className="grid grid-cols-4 gap-2">
              {ROLES_OPTIONS.map(({ role: r, icon, label, color }) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`py-3 rounded-xl flex flex-col items-center gap-1.5 text-[10px] font-black uppercase transition-all border-2 ${
                    role === r ? `${color} text-white border-transparent` : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}>
                  <i className={`fa-solid ${icon} text-sm`}></i>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Champs Pharmacie */}
          {role === UserRole.PHARMACY && (
            <div className="space-y-3 p-4 bg-slate-800 rounded-2xl border border-slate-700">
              <p className="text-[9px] font-black uppercase text-emerald-400 tracking-widest">Infos Pharmacie</p>
              <input required value={pharmacyName} onChange={e => setPharmacyName(e.target.value)} placeholder="Nom de la pharmacie"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
              <input required value={pharmacyAddress} onChange={e => setPharmacyAddress(e.target.value)} placeholder="Adresse"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
              <input required value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="Numéro de licence"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
            </div>
          )}

          {/* Champs Livreur */}
          {role === UserRole.DRIVER && (
            <div className="space-y-3 p-4 bg-slate-800 rounded-2xl border border-slate-700">
              <p className="text-[9px] font-black uppercase text-amber-400 tracking-widest">Infos Livreur</p>
              <select required value={vehicleType} onChange={e => setVehicleType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500">
                <option value="">Type de véhicule...</option>
                <option>Moto</option>
                <option>Voiture</option>
                <option>Vélo</option>
              </select>
              <input required value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} placeholder="Plaque d'immatriculation"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500" />
            </div>
          )}

          {/* Champs communs */}
          <div className="space-y-3">
            <input required value={name} onChange={e => setName(e.target.value)}
              placeholder={role === UserRole.PHARMACY ? 'Nom du responsable' : 'Nom complet'}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500" />

            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Adresse email"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500" />

            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus-within:border-blue-500">
              <span className="text-slate-400 text-sm mr-2 shrink-0">+253</span>
              <input required value={formatPhone(phone)} onChange={e => setPhone(formatPhone(e.target.value).replace(/\s/g, ''))}
                placeholder="77 80 00 00" maxLength={11}
                className="flex-1 bg-transparent outline-none text-white placeholder-slate-500 text-sm" />
            </div>
          </div>

          <div className="bg-blue-900/30 border border-blue-800 rounded-xl p-3 text-xs text-blue-300">
            <i className="fa-solid fa-info-circle mr-2"></i>
            Un mot de passe temporaire sera généré et envoyé par email. L'utilisateur devra le changer à sa première connexion.
          </div>

          {error && <p className="text-red-400 text-xs font-semibold text-center">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-black uppercase text-xs tracking-widest transition-all">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50">
              {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Créer le compte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Composant principal de gestion des utilisateurs ──────────────────────────
interface AdminUserManagerProps {
  users: UserProfile[];
}

const AdminUserManager: React.FC<AdminUserManagerProps> = ({ users }) => {
  const [showCreateForm, setShowCreateForm]   = useState(false);
  const [successBanner, setSuccessBanner]     = useState('');
  const [loadingUid, setLoadingUid]           = useState<string | null>(null);
  const [filterRole, setFilterRole]           = useState<UserRole | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus]       = useState<UserStatus | 'ALL'>('ALL');

  const pendingUsers  = users.filter(u => u.status === UserStatus.PENDING);
  const allUsers      = users.filter(u => {
    const roleOk   = filterRole   === 'ALL' || u.role   === filterRole;
    const statusOk = filterStatus === 'ALL' || u.status === filterStatus;
    return roleOk && statusOk;
  });

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(''), 5000);
  };

  const handleUpdateStatus = async (user: UserProfile, status: UserStatus) => {
    setLoadingUid(user.uid);
    try {
      await updateDoc(doc(db, 'users', user.uid), { status });

      // Notification email selon l'action
      if (status === UserStatus.APPROVED) {
        const roleLabel = ROLES_OPTIONS.find(r => r.role === user.role)?.label || user.role;
        const tpl = EMAIL_TEMPLATES.approved(user.name, roleLabel);
        await sendNotificationEmail(user.email, user.name, tpl.subject, tpl.message);
        showSuccess(`✅ ${user.name} approuvé(e) — Email de confirmation envoyé`);
      } else if (status === UserStatus.REJECTED) {
        const tpl = EMAIL_TEMPLATES.rejected(user.name);
        await sendNotificationEmail(user.email, user.name, tpl.subject, tpl.message);
        showSuccess(`❌ ${user.name} refusé(e) — Email de notification envoyé`);
      }
    } catch (err) {
      console.error(err);
    } finally { setLoadingUid(null); }
  };

  const roleIcon = (role: UserRole) => {
    if (role === UserRole.PHARMACY) return 'fa-mortar-pestle';
    if (role === UserRole.DRIVER)   return 'fa-motorcycle';
    if (role === UserRole.ADMIN)    return 'fa-shield-halved';
    return 'fa-user';
  };

  const roleColor = (role: UserRole) => {
    if (role === UserRole.PHARMACY) return 'text-emerald-400';
    if (role === UserRole.DRIVER)   return 'text-amber-400';
    if (role === UserRole.ADMIN)    return 'text-red-400';
    return 'text-blue-400';
  };

  const statusBadge = (status: UserStatus) => {
    if (status === UserStatus.APPROVED) return <span className="text-[8px] font-black px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded uppercase">Actif</span>;
    if (status === UserStatus.PENDING)  return <span className="text-[8px] font-black px-2 py-1 bg-amber-500/20 text-amber-400 rounded uppercase">En attente</span>;
    return <span className="text-[8px] font-black px-2 py-1 bg-red-500/20 text-red-400 rounded uppercase">Refusé</span>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Bandeau succès */}
      {successBanner && (
        <div className="bg-emerald-900/50 border border-emerald-700 rounded-2xl p-4 text-emerald-300 text-sm font-semibold flex items-center gap-3">
          <i className="fa-solid fa-circle-check text-emerald-400 text-lg shrink-0"></i>
          {successBanner}
        </div>
      )}

      {/* En-tête avec bouton créer */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-black uppercase tracking-tight">Gestion des Utilisateurs</h3>
          <p className="text-slate-400 text-xs mt-0.5">{users.length} utilisateurs au total • {pendingUsers.length} en attente</p>
        </div>
        <button onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-xs tracking-wider transition-all shadow-lg shadow-blue-900/50">
          <i className="fa-solid fa-user-plus"></i>
          Créer un compte
        </button>
      </div>

      {/* ── Section Approbations en attente ── */}
      {pendingUsers.length > 0 && (
        <div className="bg-slate-800/50 rounded-3xl border-2 border-amber-500/30 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
            <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">
              {pendingUsers.length} demande{pendingUsers.length > 1 ? 's' : ''} en attente d'approbation
            </p>
          </div>
          <div className="space-y-3">
            {pendingUsers.map(u => (
              <div key={u.uid} className="flex items-center justify-between p-4 bg-slate-900 rounded-2xl border border-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 ${roleColor(u.role)}`}>
                    <i className={`fa-solid ${roleIcon(u.role)}`}></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white truncate">{u.name}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${roleColor(u.role)}`}>{u.role}</p>
                    <p className="text-[9px] text-slate-500 truncate">{u.email} • {u.phone}</p>
                    {u.pharmacyName && <p className="text-[9px] text-slate-400 truncate">🏥 {u.pharmacyName} — {u.pharmacyAddress}</p>}
                    {u.vehicleType  && <p className="text-[9px] text-slate-400">🏍️ {u.vehicleType} — {u.vehiclePlate}</p>}
                    {u.licenseNumber && <p className="text-[9px] text-slate-400">📋 Licence : {u.licenseNumber}</p>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <button onClick={() => handleUpdateStatus(u, UserStatus.APPROVED)}
                    disabled={loadingUid === u.uid}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50 flex items-center gap-1.5">
                    {loadingUid === u.uid ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                    Approuver
                  </button>
                  <button onClick={() => handleUpdateStatus(u, UserStatus.REJECTED)}
                    disabled={loadingUid === u.uid}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50 flex items-center gap-1.5">
                    <i className="fa-solid fa-xmark"></i>
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="flex flex-wrap gap-2">
        {/* Filtre rôle */}
        <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
          {(['ALL', ...Object.values(UserRole)] as (UserRole | 'ALL')[]).map(r => (
            <button key={r} onClick={() => setFilterRole(r)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filterRole === r ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {r === 'ALL' ? 'Tous' : r}
            </button>
          ))}
        </div>
        {/* Filtre statut */}
        <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
          {(['ALL', UserStatus.APPROVED, UserStatus.PENDING, UserStatus.REJECTED] as (UserStatus | 'ALL')[]).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filterStatus === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {s === 'ALL' ? 'Tous' : s === UserStatus.APPROVED ? 'Actifs' : s === UserStatus.PENDING ? 'En attente' : 'Refusés'}
            </button>
          ))}
        </div>
        <p className="text-slate-500 text-xs self-center ml-auto">{allUsers.length} résultat{allUsers.length > 1 ? 's' : ''}</p>
      </div>

      {/* ── Tableau de tous les utilisateurs ── */}
      <div className="bg-slate-800/50 rounded-3xl border-2 border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700 text-[8px] font-black uppercase text-slate-400 tracking-[0.2em]">
                <th className="px-6 py-4">Utilisateur</th>
                <th className="px-6 py-4">Rôle</th>
                <th className="px-6 py-4 hidden md:table-cell">Contact</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {allUsers.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-500 text-xs italic">Aucun utilisateur trouvé</td></tr>
              )}
              {allUsers.map(u => (
                <tr key={u.uid} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {u.photoURL
                        ? <img src={u.photoURL} className="w-9 h-9 rounded-xl object-cover shrink-0" alt={u.name} />
                        : <div className={`w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 ${roleColor(u.role)}`}>
                            <i className={`fa-solid ${roleIcon(u.role)} text-xs`}></i>
                          </div>
                      }
                      <div>
                        <p className="text-xs font-black text-white">{u.name}</p>
                        {u.pharmacyName && <p className="text-[8px] text-slate-500">🏥 {u.pharmacyName}</p>}
                        {u.vehicleType  && <p className="text-[8px] text-slate-500">🏍️ {u.vehicleType} — {u.vehiclePlate}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black uppercase ${roleColor(u.role)}`}>{u.role}</span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <p className="text-xs text-slate-300">{u.email}</p>
                    <p className="text-[9px] text-slate-500">{u.phone}</p>
                  </td>
                  <td className="px-6 py-4">{statusBadge(u.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {u.status !== UserStatus.APPROVED && (
                        <button onClick={() => handleUpdateStatus(u, UserStatus.APPROVED)}
                          disabled={loadingUid === u.uid}
                          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-[9px] font-black uppercase transition-all disabled:opacity-50">
                          Approuver
                        </button>
                      )}
                      {u.status !== UserStatus.REJECTED && (
                        <button onClick={() => handleUpdateStatus(u, UserStatus.REJECTED)}
                          disabled={loadingUid === u.uid}
                          className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-[9px] font-black uppercase transition-all disabled:opacity-50">
                          {u.status === UserStatus.APPROVED ? 'Désactiver' : 'Refuser'}
                        </button>
                      )}
                      {u.status === UserStatus.REJECTED && (
                        <button onClick={() => handleUpdateStatus(u, UserStatus.PENDING)}
                          disabled={loadingUid === u.uid}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-[9px] font-black uppercase transition-all disabled:opacity-50">
                          Remettre en attente
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal création */}
      {showCreateForm && (
        <CreateUserForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={showSuccess}
        />
      )}
    </div>
  );
};

export default AdminUserManager;