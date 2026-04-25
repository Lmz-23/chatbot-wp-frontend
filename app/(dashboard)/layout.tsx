'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // While loading auth state, show loading message
  if (isLoading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return null;
  }

  // If authenticated, render children
  return <div>{children}</div>;
}