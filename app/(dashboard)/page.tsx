'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';

type Tool = {
  title: string;
  description: string;
  href: string;
  icon: 'conversations' | 'leads' | 'users' | 'settings';
  iconBg: string;
  iconColor: string;
};

const baseTools: Tool[] = [
  {
    title: 'Conversaciones',
    description: 'Responde mensajes, gestiona chats activos y atiende clientes en tiempo real.',
    href: '/conversations',
    icon: 'conversations',
    iconBg: '#EAF3FF',
    iconColor: '#185FA5'
  },
  {
    title: 'Leads',
    description: 'Revisa prospectos capturados, actualiza estados y da seguimiento comercial.',
    href: '/leads',
    icon: 'leads',
    iconBg: '#E8F7F3',
    iconColor: '#117A65'
  }
];

const ownerTools: Tool[] = [
  {
    title: 'Usuarios',
    description: 'Administra agentes, asigna roles y controla el acceso al panel.',
    href: '/users',
    icon: 'users',
    iconBg: '#FFF5E6',
    iconColor: '#9A6700'
  },
  {
    title: 'Configuracion',
    description: 'Ajusta el bot, reglas de respuesta automatica y datos del negocio.',
    href: '/settings/bot',
    icon: 'settings',
    iconBg: '#F1F3F5',
    iconColor: '#6B7280'
  }
];

function getRoleLabel(platformRole?: string, businessRole?: string | null) {
  if (businessRole === 'OWNER') return 'Administrador';
  if (businessRole === 'AGENT') return 'Agente';
  if (platformRole === 'PLATFORM_ADMIN') return 'Administrador';
  return 'Usuario';
}

function ToolIcon({ icon, color }: { icon: Tool['icon']; color: string }) {
  if (icon === 'conversations') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="4" y="5" width="16" height="12" rx="2" stroke={color} strokeWidth="1.8" />
        <path d="M8 9H16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 13H13" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === 'leads') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="9" cy="9" r="3" stroke={color} strokeWidth="1.8" />
        <path d="M4.5 18C5.2 15.7 7 14.5 9 14.5C11 14.5 12.8 15.7 13.5 18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="16.5" cy="8" r="2" stroke={color} strokeWidth="1.6" />
        <path d="M14.8 12.8C15.4 12.3 16.1 12 16.9 12C18.2 12 19.3 12.8 19.7 14" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === 'users') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="8" cy="9" r="3" stroke={color} strokeWidth="1.8" />
        <path d="M3.5 18C4.2 15.7 6 14.5 8 14.5C10 14.5 11.8 15.7 12.5 18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M16.5 7.5V14.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M13 11H20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" />
      <path d="M12 4.5V6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 17.5V19.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.5 12H6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.5 12H19.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.9 6.9L8.3 8.3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.7 15.7L17.1 17.1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.1 6.9L15.7 8.3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.3 15.7L6.9 17.1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const isPlatformAdmin = user?.platformRole === 'PLATFORM_ADMIN';
  const isOwner = user?.businessRole === 'OWNER';
  const isAgent = user?.businessRole === 'AGENT';

  useEffect(() => {
    if (!loading && isPlatformAdmin) {
      router.replace('/admin');
    }
  }, [loading, isPlatformAdmin, router]);

  if (loading || isPlatformAdmin) {
    return <div className="p-6">Loading...</div>;
  }

  const roleLabel = getRoleLabel(user?.platformRole, user?.businessRole);
  const tools: Tool[] = isOwner ? [...baseTools, ...ownerTools] : baseTools;

  if (!isOwner && !isAgent) {
    console.warn('Unrecognized role in dashboard hub', {
      platformRole: user?.platformRole,
      businessRole: user?.businessRole
    });
  }

  return (
    <main className="min-h-screen bg-[#F6F7F9]" style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header className="fixed inset-x-0 top-0 z-10 bg-white" style={{ borderBottom: '0.5px solid #E3E6EB' }}>
        <div className="mx-auto flex h-[68px] w-full max-w-[1200px] items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-[#185FA5]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="4" y="5" width="16" height="12" rx="2" stroke="white" strokeWidth="1.8" />
                <path d="M8 9H16" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8 13H13" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[16px] leading-none text-[#1B1D21] font-medium">Replai</span>
          </div>

          <div className="flex items-center gap-5">
            <span className="text-[12px] leading-none text-[#7A828E] font-normal">Rol: {roleLabel}</span>
            <button
              type="button"
              onClick={logout}
              className="h-8 rounded-[8px] border border-[#D7DCE3] bg-transparent px-4 text-[12px] leading-none text-[#3E434B] font-normal"
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-8 pb-10 pt-[108px]">
        <section>
          <h1 className="text-[20px] leading-[1.2] text-[#1B1D21] font-medium">Que quieres gestionar hoy?</h1>
          <p className="mt-2 text-[13px] leading-[1.4] text-[#7A828E] font-normal">Selecciona una herramienta para continuar</p>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group relative rounded-[12px] border border-[#DEE3EA] bg-white p-6 transition-colors hover:border-[#185FA5] focus:outline-none"
              style={{ borderWidth: '0.5px' }}
            >
              <span className="absolute right-6 top-6 text-[18px] leading-none text-[#9AA2AE] font-normal">→</span>

              <div
                className="mb-6 flex h-10 w-10 items-center justify-center rounded-[10px]"
                style={{ backgroundColor: tool.iconBg }}
              >
                <ToolIcon icon={tool.icon} color={tool.iconColor} />
              </div>

              <h2 className="text-[15px] leading-[1.2] text-[#1B1D21] font-medium">{tool.title}</h2>
              <p className="mt-3 line-clamp-2 max-w-[420px] text-[12px] leading-[1.5] text-[#7A828E] font-normal">
                {tool.description}
              </p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
