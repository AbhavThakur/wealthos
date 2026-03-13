import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

const AuthContext = createContext(null);

const isMobile =
  typeof navigator !== "undefined" &&
  /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    // Handle redirect result from mobile Google login
    getRedirectResult(auth).catch(() => {});
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  const login = async (email, password, remember = true) => {
    await setPersistence(
      auth,
      remember ? browserLocalPersistence : browserSessionPersistence,
    );
    return signInWithEmailAndPassword(auth, email, password);
  };
  const loginWithGoogle = async (remember = true) => {
    await setPersistence(
      auth,
      remember ? browserLocalPersistence : browserSessionPersistence,
    );
    if (isMobile) {
      return signInWithRedirect(auth, googleProvider);
    }
    return signInWithPopup(auth, googleProvider);
  };
  const resetPassword = (email) => sendPasswordResetEmail(auth, email);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider
      value={{ user, login, loginWithGoogle, resetPassword, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
