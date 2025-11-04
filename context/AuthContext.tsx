import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';
import { useRouter } from 'next/router';

type User = { id: number; username: string; bio?: string; avatarUrl?: string; createdAt?: string } | null;

type AuthContextValue = {
  user: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (u: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Note: we no longer decode token client-side; we rely on /api/auth/me and the refresh flow

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // initialize by asking backend for the current user; interceptor will attempt refresh if needed
    (async () => {
      try {
        if (typeof window === 'undefined') return setLoading(false);
        const res = await api.get('/api/auth/me');
        setUser(res.data);
      } catch (e) {
        // ignore - not logged in
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    // listen for session-expired events emitted by the axios interceptor
    const handler = () => {
      try { localStorage.removeItem('token'); } catch (e) {}
      setUser(null);
      // avoid forcing a redirect to /login when the user is already on
      // an auth-related page (e.g. /login or /register). This prevents
      // navigation loops when unauthenticated pages call /auth/me on mount.
      const avoid = ['/login', '/register'];
      try {
        if (!avoid.includes(router.pathname)) router.push('/login');
      } catch (e) {
        // ignore navigation errors
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('session-expired', handler as any);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('session-expired', handler as any);
      }
    };
  }, [router]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      console.log('[auth-client] login attempt', { email });
      const res = await api.post('/api/auth/login', { email, password });
      const token = res.data.token;
      const refreshToken = res.data.refreshToken;
      if (token) {
        try { localStorage.setItem('token', token); } catch (e) {}
        if (refreshToken) {
          try { localStorage.setItem('refreshToken', refreshToken); } catch (e) {}
        }
        // request current user from backend (interceptor will use token)
        const r = await api.get('/api/auth/me');
        setUser(r.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // include refresh token to revoke it server-side
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
      await api.post('/api/auth/logout', { refreshToken });
    } catch (e) {
      // ignore
    }
    try { localStorage.removeItem('token'); } catch (e) {}
    try { localStorage.removeItem('refreshToken'); } catch (e) {}
    setUser(null);
    router.push('/login');
  };

  const updateUser = (u: User) => setUser(u);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
