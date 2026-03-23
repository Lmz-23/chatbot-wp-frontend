'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Tool = {
  title: string;
  description: string;
  href: string;
};

const baseTools: Tool[] = [
  {
    title: 'Conversations',
    description: 'Gestiona chats activos y responde mensajes.',
    href: '/conversations'
  },
  {
    title: 'Leads',
    description: 'Revisa y administra los prospectos capturados.',
    href: '/leads'
  }
];

const ownerTools: Tool[] = [
  {
    title: 'Users',
    description: 'Administra usuarios y permisos del negocio.',
    href: '/users'
  },
  {
    title: 'Settings',
    description: 'Configura reglas y ajustes del sistema.',
    href: '/settings'
  }
];

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const isPlatformAdmin = user?.platformRole === 'PLATFORM_ADMIN';
  const isOwner = user?.businessRole === 'OWNER';
  const isAgent = user?.businessRole === 'AGENT';

  const roleLabel = user?.businessRole || user?.platformRole || 'UNKNOWN_ROLE';

  let tools: Tool[] = baseTools;

  if (isPlatformAdmin || isOwner) {
    tools = [...baseTools, ...ownerTools];
  } else if (isAgent) {
    tools = baseTools;
  } else {
    console.warn('Unrecognized role in dashboard hub', {
      platformRole: user?.platformRole,
      businessRole: user?.businessRole
    });
    tools = baseTools;
  }

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-5xl flex-col p-4 md:p-6">
      <header className="mb-4 rounded-2xl border bg-muted/30 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Navigation Hub</h1>
            <p className="text-sm text-muted-foreground md:text-base">
              Elige una herramienta para continuar.
            </p>
            <p className="mt-2 text-sm">Role: {roleLabel}</p>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card
              size="sm"
              className="h-full rounded-2xl border-2 border-border/70 bg-background shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
            >
              <CardHeader className="space-y-2 p-4 md:p-5">
                <div className="inline-flex w-fit rounded-full border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  Tool
                </div>
                <CardTitle className="text-lg font-semibold tracking-tight md:text-xl">
                  {tool.title}
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                  {tool.description}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  );
}