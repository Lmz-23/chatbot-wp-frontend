'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  // While loading auth state, show loading message
  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    router.replace('/login');
    return null;
  }

  // If authenticated, render children
  return <div>{children}</div>;
}