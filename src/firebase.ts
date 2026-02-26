import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCjQfPLdQdn1QFEEA7oc5BBsDWLMHvMQus",
  authDomain: "pharmaconnect-31315.firebaseapp.com",
  projectId: "pharmaconnect-31315",
  storageBucket: "pharmaconnect-31315.firebasestorage.app",
  messagingSenderId: "373830737323",
  appId: "1:373830737323:web:e80aa16a99e1a3667fc6ee",
  measurementId: "G-MKKY0PCHG5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
