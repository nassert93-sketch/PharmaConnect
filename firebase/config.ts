
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

// Configuration Firebase (clés publiques)
const firebaseConfig = {
  apiKey: "AIzaSyCjQfPLdQdn1QFEEA7oc5BBsDWLMHvMQus",
  authDomain: "pharmaconnect-31315.firebaseapp.com",
  projectId: "pharmaconnect-31315",
  storageBucket: "pharmaconnect-31315.firebasestorage.app",
  messagingSenderId: "373830737323",
  appId: "1:373830737323:web:e80aa16a99e1a3667fc6ee",
  measurementId: "G-MKKY0PCHG5"
};

// Initialisation de Firebase en mode compatibilité car les exports nommés v9 (modular) ne sont pas détectés dans cet environnement
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

// Exportation des instances de service au format v8 (compatibilité)
export const auth = firebase.auth();
export const db = firebase.firestore();

export default app;
