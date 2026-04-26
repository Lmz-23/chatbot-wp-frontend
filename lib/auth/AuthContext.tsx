'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@/types/auth';

const SESSION_FLAG_KEY = 'replai_session_active';
const ACCESS_TOKEN_KEY = 'replai_access_token';
const COMPILED_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let authToken: string | null = null;

type AuthContextValue = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function resolveApiUrl() {
  if (typeof window !== 'undefined') {
    const runtimeHost = window.location.hostname;
    const isLocalHost = runtimeHost === 'localhost' || runtimeHost === '127.0.0.1';

    if (isLocalHost && COMPILED_API_URL === 'http://localhost:3001') {
      return 'http://localhost:3000';
    }

    try {
      const compiled = new URL(COMPILED_API_URL);
      const apiHostIsLocal = compiled.hostname === 'localhost' || compiled.hostname === '127.0.0.1';

      if (!isLocalHost && apiHostIsLocal) {
        return `${compiled.protocol}//${runtimeHost}:${compiled.port || '3000'}`;
      }
    } catch {
      // Keep compiled URL if it is not a valid absolute URL.
    }
  }

  return COMPILED_API_URL;
}

function needsNgrokBypass(apiUrl: string) {
  return apiUrl.includes('ngrok-free.dev') || apiUrl.includes('ngrok.app');
}

function setSessionFlag(active: boolean) {
  if (typeof window === 'undefined') return;

  if (active) {
    sessionStorage.setItem(SESSION_FLAG_KEY, '1');
    return;
  }

  sessionStorage.removeItem(SESSION_FLAG_KEY);
}

function hasSessionFlag() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SESSION_FLAG_KEY) === '1';
}

function getStoredAccessToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

function setStoredAccessToken(token) {
  if (typeof window === 'undefined') return;

  if (token) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    return;
  }

  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

function isValidUserProfile(response: unknown): response is User {
  if (!response || typeof response !== 'object') return false;

  const profile = response as Partial<User>;
  return typeof profile.userId === 'string' && typeof profile.email === 'string';
}

async function fetchJson(endpoint: string, options: RequestInit = {}, token?: string | null) {
  const apiUrl = resolveApiUrl();
  const url = `${apiUrl}${endpoint}`;
  const includeNgrokBypass = needsNgrokBypass(apiUrl);
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(includeNgrokBypass ? { 'ngrok-skip-browser-warning': 'true' } : {}),
      ...options.headers,
    },
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json() : null;

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}

async function tryRefreshToken() {
  const result = await fetchJson('/auth/refresh', { method: 'POST' });
  if (!result.ok || !result.data || typeof result.data.token !== 'string') {
    return null;
  }

  return result.data.token as string;
}

export function getAuthToken() {
  return authToken;
}

export function clearAuthArtifacts() {
  authToken = null;
  setSessionFlag(false);
  setStoredAccessToken(null);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredAccessToken());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(token);

  useEffect(() => {
    authToken = token;
    tokenRef.current = token;
    setStoredAccessToken(token);
  }, [token]);

  const clearAll = useCallback(() => {
    clearAuthArtifacts();
    setToken(null);
    setUser(null);
  }, []);

  const restoreSession = useCallback(async () => {
    setIsLoading(true);

    if (!hasSessionFlag()) {
      clearAll();
      setIsLoading(false);
      return;
    }

    let nextToken = tokenRef.current;

    if (!nextToken) {
      nextToken = await tryRefreshToken();
    }

    if (!nextToken) {
      clearAll();
      setIsLoading(false);
      return;
    }

    const profileResult = await fetchJson('/auth/me', { method: 'GET' }, nextToken);
    if (!profileResult.ok || !isValidUserProfile(profileResult.data)) {
      clearAll();
      setIsLoading(false);
      return;
    }

    setToken(nextToken);
    setSessionFlag(true);
    setUser(profileResult.data);
    setIsLoading(false);
  }, [clearAll]);

  useEffect(() => {
    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const loginResult = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!loginResult.ok || !loginResult.data || typeof loginResult.data.token !== 'string') {
      const message =
        loginResult.data && typeof loginResult.data.message === 'string'
          ? loginResult.data.message
          : 'No se pudo iniciar sesión';
      throw new Error(message);
    }

    const nextToken = loginResult.data.token as string;
    const profileResult = await fetchJson('/auth/me', { method: 'GET' }, nextToken);

    if (!profileResult.ok || !isValidUserProfile(profileResult.data)) {
      throw new Error('No se pudo obtener el perfil de usuario');
    }

    setToken(nextToken);
    setSessionFlag(true);
    setUser(profileResult.data);
    setIsLoading(false);

    return profileResult.data;
  }, []);

  const logout = useCallback(() => {
    clearAll();
    setIsLoading(false);
  }, [clearAll]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isLoading,
      loading: isLoading,
      isAuthenticated: user !== null,
      login,
      logout,
    }),
    [isLoading, login, logout, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }

  return context;
}