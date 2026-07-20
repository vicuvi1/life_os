"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

interface AuthContextValue {
  user: User | null;
  /** The user's display name, tracked separately so edits re-render reliably. */
  displayName: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setDisplayName(u?.displayName ?? null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value: AuthContextValue = {
    user,
    displayName,
    loading,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signUp: async (email, password) => {
      await createUserWithEmailAndPassword(auth, email, password);
    },
    signOut: async () => {
      await fbSignOut(auth);
    },
    updateName: async (name) => {
      if (!auth.currentUser) return;
      const trimmed = name.trim();
      await updateProfile(auth.currentUser, { displayName: trimmed });
      setDisplayName(trimmed);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
