'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
  setToken: (token: string) => void;
  clearSession: () => void;
  markSessionActive: () => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined);

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getStoredToken());
  const [sessionActive, setSessionActive] = useState<boolean>(() => hasActiveSessionFlag());

  useEffect(() => {
    setTokenState(getStoredToken());
    setSessionActive(hasActiveSessionFlag());
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      token,
      sessionActive,
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
      }
    }),
    [sessionActive, token]
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