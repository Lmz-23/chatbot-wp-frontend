'use client';

import { AuthSessionProvider } from '@/lib/auth/AuthSessionContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthSessionProvider>{children}</AuthSessionProvider>;
}