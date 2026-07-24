import { createContext, useContext, useState, type ReactNode } from "react";
import { api, store } from "./api";
import type { PublicUser } from "./types";

interface AuthCtx {
  user: PublicUser | null;
  loginWith: (token: string, user: PublicUser) => void;
  guest: (lang: string) => Promise<void>;
  upgrade: (body: { email: string; password: string; displayName?: string }) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(store.getUser());

  const loginWith = (token: string, u: PublicUser) => {
    store.setToken(token);
    store.setUser(u);
    setUser(u);
  };

  const guest = async (lang: string) => {
    const { token, user: u } = await api.guest(lang);
    loginWith(token, u);
  };

  const upgrade = async (body: { email: string; password: string; displayName?: string }) => {
    const { token, user: u } = await api.upgrade(body);
    loginWith(token, u);
  };

  const logout = () => {
    store.clearToken();
    store.clearUser();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loginWith, guest, upgrade, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
