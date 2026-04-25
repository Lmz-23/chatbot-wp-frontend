'use client';

import { useAuthContext } from '@/lib/auth/AuthContext';

export function useAuth() {
  return useAuthContext();
}