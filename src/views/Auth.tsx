import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { UserRole, UserStatus } from '@/types';

interface AuthProps {
  onAuthSuccess: (user: any, profile: any) => void;
  targetRole?: UserRole;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess, targetRole }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [pharmacyAddress, setPharmacyAddress] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [role, setRole] = useState<UserRole>(targetRole || UserRole.PATIENT);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const formatDigits = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const parts = [];
    for (let i = 0; i < digits.length; i += 2) {
      parts.push(digits.slice(i, i + 2));
    }
    return parts.join(' ');
  };

  const handlePhoneDigitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDigits(e.target.value);
    setPhoneDigits(formatted.replace(/\s/g, ''));
  };

  const displayedPhone = phoneDigits ? formatDigits(phoneDigits) : '';

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (isLogin) {
        let loginEmail = email;

        if (loginMethod === 'phone') {
          if (!phoneDigits) {
            setError('Veuillez saisir votre numéro de téléphone.');
            setLoading(false);
            return;
          }
          const phoneRegex = /^77\d{6}$/;
          if (!phoneRegex.test(phoneDigits)) {
            setError('Numéro de téléphone invalide. Format: 77 80 00 00');
            setLoading(false);
            return;
          }
          const fullPhone = `+253${phoneDigits}`;

          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('phone', '==', fullPhone));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            setError('Aucun compte trouvé avec ce numéro de téléphone.');
            setLoading(false);
            return;
          }

          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          loginEmail = userData.email;
        }

        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
          setError('Veuillez vérifier votre email avant de vous connecter. Un lien de vérification a été envoyé lors de votre inscription.');
          setLoading(false);
          return;
        }

        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const profile = docSnap.data() as any;
          if (targetRole && profile.role !== targetRole && profile.role !== UserRole.ADMIN) {
            setError(`Ce compte n'est pas autorisé pour l'accès ${targetRole === UserRole.PHARMACY ? 'Pharmacien' : targetRole === UserRole.DRIVER ? 'Livreur' : 'Patient'}.`);
            await auth.signOut();
            setLoading(false);
            return;
          }
          onAuthSuccess(user, profile);
        } else {
          setError('Profil utilisateur introuvable.');
        }
      } else {
        if (!phoneDigits) {
          setError('Veuillez saisir votre numéro de téléphone.');
          setLoading(false);
          return;
        }
        const phoneRegex = /^77\d{6}$/;
        if (!phoneRegex.test(phoneDigits)) {
          setError('Le numéro de téléphone doit commencer par 77 et contenir 8 chiffres (ex: 77 80 00 00)');
          setLoading(false);
          return;
        }
        if (!email) {
          setError('Veuillez saisir votre email.');
          setLoading(false);
          return;
        }
        const fullPhone = `+253${phoneDigits}`;

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('phone', '==', fullPhone));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setError('Ce numéro de téléphone est déjà utilisé.');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await sendEmailVerification(user);

        await updateProfile(user, {
          displayName: name
        });

        const isAdminEmail = email.toLowerCase() === 'nassert93@gmail.com';
        
        const initialStatus = (role === UserRole.PATIENT || isAdminEmail) ? UserStatus.APPROVED : UserStatus.PENDING;
        const finalRole = isAdminEmail ? UserRole.ADMIN : role;

        const profile: any = {
          uid: user.uid,
          name,
          email,
          phone: fullPhone,
          role: finalRole,
          status: initialStatus,
          createdAt: new Date().toISOString()
        };

        if (role === UserRole.PHARMACY) {
          profile.pharmacyName = pharmacyName;
          profile.pharmacyAddress = pharmacyAddress;
          profile.licenseNumber = licenseNumber;
        } else if (role === UserRole.DRIVER) {
          profile.vehicleType = vehicleType;
          profile.vehiclePlate = vehiclePlate;
        }

        await setDoc(doc(db, 'users', user.uid), profile);

        setSuccessMessage('Compte créé avec succès ! Un email de vérification vous a été envoyé. Veuillez vérifier votre boîte de réception avant de vous connecter.');
        setIsLogin(true);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      const errorCode = err.code || '';
      const errorMessage = err.message || '';
      
      if (
        errorCode === 'auth/wrong-password' || 
        errorCode === 'auth/user-not-found' || 
        errorCode === 'auth/invalid-credential' ||
        errorMessage.includes('auth/invalid-credential')
      ) {
        setError('Téléphone/email ou mot de passe incorrect');
      } else if (errorCode === 'auth/email-already-in-use') {
        setError('Cet email est déjà utilisé.');
      } else if (errorCode === 'auth/weak-password') {
        setError('Le mot de passe est trop court (minimum 6 caractères)');
      } else if (errorCode === 'auth/invalid-email') {
        setError('Format d\'email invalide');
      } else {
        setError('Une erreur est survenue lors de l\'authentification');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    let resetEmail = email;
    if (loginMethod === 'phone') {
      if (!phoneDigits) {
        setError('Veuillez saisir votre numéro de téléphone.');
        setLoading(false);
        return;
      }
      const fullPhone = `+253${phoneDigits}`;
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('phone', '==', fullPhone));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setError('Aucun compte trouvé avec ce numéro de téléphone.');
        setLoading(false);
        return;
      }
      const userData = querySnapshot.docs[0].data();
      resetEmail = userData.email;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setSuccessMessage('Un email de réinitialisation a été envoyé à votre adresse. Veuillez vérifier votre boîte de réception.');
    } catch (err: any) {
      console.error("Reset error:", err);
      const errorCode = err.code || '';
      if (errorCode === 'auth/user-not-found') {
        setError('Aucun compte n\'est associé à ce téléphone/email.');
      } else if (errorCode === 'auth/invalid-email') {
        setError('Format d\'email invalide.');
      } else {
        setError('Une erreur est survenue. Veuillez réessayer plus tard.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        const newProfile: any = {
          uid: user.uid,
          name: user.displayName || 'Utilisateur',
          email: user.email || '',
          phone: '',
          role: UserRole.PATIENT,
          status: UserStatus.APPROVED,
          createdAt: new Date().toISOString(),
          photoURL: user.photoURL || null,
        };
        await setDoc(docRef, newProfile);
        onAuthSuccess(user, newProfile);
      } else {
        const profile = docSnap.data() as any;
        onAuthSuccess(user, profile);
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError('Un compte existe déjà avec cet email. Veuillez vous connecter avec votre mot de passe.');
      } else {
        setError('Erreur lors de la connexion avec Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start sm:justify-center p-4 sm:p-8 font-sans">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden border border-slate-100 my-8 sm:my-auto">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center">
          <img 
            src="/logo.png" 
            alt="PharmaConnect Logo" 
            className="w-20 h-20 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-black text-white">PharmaConnect</h1>
          <p className="text-blue-100 text-sm mt-1">
            {targetRole === UserRole.PHARMACY ? 'Espace Pharmacie' : 
             targetRole === UserRole.DRIVER ? 'Espace Livreur' : 
             targetRole === UserRole.ADMIN ? 'Espace Superviseur' : 
             'Espace Patient'}
          </p>
        </div>

        <div className="p-8">
          {isForgotPassword ? (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Réinitialisation</h2>
                <p className="text-xs text-slate-500 mt-1">Entrez votre téléphone ou email pour recevoir un lien de récupération.</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">
                    {loginMethod === 'phone' ? 'Téléphone' : 'Email'}
                  </label>
                  {loginMethod === 'phone' ? (
                    <div className="flex">
                      <span className="inline-flex items-center px-4 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm font-medium text-slate-600">
                        +253
                      </span>
                      <input
                        type="tel"
                        required
                        value={displayedPhone}
                        onChange={handlePhoneDigitsChange}
                        className="flex-1 pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-r-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                        placeholder="77 80 00 00"
                        maxLength={11}
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      <input 
                        type="email" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                        placeholder="votre@email.com"
                      />
                    </div>
                  )}
                </div>

                {successMessage && (
                  <div className="bg-emerald-50 text-emerald-600 text-xs font-black p-4 rounded-xl flex items-start gap-3 border border-emerald-100 mb-4">
                    <i className="fa-solid fa-circle-check mt-0.5"></i>
                    <p>{successMessage}</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 text-red-600 text-xs font-black p-3 rounded-xl flex items-center gap-2 border border-red-100">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    {error}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-sm tracking-widest shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Envoyer le lien'}
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="w-full text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors tracking-widest"
                >
                  Retour à la connexion
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="flex bg-slate-100 p-1 rounded-xl mb-8">
                <button 
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-2 text-sm font-black rounded-lg transition-all ${isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Connexion
                </button>
                <button 
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-2 text-sm font-black rounded-lg transition-all ${!isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Inscription
                </button>
              </div>

              {isLogin && (
                <div className="flex justify-center gap-4 mb-6">
                  <button
                    type="button"
                    onClick={() => setLoginMethod('phone')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                      loginMethod === 'phone' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <i className="fa-solid fa-phone mr-2"></i>
                    Téléphone
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod('email')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                      loginMethod === 'email' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <i className="fa-solid fa-envelope mr-2"></i>
                    Email
                  </button>
                </div>
              )}

              <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                  <>
                    {role === UserRole.PHARMACY && (
                      <>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Nom de la Pharmacie</label>
                          <div className="relative">
                            <i className="fa-solid fa-hospital absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input 
                              type="text" 
                              required 
                              value={pharmacyName}
                              onChange={(e) => setPharmacyName(e.target.value)}
                              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                              placeholder="Pharmacie de la Paix"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Adresse de l'Officine</label>
                          <div className="relative">
                            <i className="fa-solid fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input 
                              type="text" 
                              required 
                              value={pharmacyAddress}
                              onChange={(e) => setPharmacyAddress(e.target.value)}
                              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                              placeholder="Avenue 13, Djibouti"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Numéro de Licence</label>
                          <div className="relative">
                            <i className="fa-solid fa-id-card absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input 
                              type="text" 
                              required 
                              value={licenseNumber}
                              onChange={(e) => setLicenseNumber(e.target.value)}
                              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                              placeholder="LIC-2026-XXXX"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {role === UserRole.DRIVER && (
                      <>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Type de Véhicule</label>
                          <div className="relative">
                            <i className="fa-solid fa-motorcycle absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <select 
                              required 
                              value={vehicleType}
                              onChange={(e) => setVehicleType(e.target.value)}
                              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium appearance-none"
                            >
                              <option value="">Sélectionner...</option>
                              <option value="Moto">Moto</option>
                              <option value="Voiture">Voiture</option>
                              <option value="Vélo">Vélo</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Plaque d'immatriculation</label>
                          <div className="relative">
                            <i className="fa-solid fa-barcode absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input 
                              type="text" 
                              required 
                              value={vehiclePlate}
                              onChange={(e) => setVehiclePlate(e.target.value)}
                              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                              placeholder="D-12345"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">
                        {role === UserRole.PHARMACY ? 'Nom du Responsable' : 'Nom Complet'}
                      </label>
                      <div className="relative">
                        <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input 
                          type="text" 
                          required 
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                          placeholder="Ahmed Abdallah"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Téléphone</label>
                      <div className="flex">
                        <span className="inline-flex items-center px-4 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm font-medium text-slate-600">
                          +253
                        </span>
                        <input
                          type="tel"
                          required
                          value={displayedPhone}
                          onChange={handlePhoneDigitsChange}
                          className="flex-1 pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-r-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                          placeholder="77 80 00 00"
                          maxLength={11}
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1 ml-1">Format : +253 77 80 00 00 (8 chiffres, commence par 77)</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Email</label>
                      <div className="relative">
                        <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input 
                          type="email" 
                          required 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                          placeholder="votre@email.com"
                        />
                      </div>
                    </div>
                  </>
                )}

                {isLogin && (
                  <>
                    {loginMethod === 'phone' ? (
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Téléphone</label>
                        <div className="flex">
                          <span className="inline-flex items-center px-4 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm font-medium text-slate-600">
                            +253
                          </span>
                          <input
                            type="tel"
                            required
                            value={displayedPhone}
                            onChange={handlePhoneDigitsChange}
                            className="flex-1 pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-r-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                            placeholder="77 80 00 00"
                            maxLength={11}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Email</label>
                        <div className="relative">
                          <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                          <input 
                            type="email" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                            placeholder="votre@email.com"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Mot de passe</label>
                  <div className="relative">
                    <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                  {isLogin && (
                    <div className="flex justify-end mt-2">
                      <button 
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setError('');
                          setSuccessMessage('');
                        }}
                        className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors tracking-widest"
                      >
                        Mot de passe oublié ?
                      </button>
                    </div>
                  )}
                </div>

                {successMessage && (
                  <div className="bg-emerald-50 text-emerald-600 text-xs font-black p-4 rounded-xl flex items-start gap-3 border border-emerald-100 mb-4">
                    <i className="fa-solid fa-circle-check mt-0.5"></i>
                    <p>{successMessage}</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 text-red-600 text-xs font-black p-3 rounded-xl flex items-center gap-2 border border-red-100">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    {error}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-sm tracking-widest shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  ) : (
                    isLogin ? 'Se Connecter' : 'Créer un compte'
                  )}
                </button>
              </form>

              {isLogin && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-4 text-slate-400 font-black uppercase">Ou</span>
                    </div>
                  </div>
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    <i className="fa-brands fa-google text-lg"></i>
                    Se connecter avec Google
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;