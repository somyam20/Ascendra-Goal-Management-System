import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@/types';
import { setAuthFailureHandler, tokens } from '@/services/api';
import { authApi } from '@/services/endpoints';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    if (!tokens.access && !tokens.refresh) { setUser(null); return; }
    try { setUser(await authApi.me()); } catch { tokens.clear(); setUser(null); }
  }, []);

  useEffect(() => {
    setAuthFailureHandler(() => { tokens.clear(); setUser(null); });
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const pair = await authApi.login(email, password);
    tokens.set(pair);
    setUser(pair.user);
    return pair.user;
  }, []);

  const logout = useCallback(async () => {
    const rt = tokens.refresh;
    try { if (rt) await authApi.logout(rt); } catch { /* already invalid */ }
    tokens.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refreshMe }), [user, loading, login, logout, refreshMe]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
