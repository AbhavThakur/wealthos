import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBT9tkjmv57c_N6jm8cVZvfr1D52fd6W7c",
  authDomain: "wealthos-8fb50.firebaseapp.com",
  projectId: "wealthos-8fb50",
  storageBucket: "wealthos-8fb50.firebasestorage.app",
  messagingSenderId: "901028887636",
  appId: "1:901028887636:web:beada33fec3d7682dd01c1",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
