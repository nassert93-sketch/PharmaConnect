
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(phone, pass);
      navigate('/');
    } catch (err: any) {
      setError("Numéro de téléphone ou mot de passe incorrect.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl border-2 border-white p-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100">
            <i className="fa-solid fa-staff-snake text-4xl"></i>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">Connexion</h1>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2 italic">Hub National PharmaConnect</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Téléphone</label>
            <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:border-blue-600 transition-all" placeholder="77 12 34 56" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Mot de Passe</label>
            <input required type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:border-blue-600 transition-all" placeholder="••••••••" />
          </div>

          {error && <p className="text-[11px] font-bold text-red-500 text-center uppercase animate-pulse">{error}</p>}

          <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-slate-900 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
            {isSubmitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-right-to-bracket"></i>}
            Se Connecter
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-slate-50 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Nouveau sur la plateforme ? 
            <Link to="/register" className="text-blue-600 ml-2 hover:underline">S'inscrire</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
