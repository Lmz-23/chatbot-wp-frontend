'use client';

import { usePathname } from 'next/navigation';
import { AuthSessionProvider } from '@/lib/auth/AuthSessionContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return <AuthSessionProvider key={pathname}>{children}</AuthSessionProvider>;
}