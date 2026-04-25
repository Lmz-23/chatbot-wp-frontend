'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import type { User } from '@/types/auth';
import {
  clearAuthSession,
  getToken as getStoredToken,
  hasActiveSessionFlag,
  markSessionActive as markStoredSessionActive,
  setToken as setStoredToken
} from './tokenStore';

type AuthSessionContextValue = {
  token: string | null;
  sessionActive: boolean;
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  setToken: (token: string) => void;
  clearSession: () => void;
  markSessionActive: () => void;
  refreshAuth: () => Promise<void>;
  logout: () => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function isValidUserProfile(response: unknown): response is User {
  if (!response || typeof response !== 'object') return false;

  const profile = response as Partial<User>;
  return typeof profile.userId === 'string' && typeof profile.email === 'string';
}

async function refreshTokenIfPossible() {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (!data?.token || typeof data.token !== 'string') return false;

    return data.token as string;
  } catch {
    return false;
  }
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getStoredToken());
  const [sessionActive, setSessionActive] = useState<boolean>(() => hasActiveSessionFlag());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    setTokenState(getStoredToken());
    setSessionActive(hasActiveSessionFlag());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initializeAuth = async () => {
      const isLoginRoute = pathname === '/login';
      const hasSession = sessionActive || hasActiveSessionFlag();
      let currentToken = token || getStoredToken();

      if (hasInitializedRef.current && !hasSession && !isLoginRoute) {
        clearAuthSession();
        setUser(null);
        setLoading(false);
        window.location.href = '/login';
        return;
      }

      if (!hasSession && isLoginRoute) {
        setUser(null);
        setLoading(false);
        hasInitializedRef.current = true;
        return;
      }

      setLoading(true);

      if (hasSession && !currentToken) {
        const refreshedToken = await refreshTokenIfPossible();
        if (refreshedToken) {
          setTokenState(refreshedToken);
          setStoredToken(refreshedToken);
          currentToken = refreshedToken;
        }
      }

      if (!hasSession || !currentToken) {
        clearAuthSession();
        setUser(null);
        setLoading(false);
        if (!isLoginRoute) {
          window.location.href = '/login';
        }
        hasInitializedRef.current = true;
        return;
      }

      try {
        const response = await apiClient('/auth/me');

        if (isValidUserProfile(response)) {
          setUser({
            userId: response.userId,
            email: response.email,
            platformRole: response.platformRole,
            businessId: response.businessId,
            businessRole: response.businessRole
          });
        } else {
          clearAuthSession();
          setUser(null);
          if (!isLoginRoute) {
            window.location.href = '/login';
          }
        }
      } catch {
        clearAuthSession();
        setUser(null);
        if (!isLoginRoute) {
          window.location.href = '/login';
        }
      } finally {
        setLoading(false);
        hasInitializedRef.current = true;
      }
    };

    initializeAuth();
  }, [pathname, sessionActive, token]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      token,
      sessionActive,
      user,
      loading,
      isAuthenticated: user !== null,
      setToken: (nextToken: string) => {
        setStoredToken(nextToken);
        setTokenState(nextToken);
      },
      clearSession: () => {
        clearAuthSession();
        setTokenState(null);
        setSessionActive(false);
      },
      markSessionActive: () => {
        markStoredSessionActive();
        setSessionActive(true);
      },
      refreshAuth: async () => {
        const refreshedToken = await refreshTokenIfPossible();
        if (!refreshedToken) return;
        setStoredToken(refreshedToken);
        setTokenState(refreshedToken);
        markStoredSessionActive();
        setSessionActive(true);
      },
      logout: () => {
        clearAuthSession();
        setTokenState(null);
        setSessionActive(false);
        setUser(null);
      }
    }),
    [loading, sessionActive, token, user]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }

  return context;
}