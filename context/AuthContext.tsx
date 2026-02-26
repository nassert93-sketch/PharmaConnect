
import React, { createContext, useContext, useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { auth, db } from '../firebase/config';
import { UserRole } from '../types';

interface UserData {
  uid: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  login: (phone: string, pass: string) => Promise<void>;
  register: (name: string, phone: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Utilisation de la méthode onAuthStateChanged sur l'instance auth (Style v8/Compat)
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Utilisation de l'API collection/doc de Firestore style v8 pour récupérer les données utilisateur
          const userDocSnap = await db.collection("users").doc(firebaseUser.uid).get();
          
          if (userDocSnap.exists) {
            setUser(userDocSnap.data() as UserData);
          } else {
            // Profil de secours si le document Firestore n'a pas encore été créé
            setUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Utilisateur',
              email: firebaseUser.email || '',
              phone: '',
              role: UserRole.PATIENT
            });
          }
        } catch (error) {
          console.error("Erreur de récupération profil:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (phone: string, pass: string) => {
    const email = `${phone.trim()}@pharmaconnect.com`;
    // Connexion via l'instance auth (Style v8/Compat)
    await auth.signInWithEmailAndPassword(email, pass);
  };

  const register = async (name: string, phone: string, pass: string) => {
    const email = `${phone.trim()}@pharmaconnect.com`;
    // Création de compte via l'instance auth (Style v8/Compat)
    const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
    const firebaseUser = userCredential.user;

    if (firebaseUser) {
      // Mise à jour du profil via l'instance utilisateur (Style v8/Compat)
      await firebaseUser.updateProfile({ displayName: name });

      const userData: UserData = {
        uid: firebaseUser.uid,
        name,
        phone: phone.trim(),
        email,
        role: UserRole.PATIENT
      };

      // Sauvegarde du profil utilisateur dans Firestore (Style v8/Compat)
      await db.collection("users").doc(firebaseUser.uid).set(userData);
      setUser(userData);
    }
  };

  const logout = async () => {
    // Déconnexion via l'instance auth (Style v8/Compat)
    await auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être dans AuthProvider");
  return context;
};
