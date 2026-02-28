// src/components/PhoneVerificationModal.tsx
import React, { useState } from 'react';
import { UserProfile } from '@/types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';

interface PhoneVerificationModalProps {
  profile: UserProfile;
  onClose: (updatedProfile: UserProfile) => void;
}

const PhoneVerificationModal: React.FC<PhoneVerificationModalProps> = ({ profile, onClose }) => {
  const [phoneDigits, setPhoneDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatDigits = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const parts = [];
    for (let i = 0; i < digits.length; i += 2) {
      parts.push(digits.slice(i, i + 2));
    }
    return parts.join(' ');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDigits(e.target.value);
    setPhoneDigits(formatted.replace(/\s/g, ''));
  };

  const displayedPhone = phoneDigits ? formatDigits(phoneDigits) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneRegex = /^77\d{6}$/;
    if (!phoneRegex.test(phoneDigits)) {
      setError('Le numéro doit commencer par 77 et contenir 8 chiffres (ex: 77 80 00 00)');
      return;
    }
    setLoading(true);
    try {
      const fullPhone = `+253${phoneDigits}`;
      await updateDoc(doc(db, 'users', profile.uid), { phone: fullPhone });
      onClose({ ...profile, phone: fullPhone });
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95">
        <div className="bg-blue-600 p-6 text-white">
          <h2 className="text-xl font-black uppercase tracking-tight">Vérification requise</h2>
          <p className="text-blue-100 text-sm mt-1">Pour finaliser votre inscription, veuillez renseigner votre numéro de téléphone.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Numéro de téléphone</label>
            <div className="flex">
              <span className="inline-flex items-center px-4 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-sm font-medium text-slate-600">
                +253
              </span>
              <input
                type="tel"
                required
                value={displayedPhone}
                onChange={handleChange}
                className="flex-1 pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-r-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                placeholder="77 80 00 00"
                maxLength={11}
                autoFocus
              />
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Format : 77 80 00 00 (8 chiffres)</p>
          </div>
          {error && <p className="text-red-500 text-xs font-black">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : 'Confirmer'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PhoneVerificationModal;
