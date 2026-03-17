import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { doc, setDoc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { UserRole, UserStatus, UserProfile } from '@/types';
import { ADMIN_EMAIL } from '@/constants';

interface AuthProps {
  onAuthSuccess: (user: User, profile: UserProfile) => void;
  targetRole?: UserRole;
}

type View = 'login' | 'register' | 'forgot' | 'forgot-otp';

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 2) parts.push(digits.slice(i, i + 2));
  return parts.join(' ');
};

const Field = ({
  icon, type = 'text', placeholder, value, onChange, children, required = true, autoComplete
}: {
  icon: string; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  children?: React.ReactNode; required?: boolean; autoComplete?: string;
}) => (
  <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-[#1a6fd4] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
    <i className={`fa-solid ${icon} text-slate-400 w-5 text-center mr-3 shrink-0`}></i>
    <input
      type={type} placeholder={placeholder} value={value}
      onChange={e => onChange(e.target.value)}
      required={required} autoComplete={autoComplete}
      className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm font-medium min-w-0"
    />
    {children}
  </div>
);

const Auth: React.FC<AuthProps> = ({ onAuthSuccess, targetRole }) => {
  const [view, setView] = useState<View>('login');
  const [phoneDigits, setPhoneDigits]   = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail]               = useState('');
  const [name, setName]                 = useState('');
  const [role, setRole]                 = useState<UserRole>(targetRole || UserRole.PATIENT);
  const [pharmacyName, setPharmacyName]       = useState('');
  const [pharmacyAddress, setPharmacyAddress] = useState('');
  const [licenseNumber, setLicenseNumber]     = useState('');
  const [vehicleType, setVehicleType]   = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [loginMode, setLoginMode] = useState<'phone' | 'email'>('phone'); // patient: choix téléphone ou email
  const [loginEmail, setLoginEmail] = useState(''); // email direct pour connexion
  const [otpCode, setOtpCode]                       = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otpTimer, setOtpTimer]                     = useState(0);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (otpTimer <= 0) return;
    const t = setInterval(() => setOtpTimer(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [otpTimer]);

  const displayedPhone = phoneDigits ? formatPhone(phoneDigits) : '';
  const handlePhoneChange = (val: string) => setPhoneDigits(formatPhone(val).replace(/\s/g, ''));

  const resetForm = () => {
    setError(''); setSuccessMessage('');
    setPhoneDigits(''); setPassword(''); setEmail(''); setName('');
    setPharmacyName(''); setPharmacyAddress(''); setLicenseNumber('');
    setVehicleType(''); setVehiclePlate('');
    setOtpCode(''); setConfirmationResult(null); setOtpTimer(0);
    setUnverifiedEmail(''); setLoginEmail('');
  };

  const goTo = (v: View) => { resetForm(); setView(v); };

  // ── Connexion (téléphone ou email selon loginMode)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let emailToUse = '';

      // Déterminer le mode de connexion selon le rôle
      // Livreur → téléphone uniquement
      // Pharmacie + Admin → email uniquement
      // Patient → selon loginMode (toggle)
      const isPhoneOnly = targetRole === UserRole.DRIVER;
      const isEmailOnly = targetRole === UserRole.PHARMACY || targetRole === UserRole.ADMIN;
      const usePhone = isPhoneOnly || (!isEmailOnly && loginMode === 'phone');

      if (usePhone) {
        // Connexion par numéro de téléphone → chercher l'email associé
        const phoneRegex = /^77\d{6}$/;
        if (!phoneRegex.test(phoneDigits)) { setError('Numéro invalide. Format : 77 80 00 00'); return; }
        const fullPhone = `+253${phoneDigits}`;
        // Utiliser l'API REST Firebase pour lire sans auth
        const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/pharmaconnect-31315/databases/(default)/documents:runQuery?key=${apiKey}`;
        const queryBody = {
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'phone' },
                op: 'EQUAL',
                value: { stringValue: fullPhone }
              }
            },
            limit: 1
          }
        };
        const res = await fetch(firestoreUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queryBody)
        });
        const data = await res.json();
        const doc = data[0]?.document;
        if (!doc) { setError('Aucun compte trouvé avec ce numéro.'); return; }
        emailToUse = doc.fields?.email?.stringValue || '';
        if (!emailToUse) { setError('Compte introuvable.'); return; }
      } else {
        // Connexion directe par email (Pharmacie, Admin, ou Patient mode email)
        if (!loginEmail) { setError('Veuillez saisir votre email.'); return; }
        emailToUse = loginEmail.trim().toLowerCase();
      }

      const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
      const user = cred.user;

      // Admin bypass — pas de vérification email pour le compte admin
      const adminEmails = [
        'nassertaheromar@gmail.com',
        'nassert93@gmail.com',
        (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase()
      ];
      const isAdminAccount = adminEmails.includes(emailToUse.toLowerCase());
      
      if (!user.emailVerified && !isAdminAccount) {
        setUnverifiedEmail(emailToUse);
        setError("Votre email n'est pas encore vérifié. Consultez votre boîte de réception.");
        await auth.signOut(); return;
      }
      setUnverifiedEmail('');

      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (!docSnap.exists()) { setError('Profil introuvable.'); return; }
      const profile = docSnap.data() as UserProfile;
      if (targetRole && profile.role !== targetRole && profile.role !== UserRole.ADMIN) {
        setError("Ce compte n'est pas autorisé pour cet espace.");
        await auth.signOut(); return;
      }
      onAuthSuccess(user, profile);
    } catch (err: any) {
      const code = err.code || '';
      if (code.includes('wrong-password') || code.includes('user-not-found') || code.includes('invalid-credential'))
        setError('Identifiants incorrects. Vérifiez et réessayez.');
      else setError('Une erreur est survenue. Réessayez.');
    } finally { setLoading(false); }
  };

  // ── Inscription
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const phoneRegex = /^77\d{6}$/;
      if (!phoneRegex.test(phoneDigits)) { setError('Numéro invalide. Format : 77 80 00 00'); return; }
      if (!email) { setError('Veuillez saisir votre email.'); return; }
      const fullPhone = `+253${phoneDigits}`;
      const existing = await getDocs(query(collection(db, 'users'), where('phone', '==', fullPhone)));
      if (!existing.empty) { setError('Ce numéro est déjà utilisé.'); return; }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      await sendEmailVerification(user);
      await updateProfile(user, { displayName: name });
      const isAdmin = email.toLowerCase() === ADMIN_EMAIL;
      const finalRole = isAdmin ? UserRole.ADMIN : role;
      const finalStatus = (role === UserRole.PATIENT || isAdmin) ? UserStatus.APPROVED : UserStatus.PENDING;
      const profile: Partial<UserProfile> = {
        uid: user.uid, name, email, phone: fullPhone,
        role: finalRole, status: finalStatus,
        createdAt: new Date().toISOString()
      };
      if (role === UserRole.PHARMACY) Object.assign(profile, { pharmacyName, pharmacyAddress, licenseNumber });
      if (role === UserRole.DRIVER)   Object.assign(profile, { vehicleType, vehiclePlate });
      await setDoc(doc(db, 'users', user.uid), profile);
      // Déconnecter immédiatement — doit vérifier son email d'abord
      await auth.signOut();
      if (role === UserRole.PATIENT) {
        setSuccessMessage('Compte créé ! Un lien de confirmation a été envoyé à votre email. Cliquez dessus pour activer votre compte.');
      } else {
        setSuccessMessage('Demande envoyée ! Vérifiez votre email (lien envoyé), puis attendez la validation par un administrateur.');
      }
      goTo('login');
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/email-already-in-use') setError('Cet email est déjà utilisé.');
      else if (code === 'auth/weak-password') setError('Mot de passe trop court (6 caractères minimum).');
      else setError('Une erreur est survenue. Réessayez.');
    } finally { setLoading(false); }
  };

  // ── Mot de passe oublié étape 1 : envoyer OTP SMS
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const phoneRegex = /^77\d{6}$/;
      if (!phoneRegex.test(phoneDigits)) { setError('Numéro invalide. Format : 77 80 00 00'); return; }
      const fullPhone = `+253${phoneDigits}`;
      const snap = await getDocs(query(collection(db, 'users'), where('phone', '==', fullPhone)));
      if (snap.empty) { setError('Aucun compte trouvé avec ce numéro.'); return; }
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      const result = await signInWithPhoneNumber(auth, fullPhone, recaptchaRef.current);
      setConfirmationResult(result);
      setOtpTimer(60);
      setView('forgot-otp');
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/too-many-requests') setError('Trop de tentatives. Réessayez dans quelques minutes.');
      else if (code === 'auth/invalid-phone-number') setError('Numéro de téléphone invalide.');
      else setError("Impossible d'envoyer le SMS. Réessayez.");
      if (recaptchaRef.current) { recaptchaRef.current.clear(); recaptchaRef.current = null; }
    } finally { setLoading(false); }
  };

  // ── Mot de passe oublié étape 2 : vérifier OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setError(''); setLoading(true);
    try {
      if (otpCode.length !== 6) { setError('Le code doit contenir 6 chiffres.'); return; }
      await confirmationResult.confirm(otpCode);
      const fullPhone = `+253${phoneDigits}`;
      const snap = await getDocs(query(collection(db, 'users'), where('phone', '==', fullPhone)));
      if (!snap.empty) {
        const userEmail = snap.docs[0].data().email as string;
        await sendPasswordResetEmail(auth, userEmail);
        await auth.signOut();
        setSuccessMessage("Code correct ! Un email de réinitialisation a été envoyé. Suivez le lien pour créer un nouveau mot de passe.");
        goTo('login');
      }
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/invalid-verification-code') setError('Code incorrect. Vérifiez et réessayez.');
      else if (code === 'auth/code-expired') setError('Code expiré. Demandez un nouveau code.');
      else setError('Erreur de vérification. Réessayez.');
    } finally { setLoading(false); }
  };

  const handleResendOTP = () => {
    if (otpTimer > 0) return;
    setOtpCode(''); setConfirmationResult(null);
    if (recaptchaRef.current) { recaptchaRef.current.clear(); recaptchaRef.current = null; }
    goTo('forgot');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans" style={{
      background: targetRole === UserRole.PHARMACY
        ? 'linear-gradient(160deg, #eafaf1 0%, #e8f8f0 100%)'   // vert pour pharmacie
        : targetRole === UserRole.ADMIN
        ? 'linear-gradient(160deg, #f0f0f5 0%, #e8e8f0 100%)'   // gris pour admin
        : targetRole === UserRole.DRIVER
        ? 'linear-gradient(160deg, #fdf8ee 0%, #fef3e2 100%)'   // amber pour livreur
        : 'linear-gradient(160deg, #e8f0fb 0%, #eaf5ea 100%)'   // bleu-vert pour patient
    }}>
      <div id="recaptcha-container"></div>
      <div className="w-full max-w-sm">

        {/* Logo + identité selon le rôle */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="PharmaConnect" className="w-24 h-24 mx-auto mb-3 object-contain drop-shadow-md" />
          <h1 className="text-3xl font-black tracking-tight">
            <span style={{color:'#1a6fd4'}}>Pharma</span><span style={{color:'#4caf50'}}>Connect</span>
          </h1>

          {/* Badge rôle */}
          {(!targetRole || targetRole === UserRole.PATIENT) && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 border border-blue-100 rounded-full">
              <i className="fa-solid fa-user text-blue-500 text-xs"></i>
              <span className="text-blue-600 text-xs font-black uppercase tracking-widest">Espace Patient</span>
            </div>
          )}
          {targetRole === UserRole.PHARMACY && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
              <i className="fa-solid fa-mortar-pestle text-emerald-500 text-xs"></i>
              <span className="text-emerald-600 text-xs font-black uppercase tracking-widest">Espace Pharmacie</span>
            </div>
          )}
          {targetRole === UserRole.DRIVER && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 border border-amber-100 rounded-full">
              <i className="fa-solid fa-motorcycle text-amber-500 text-xs"></i>
              <span className="text-amber-600 text-xs font-black uppercase tracking-widest">Espace Livreur</span>
            </div>
          )}
          {targetRole === UserRole.ADMIN && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 bg-slate-100 border border-slate-200 rounded-full">
              <i className="fa-solid fa-shield-halved text-slate-600 text-xs"></i>
              <span className="text-slate-700 text-xs font-black uppercase tracking-widest">Administration</span>
            </div>
          )}
        </div>

        {/* ── CONNEXION ── */}
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            {successMessage && (
              <div className="bg-emerald-50 text-emerald-700 text-xs font-semibold p-3 rounded-xl border border-emerald-100 flex gap-2 items-start">
                <i className="fa-solid fa-circle-check mt-0.5 shrink-0"></i>
                <span>{successMessage}</span>
              </div>
            )}
            {/* ── Champs identifiant selon le rôle ── */}

            {/* Livreur : téléphone uniquement */}
            {targetRole === UserRole.DRIVER && (
              <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-[#1a6fd4] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <i className="fa-solid fa-phone text-slate-400 w-5 text-center mr-3 shrink-0"></i>
                <span className="text-slate-500 text-sm font-medium mr-2 shrink-0">+253</span>
                <input type="tel" placeholder="77 80 00 00" value={displayedPhone}
                  onChange={e => handlePhoneChange(e.target.value)} maxLength={11} required
                  className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm font-medium min-w-0" />
              </div>
            )}

            {/* Pharmacie + Admin : email uniquement */}
            {(targetRole === UserRole.PHARMACY || targetRole === UserRole.ADMIN) && (
              <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-[#1a6fd4] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <i className="fa-solid fa-envelope text-slate-400 w-5 text-center mr-3 shrink-0"></i>
                <input type="email" placeholder="Adresse email professionnelle" value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)} required autoComplete="email"
                  className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm font-medium min-w-0" />
              </div>
            )}

            {/* Patient : toggle Téléphone / Email */}
            {(!targetRole || targetRole === UserRole.PATIENT) && (<>
              <div className="flex bg-slate-200 rounded-2xl p-1 gap-1">
                <button type="button" onClick={() => { setLoginMode('phone'); setError(''); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${
                    loginMode === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  <i className="fa-solid fa-phone text-xs"></i> Téléphone
                </button>
                <button type="button" onClick={() => { setLoginMode('email'); setError(''); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${
                    loginMode === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  <i className="fa-solid fa-envelope text-xs"></i> Email
                </button>
              </div>

              {loginMode === 'phone' ? (
                <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-[#1a6fd4] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <i className="fa-solid fa-phone text-slate-400 w-5 text-center mr-3 shrink-0"></i>
                  <span className="text-slate-500 text-sm font-medium mr-2 shrink-0">+253</span>
                  <input type="tel" placeholder="77 80 00 00" value={displayedPhone}
                    onChange={e => handlePhoneChange(e.target.value)} maxLength={11} required
                    className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm font-medium min-w-0" />
                </div>
              ) : (
                <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-[#1a6fd4] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <i className="fa-solid fa-envelope text-slate-400 w-5 text-center mr-3 shrink-0"></i>
                  <input type="email" placeholder="Adresse email" value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)} required autoComplete="email"
                    className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm font-medium min-w-0" />
                </div>
              )}
            </>)}

            {/* Mot de passe */}
            <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-[#1a6fd4] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <i className="fa-solid fa-lock text-slate-400 w-5 text-center mr-3 shrink-0"></i>
              <input type={showPassword ? 'text' : 'password'} placeholder="Mot de passe"
                value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm font-medium min-w-0" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="ml-2 text-slate-400 hover:text-slate-600 shrink-0">
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>

            {/* Bandeau email non vérifié */}
            {unverifiedEmail && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                <i className="fa-solid fa-envelope text-amber-500 text-xl mb-2 block"></i>
                <p className="text-amber-800 text-xs font-semibold mb-3">
                  Email non vérifié. Cliquez sur le lien dans votre boîte de réception pour activer votre compte.
                </p>
                <button type="button"
                  onClick={() => setSuccessMessage("Vérifiez votre boîte email. Si vous ne trouvez pas l'email, utilisez 'Mot de passe oublié'.")}
                  className="text-xs font-black text-amber-700 underline hover:text-amber-900">
                  Je n'ai pas reçu l'email →
                </button>
              </div>
            )}

            {error && <p className="text-red-500 text-xs font-semibold text-center">{error}</p>}

            <button type="submit" disabled={loading}
              style={{background:'linear-gradient(135deg, #1a6fd4, #4caf50)'}} className="w-full py-4 text-white rounded-2xl font-bold text-sm tracking-wide transition-all disabled:opacity-50 active:scale-[0.98] hover:opacity-90">
              {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i>
                : targetRole === UserRole.PHARMACY ? '🏥 Connexion Pharmacie'
                : targetRole === UserRole.ADMIN    ? '🛡️ Connexion Admin'
                : targetRole === UserRole.DRIVER   ? '🏍️ Connexion Livreur'
                : 'Connexion'}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => goTo('forgot')} style={{color:'#1a6fd4'}} className="text-sm font-semibold hover:underline">
                Mot de passe oublié ?
              </button>
            </div>
            <p className="text-center text-sm text-slate-500 pt-2">
              Pas encore de compte ?{' '}
              <button type="button" onClick={() => goTo('register')} style={{color:'#4caf50'}} className="font-bold hover:underline">
                Inscrivez-vous !
              </button>
            </p>
          </form>
        )}

        {/* ── INSCRIPTION ── */}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <h2 className="text-xl font-black text-slate-900 text-center mb-4">Créer un compte</h2>
            {!targetRole && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { r: UserRole.PATIENT,  icon: 'fa-user',         label: 'Patient'   },
                  { r: UserRole.PHARMACY, icon: 'fa-mortar-pestle', label: 'Pharmacie' },
                  { r: UserRole.DRIVER,   icon: 'fa-motorcycle',    label: 'Livreur'   },
                ].map(({ r, icon, label }) => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    style={role === r ? {background:'linear-gradient(135deg, #1a6fd4, #4caf50)'} : {}} className={`py-2.5 rounded-xl text-xs font-black uppercase flex flex-col items-center gap-1 transition-all border-2 ${
                      role === r ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200'
                    }`}>
                    <i className={`fa-solid ${icon} text-sm`}></i>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {role === UserRole.PHARMACY && (<>
              <Field icon="fa-hospital"     placeholder="Nom de la pharmacie"  value={pharmacyName}    onChange={setPharmacyName} />
              <Field icon="fa-location-dot" placeholder="Adresse"               value={pharmacyAddress} onChange={setPharmacyAddress} />
              <Field icon="fa-id-card"      placeholder="Numéro de licence"      value={licenseNumber}   onChange={setLicenseNumber} />
            </>)}
            {role === UserRole.DRIVER && (<>
              <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-blue-500 transition-all">
                <i className="fa-solid fa-motorcycle text-slate-400 w-5 text-center mr-3 shrink-0"></i>
                <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} required
                  className="flex-1 bg-transparent outline-none text-slate-800 text-sm font-medium">
                  <option value="">Type de véhicule...</option>
                  <option value="Moto">Moto</option>
                  <option value="Voiture">Voiture</option>
                  <option value="Vélo">Vélo</option>
                </select>
              </div>
              <Field icon="fa-barcode" placeholder="Plaque d'immatriculation" value={vehiclePlate} onChange={setVehiclePlate} />
            </>)}
            <Field icon="fa-user" placeholder={role === UserRole.PHARMACY ? 'Nom du responsable' : 'Nom complet'} value={name} onChange={setName} />
            <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-[#1a6fd4] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <i className="fa-solid fa-phone text-slate-400 w-5 text-center mr-3 shrink-0"></i>
              <span className="text-slate-500 text-sm font-medium mr-2 shrink-0">+253</span>
              <input type="tel" placeholder="77 80 00 00" value={displayedPhone}
                onChange={e => handlePhoneChange(e.target.value)} maxLength={11} required
                className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm font-medium min-w-0" />
            </div>
            <Field icon="fa-envelope" type="email" placeholder="Adresse email" value={email} onChange={setEmail} autoComplete="email" />
            <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-[#1a6fd4] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <i className="fa-solid fa-lock text-slate-400 w-5 text-center mr-3 shrink-0"></i>
              <input type={showPassword ? 'text' : 'password'} placeholder="Mot de passe (min. 6 caractères)"
                value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password"
                className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm font-medium min-w-0" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="ml-2 text-slate-400 shrink-0">
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {error && <p className="text-red-500 text-xs font-semibold text-center">{error}</p>}
            <button type="submit" disabled={loading}
              style={{background:'linear-gradient(135deg, #1a6fd4, #4caf50)'}} className="w-full py-4 text-white rounded-2xl font-bold text-sm tracking-wide transition-all disabled:opacity-50 active:scale-[0.98] hover:opacity-90">
              {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Créer mon compte'}
            </button>
            <p className="text-center text-sm text-slate-500 pt-1">
              Déjà un compte ?{' '}
              <button type="button" onClick={() => goTo('login')} className="text-blue-600 font-bold hover:underline">
                Se connecter
              </button>
            </p>
          </form>
        )}

        {/* ── MOT DE PASSE OUBLIÉ — Étape 1 : numéro ── */}
        {view === 'forgot' && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="text-center mb-2">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-mobile-screen-button text-2xl"></i>
              </div>
              <h2 className="text-xl font-black text-slate-900">Mot de passe oublié ?</h2>
              <p className="text-slate-400 text-xs mt-1 font-medium leading-relaxed">
                Entrez votre numéro de téléphone. Nous vous enverrons un code SMS de vérification.
              </p>
            </div>
            <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-[#1a6fd4] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <i className="fa-solid fa-phone text-slate-400 w-5 text-center mr-3 shrink-0"></i>
              <span className="text-slate-500 text-sm font-medium mr-2 shrink-0">+253</span>
              <input type="tel" placeholder="77 80 00 00" value={displayedPhone}
                onChange={e => handlePhoneChange(e.target.value)} maxLength={11} required
                className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm font-medium min-w-0" />
            </div>
            {error && <p className="text-red-500 text-xs font-semibold text-center">{error}</p>}
            <button type="submit" disabled={loading}
              style={{background:'linear-gradient(135deg, #1a6fd4, #4caf50)'}} className="w-full py-4 text-white rounded-2xl font-bold text-sm tracking-wide transition-all disabled:opacity-50 active:scale-[0.98] hover:opacity-90">
              {loading
                ? <i className="fa-solid fa-circle-notch fa-spin"></i>
                : <><i className="fa-solid fa-paper-plane mr-2"></i>Envoyer le code SMS</>}
            </button>
            <button type="button" onClick={() => goTo('login')} className="w-full text-center text-slate-500 text-sm font-semibold hover:text-slate-700 py-2">
              ← Retour à la connexion
            </button>
          </form>
        )}

        {/* ── MOT DE PASSE OUBLIÉ — Étape 2 : code OTP ── */}
        {view === 'forgot-otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="text-center mb-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-message text-2xl"></i>
              </div>
              <h2 className="text-xl font-black text-slate-900">Code de vérification</h2>
              <p className="text-slate-400 text-xs mt-1 font-medium leading-relaxed">
                Code envoyé au <span className="font-black text-slate-700">+253 {formatPhone(phoneDigits)}</span>
              </p>
            </div>
            <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-4 focus-within:border-[#1a6fd4] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <i className="fa-solid fa-key text-slate-400 w-5 text-center mr-3 shrink-0"></i>
              <input type="tel" placeholder="• • • • • •"
                value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6} required
                className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-300 text-2xl font-black tracking-[0.6em] text-center min-w-0" />
            </div>
            {error && <p className="text-red-500 text-xs font-semibold text-center">{error}</p>}
            <button type="submit" disabled={loading || otpCode.length < 6}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-sm tracking-wide transition-all disabled:opacity-50 active:scale-[0.98]">
              {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Vérifier et réinitialiser'}
            </button>
            <div className="text-center">
              {otpTimer > 0 ? (
                <p className="text-slate-400 text-xs font-semibold">
                  Renvoyer dans <span style={{color:'#1a6fd4'}} className="font-black">{otpTimer}s</span>
                </p>
              ) : (
                <button type="button" onClick={handleResendOTP} style={{color:'#1a6fd4'}} className="text-sm font-bold hover:underline">
                  Renvoyer le code
                </button>
              )}
            </div>
            <button type="button" onClick={() => goTo('forgot')} className="w-full text-center text-slate-500 text-sm font-semibold hover:text-slate-700 py-2">
              ← Changer de numéro
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default Auth;