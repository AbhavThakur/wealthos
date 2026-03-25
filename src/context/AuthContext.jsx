import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from "firebase/auth";
import { auth } from "../firebase";

const AuthContext = createContext(null);

// Lightweight fake user object for guest demo mode
const DEMO_USER = {
  uid: "__demo__",
  email: "demo@wealthos.app",
  displayName: "Demo User",
  isDemo: true,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  const login = async (email, password, remember = true) => {
    await setPersistence(
      auth,
      remember ? browserLocalPersistence : browserSessionPersistence,
    );
    return signInWithEmailAndPassword(auth, email, password);
  };
  const signup = async (email, password) => {
    await setPersistence(auth, browserLocalPersistence);
    return createUserWithEmailAndPassword(auth, email, password);
  };
  const loginAsDemo = () => setUser(DEMO_USER);
  const resetPassword = (email) => sendPasswordResetEmail(auth, email);
  const logout = () => {
    if (user?.isDemo) {
      setUser(null);
      return;
    }
    return signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        loginAsDemo,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
