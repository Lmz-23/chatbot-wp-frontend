'use client';

import { useState, useEffect, useRef } from 'react';
import { User } from '@/types/auth';
import { apiClient } from '@/lib/api/apiClient';
import {
  clearAuthSession,
  getToken,
  hasActiveSessionFlag,
  setToken,
} from '@/lib/auth/tokenStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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

    setToken(data.token);
    return true;
  } catch {
    return false;
  }
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Only run on client side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    const initializeAuth = async () => {
      try {
        const sessionActive = hasActiveSessionFlag();
        let token = getToken();

        if (sessionActive && !token) {
          const refreshed = await refreshTokenIfPossible();
          if (refreshed) {
            token = getToken();
          }
        }

        if (!sessionActive || !token) {
          clearAuthSession();
          setUser(null);
          redirectToLogin();
          setLoading(false);
          return;
        }

        // Token exists, fetch user data from /auth/me
        const response = await apiClient('/auth/me');

        if (response && response.ok) {
          setUser({
            userId: response.userId,
            email: response.email,
            platformRole: response.platformRole,
            businessId: response.businessId,
            businessRole: response.businessRole
          });
        } else {
          // Invalid response, clear session
          clearAuthSession();
          setUser(null);
          redirectToLogin();
        }
      } catch (error) {
        // Request failed (likely 401 or network error)
        // apiClient already handles 401 redirect; we clear session for safety.
        clearAuthSession();
        setUser(null);
        redirectToLogin();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const logout = () => {
    clearAuthSession();
    setUser(null);
    window.location.href = '/login';
  };

  return {
    user,
    loading,
    isAuthenticated: user !== null,
    logout
  };
}
