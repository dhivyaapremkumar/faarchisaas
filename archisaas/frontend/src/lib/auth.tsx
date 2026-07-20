import { createContext, useContext, useState, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { api } from "./api";

export type Role = "owner" | "architect_admin" | "architect_staff" | "vendor" | "client" | "onboarding";

interface TokenPayload {
  sub: string;
  org_id: string;
  role: Role;
  exp: number;
}

interface AuthState {
  userId: string | null;
  orgId: string | null;
  role: Role | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function decodeExisting(): Omit<AuthState, "login" | "logout"> {
  const token = localStorage.getItem("access_token");
  if (!token) return { userId: null, orgId: null, role: null, isAuthenticated: false };
  try {
    const payload = jwtDecode<TokenPayload>(token);
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem("access_token");
      return { userId: null, orgId: null, role: null, isAuthenticated: false };
    }
    return { userId: payload.sub, orgId: payload.org_id, role: payload.role, isAuthenticated: true };
  } catch {
    return { userId: null, orgId: null, role: null, isAuthenticated: false };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(decodeExisting());

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("access_token", data.access_token);
    setState(decodeExisting());
  }

  function logout() {
    localStorage.removeItem("access_token");
    setState({ userId: null, orgId: null, role: null, isAuthenticated: false });
  }

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
