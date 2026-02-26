import React from 'react';
import { UserRole } from '@/types';

interface PortalProps {
  onSelectApp: (role: UserRole) => void;
}

const Portal: React.FC<PortalProps> = ({ onSelectApp }) => {
  const apps = [
    {
      role: UserRole.PATIENT,
      title: 'Espace Patient',
      description: 'Commandez vos médicaments et suivez vos ordonnances en temps réel.',
      icon: 'fa-user-injured',
      color: 'bg-blue-600',
      shadow: 'shadow-blue-200'
    },
    {
      role: UserRole.PHARMACY,
      title: 'Espace Pharmacie',
      description: 'Gérez vos commandes, envoyez des devis et suivez votre stock.',
      icon: 'fa-mortar-pestle',
      color: 'bg-emerald-600',
      shadow: 'shadow-emerald-200'
    },
    {
      role: UserRole.DRIVER,
      title: 'Espace Livreur',
      description: 'Recevez des missions de livraison et optimisez vos trajets.',
      icon: 'fa-motorcycle',
      color: 'bg-amber-600',
      shadow: 'shadow-amber-200'
    },
    {
      role: UserRole.ADMIN,
      title: 'Espace Superviseur',
      description: 'Administration du hub, validation des comptes et statistiques.',
      icon: 'fa-tower-observation',
      color: 'bg-slate-800',
      shadow: 'shadow-slate-200'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="text-center mb-12">
        <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100">
          <i className="fa-solid fa-staff-snake text-4xl"></i>
        </div>
        <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">PharmaConnect Hub</h1>
        <p className="text-slate-500 font-bold uppercase text-xs tracking-[0.3em] mt-2 italic">Choisissez votre application</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {apps.map((app) => (
          <button
            key={app.role}
            onClick={() => onSelectApp(app.role)}
            className="group bg-white p-8 rounded-[32px] border-2 border-slate-100 shadow-xl hover:border-blue-600 transition-all text-left flex items-start gap-6 active:scale-[0.98]"
          >
            <div className={`w-16 h-16 ${app.color} text-white rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-lg ${app.shadow} group-hover:scale-110 transition-transform`}>
              <i className={`fa-solid ${app.icon}`}></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">{app.title}</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">{app.description}</p>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-12 text-[10px] font-black text-slate-400 uppercase tracking-widest">© 2026 PharmaConnect National Medical Hub</p>
    </div>
  );
};

export default Portal;