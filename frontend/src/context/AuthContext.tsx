import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setAccessToken, setSessionLostHandler } from "../lib/api";

export type Role = "admin" | "doctor" | "receptionist" | "billing" | "pharmacist" | "patient";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
  patientId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const clear = useCallback(() => {
    setUser(null);
    setAccessToken(null);
  }, []);

  // Restore a session on reload using the httpOnly refresh cookie.
  useEffect(() => {
    setSessionLostHandler(clear);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${(import.meta.env.VITE_API_URL as string) || "/api"}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setAccessToken(data.token);
            setUser(data.user);
          }
        }
      } catch {
        /* not signed in */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      setSessionLostHandler(() => undefined);
    };
  }, [clear]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: AuthUser }>("/auth/login", { email, password });
    setAccessToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    clear();
  }, [clear]);

  const refreshUser = useCallback(async () => {
    const data = await api.get<{ user: AuthUser }>("/auth/me");
    setUser({ ...data.user, permissions: data.user.permissions ?? [] });
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.role === "admin") return true;
      return user.permissions.includes(permission);
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, ready, login, logout, can, refreshUser }),
    [user, ready, login, logout, can, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
