import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, User } from "../api/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("pm_user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  function persist(token: string, user: User) {
    localStorage.setItem("pm_token", token);
    localStorage.setItem("pm_user", JSON.stringify(user));
    setUser(user);
  }

  async function login(email: string, password: string) {
    const res = await api.login(email, password);
    persist(res.token, res.user);
  }

  async function register(email: string, password: string, name: string) {
    const res = await api.register(email, password, name);
    persist(res.token, res.user);
  }

  function logout() {
    localStorage.removeItem("pm_token");
    localStorage.removeItem("pm_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
