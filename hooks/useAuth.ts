'use client';

import { useAuthSession } from '@/lib/auth/AuthSessionContext';

export function useAuth() {
  return useAuthSession();
}