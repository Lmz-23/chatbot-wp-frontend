"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks';
import { PanelSidebar, STORAGE_KEY } from '@/components/navigation/PanelSidebar';

function getRoleLabel(platformRole?: string, businessRole?: string | null) {
  if (platformRole === 'PLATFORM_ADMIN') return 'Administrador de plataforma';
  if (businessRole === 'OWNER') return 'Propietario';
  if (businessRole === 'AGENT') return 'Agente';
  return 'Usuario';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isLoading, isAuthenticated, user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setCollapsed(stored === '1');
      }
    } catch {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Ignore storage failures.
    }
  }, [collapsed]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    if (user?.platformRole === 'PLATFORM_ADMIN' && typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin')) {
      router.replace('/admin');
    }
  }, [isAuthenticated, isLoading, router, user?.platformRole]);

  // While loading auth state, show loading message
  if (isLoading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return null;
  }

  const roleLabel = getRoleLabel(user?.platformRole, user?.businessRole);
  const contentOffsetClass = collapsed ? 'ml-[72px]' : 'ml-[260px]';

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#1B1D21]">
      <PanelSidebar collapsed={collapsed} onToggle={() => setCollapsed((current) => !current)} />

      <div className={`min-h-screen transition-[margin-left] duration-200 ${contentOffsetClass}`}>
        <header className="sticky top-0 z-30 border-b-[0.5px] border-[#D5DFEA] bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-end gap-4 px-4 sm:px-6 lg:px-8">
            <span className="text-[12px] font-normal text-[#7A828E]">Rol: {roleLabel}</span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex h-9 items-center gap-2 rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-4 text-[12px] font-medium text-[#3E434B] transition-none hover:bg-[#F8F9FB]"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </header>

        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
      </div>
    </div>
  );
}