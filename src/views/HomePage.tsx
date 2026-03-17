import React from 'react';

interface HomePageProps {
  onLogin?: () => void;
  onRegister?: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onLogin, onRegister }) => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="PharmaConnect" className="h-8 w-8 sm:h-10 sm:w-10" />
            {/* Suppression de la classe uppercase */}
            <span className="text-base sm:text-xl font-black tracking-tighter"><span style={{color:'#1a6fd4'}}>Pharma</span><span style={{color:'#4caf50'}}>Connect</span></span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onLogin}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-black uppercase tracking-wider text-[#1a6fd4] hover:text-blue-700 transition-colors"
            >
              Connexion
            </button>
            <button
              onClick={onRegister}
              className="px-3 sm:px-4 py-2 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider hover:bg-blue-700 transition-colors shadow-md"
            >
              Inscription
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#1a6fd4] to-[#4caf50] text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-12 md:py-16 lg:py-20 relative z-10">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight leading-tight mb-4">
              Vos médicaments <br className="hidden sm:block" /> en un clic
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-blue-100 mb-6 max-w-2xl">
              Localisez les pharmacies, comparez les offres et recevez vos médicaments chez vous, partout à Djibouti.
            </p>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 sm:gap-3 justify-center mb-8">
              <span className="px-3 py-1 bg-blue-500/30 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider border border-blue-400">
                ⚡ Gratuit
              </span>
              <span className="px-3 py-1 bg-blue-500/30 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider border border-blue-400">
                🔒 Sécurisé
              </span>
              <span className="px-3 py-1 bg-blue-500/30 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider border border-blue-400">
                📦 Suivi en direct
              </span>
            </div>

            {/* Boutons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
              <button
                onClick={onRegister}
                style={{color:'#1a6fd4'}} className="px-8 py-4 bg-white rounded-xl font-black uppercase text-sm tracking-wider shadow-xl hover:bg-slate-50 transition-colors w-full sm:w-auto"
              >
                Créer un compte
              </button>
              <button
                onClick={onLogin}
                className="px-8 py-4 border-2 border-white text-white rounded-xl font-black uppercase text-sm tracking-wider hover:bg-white/10 transition-colors w-full sm:w-auto"
              >
                Se connecter
              </button>
            </div>

            {/* Message d'accueil avec Djibouti */}
            <p className="mt-8 text-sm text-blue-200 italic">
              La première plateforme nationale de mise en relation patients, pharmacies et livreurs à Djibouti.
            </p>

            {/* Icône de téléphone */}
            <div className="mt-10 flex justify-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 border-2 border-white/20 inline-flex items-center gap-4">
                <i className="fa-solid fa-mobile-screen-button text-4xl text-white"></i>
                <div className="text-left">
                  <p className="text-xs text-blue-200 uppercase tracking-wider">Application mobile</p>
                  <p className="text-sm font-black">Bientôt disponible</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fonctionnalités principales */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-center mb-2">Fonctionnalités principales</h2>
          <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
            Découvrez comment <span style={{color:'#1a6fd4'}}>Pharma</span><span style={{color:'#4caf50'}}>Connect</span> simplifie la gestion de vos prescriptions
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Carte 1 */}
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-slate-100">
              <div className="w-12 h-12 bg-blue-50 text-[#1a6fd4] rounded-2xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-magnifying-glass text-xl"></i>
              </div>
              <h3 className="text-base font-black uppercase mb-2">Recherche intelligente</h3>
              <p className="text-sm text-slate-600 mb-3">
                Trouvez rapidement vos médicaments grâce à notre moteur de recherche avec IA.
              </p>
              <span className="inline-block px-2 py-1 bg-blue-50 text-[#1a6fd4] text-[10px] font-black rounded">
                🤖 TECHNOLOGIE IA
              </span>
            </div>
            {/* Carte 2 */}
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-slate-100">
              <div className="w-12 h-12 bg-green-50 text-[#4caf50] rounded-2xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-location-dot text-xl"></i>
              </div>
              <h3 className="text-base font-black uppercase mb-2">Géolocalisation</h3>
              <p className="text-sm text-slate-600 mb-3">
                Visualisez les pharmacies proches de vous avec itinéraire optimisé.
              </p>
              <span className="inline-block px-2 py-1 bg-green-50 text-[#4caf50] text-[10px] font-black rounded">
                🗺️ GPS INTÉGRÉ
              </span>
            </div>
            {/* Carte 3 */}
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-slate-100">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-clock text-xl"></i>
              </div>
              <h3 className="text-base font-black uppercase mb-2">Pharmacies de garde</h3>
              <p className="text-sm text-slate-600 mb-3">
                Accédez 24h/24 aux pharmacies de garde près de chez vous.
              </p>
              <span className="inline-block px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded">
                ⏰ ALERTES 24/7
              </span>
            </div>
            {/* Carte 4 */}
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-slate-100">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
                <i className="fa-solid fa-shield text-xl"></i>
              </div>
              <h3 className="text-base font-black uppercase mb-2">Paiement sécurisé</h3>
              <p className="text-sm text-slate-600 mb-3">
                Payez en ligne (Waafi, D-Money) ou à la livraison, en toute sécurité.
              </p>
              <span className="inline-block px-2 py-1 bg-purple-50 text-purple-600 text-[10px] font-black rounded">
                🔒 PAIEMENT SÉCURISÉ
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Avantages */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-center mb-2">Pourquoi choisir <span style={{color:'#1a6fd4'}}>Pharma</span><span style={{color:'#4caf50'}}>Connect</span> ?</h2>
          <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
            Des bénéfices concrets pour votre santé au quotidien
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-4">
              <div className="w-16 h-16 bg-blue-50 text-[#1a6fd4] rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                <i className="fa-solid fa-clock"></i>
              </div>
              <h3 className="text-sm font-black uppercase mb-2">Gain de temps</h3>
              <p className="text-xs text-slate-600">Plus besoin de faire le tour des pharmacies. Trouvez le bon médicament du premier coup.</p>
            </div>
            <div className="text-center p-4">
              <div className="w-16 h-16 bg-green-50 text-[#4caf50] rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                <i className="fa-solid fa-car"></i>
              </div>
              <h3 className="text-sm font-black uppercase mb-2">Moins de déplacements</h3>
              <p className="text-xs text-slate-600">Vérifiez la disponibilité avant de vous déplacer.</p>
            </div>
            <div className="text-center p-4">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                <i className="fa-solid fa-circle-check"></i>
              </div>
              <h3 className="text-sm font-black uppercase mb-2">Informations fiables</h3>
              <p className="text-xs text-slate-600">Stocks mis à jour en permanence par nos partenaires pharmaciens.</p>
            </div>
            <div className="text-center p-4">
              <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                <i className="fa-solid fa-face-smile"></i>
              </div>
              <h3 className="text-sm font-black uppercase mb-2">Design intuitif</h3>
              <p className="text-xs text-slate-600">Navigation facile, claire et accessible pour tous les âges.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-center mb-2">Comment ça marche ?</h2>
          <p className="text-center text-slate-600 mb-12 max-w-2xl mx-auto">
            Trois étapes simples pour recevoir vos médicaments
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 text-white rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg">
                <i className="fa-solid fa-camera"></i>
              </div>
              <h3 className="text-lg font-black uppercase mb-2">1. Scannez</h3>
              <p className="text-sm text-slate-600">Prenez en photo votre ordonnance. Notre IA l'analyse instantanément.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#4caf50] text-white rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg">
                <i className="fa-solid fa-chart-simple"></i>
              </div>
              <h3 className="text-lg font-black uppercase mb-2">2. Comparez</h3>
              <p className="text-sm text-slate-600">Recevez des devis, comparez les offres et choisissez la meilleure.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-600 text-white rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg">
                <i className="fa-solid fa-truck"></i>
              </div>
              <h3 className="text-lg font-black uppercase mb-2">3. Recevez</h3>
              <p className="text-sm text-slate-600">Un livreur prend en charge votre colis, suivez‑le en temps réel.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Appel à l'action final */}
      <section className="py-16 bg-gradient-to-br from-[#1a6fd4] to-[#4caf50] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black uppercase mb-4">Prêt à commencer ?</h2>
          <p className="text-base md:text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            Rejoignez les premiers utilisateurs de <span style={{color:'#1a6fd4'}}>Pharma</span><span style={{color:'#4caf50'}}>Connect</span> Djibouti et simplifiez la gestion de vos prescriptions.
          </p>
          <button
            onClick={onRegister}
            className="px-8 py-4 bg-white text-[#1a6fd4] rounded-xl font-black uppercase text-sm tracking-widest shadow-2xl hover:bg-slate-100 transition-colors"
          >
            Créer un compte gratuitement
          </button>
        </div>
      </section>

      {/* Footer avec mention Djibouti */}
      <footer className="bg-slate-900 text-slate-400 py-8">
        <div className="container mx-auto px-4 text-center text-xs">
          <p className="mb-2">© 2026 <span style={{color:'#1a6fd4'}}>Pharma</span><span style={{color:'#4caf50'}}>Connect</span> Djibouti – Le hub national de santé</p>
          <p>
            <a href="#" className="hover:text-white transition-colors">Mentions légales</a> • 
            <a href="#" className="hover:text-white transition-colors ml-2">Confidentialité</a> • 
            <a href="#" className="hover:text-white transition-colors ml-2">Contact</a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;