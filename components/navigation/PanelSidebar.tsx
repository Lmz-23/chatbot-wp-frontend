'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import {
  BarChart2,
  Megaphone,
  Menu,
  MessageSquare,
  Settings,
  UserPlus,
  Users,
  MessageSquareText
} from 'lucide-react';

type NavItem = {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
};

const STORAGE_KEY = 'replai_panel_sidebar_collapsed';

const NAV_ITEMS: NavItem[] = [
  { label: 'Conversaciones', href: '/conversations', icon: MessageSquare },
  { label: 'Leads', href: '/leads', icon: Users },
  { label: 'Usuarios', href: '/users', icon: UserPlus },
  { label: 'Configuración', href: '/settings', icon: Settings },
  { label: 'Analíticas', icon: BarChart2, comingSoon: true },
  { label: 'Campañas', icon: Megaphone, comingSoon: true }
];

type PanelSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function PanelSidebar({ collapsed, onToggle }: PanelSidebarProps) {
  const pathname = usePathname();

  const widthClass = collapsed ? 'w-[72px]' : 'w-[260px]';

  const isActive = (href?: string) => {
    if (!href) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const brand = (
    <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white text-[#185FA5]">
        <MessageSquareText className="h-5 w-5" />
      </div>
      {!collapsed ? <span className="text-[18px] font-medium leading-none text-white">Replai</span> : null}
    </div>
  );

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/10 bg-[#185FA5] text-white transition-[width] duration-200 ${widthClass}`}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          {!collapsed ? brand : <div className="flex flex-1 justify-center">{brand}</div>}
          <button
            type="button"
            onClick={onToggle}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/15 bg-white/10 text-white transition-none ${collapsed ? 'absolute left-[18px] top-[18px]' : ''}`}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-2 flex-1 px-3 pb-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              if (item.comingSoon) {
                return (
                  <li key={item.label}>
                    <div
                      className={`flex items-center gap-3 rounded-[10px] px-3 py-3 text-white/80 ${collapsed ? 'justify-center' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!collapsed ? (
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                          <span className="truncate text-[14px] font-medium">{item.label}</span>
                          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/75">
                            Próximamente
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              }

              return (
                <li key={item.label}>
                  <Link
                    href={item.href || '#'}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-[10px] px-3 py-3 text-white transition-none hover:bg-white/10 ${active ? 'bg-[#1D9E75] text-white' : 'text-white/90'} ${collapsed ? 'justify-center' : ''}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed ? <span className="truncate text-[14px] font-medium">{item.label}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}

export { STORAGE_KEY };