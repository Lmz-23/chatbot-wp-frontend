'use client';

import { useState, useEffect, useRef } from 'react';
import { User } from '@/types/auth';
import { apiClient } from '@/lib/api/apiClient';

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
        const token = localStorage.getItem('token');

        if (!token) {
          setUser(null);
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
          // Invalid response, clear token
          localStorage.removeItem('token');
          setUser(null);
        }
      } catch (error) {
        // Request failed (likely 401 or network error)
        // apiClient already handles 401 by removing token and redirecting
        // but we also clear it here for safety
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
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
