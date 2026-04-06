'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';
import { apiClient } from '@/lib/api/apiClient';

type PlatformStats = {
  active_businesses: number;
  inactive_businesses: number;
  conversations_today: number;
  conversations_this_week: number;
  leads_this_week: number;
  businesses_without_activity_last_7_days: number;
};

type AdminBusiness = {
  id: string;
  name: string;
  email: string | null;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
  users_count: number;
  conversations_count: number;
  last_activity: string | null;
};

function formatDate(value: string | null) {
  if (!value) return 'Sin actividad';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no valida';
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getInitials(text: string) {
  const safe = (text || '').trim();
  if (!safe) return 'NG';
  const parts = safe.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return safe.slice(0, 2).toUpperCase();
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone_number: '',
    owner_email: '',
    owner_password: '',
    owner_password_confirm: ''
  });

  const isPlatformAdmin = user?.platformRole === 'PLATFORM_ADMIN';

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (!authLoading && isAuthenticated && !isPlatformAdmin) {
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, isPlatformAdmin, router]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResponse, businessesResponse] = await Promise.all([
        apiClient('/api/admin/stats'),
        apiClient('/api/admin/businesses')
      ]);

      setStats((statsResponse as { stats: PlatformStats }).stats);
      setBusinesses((businessesResponse as { businesses: AdminBusiness[] }).businesses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el panel de administracion');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isPlatformAdmin) return;
    loadData();
  }, [authLoading, isPlatformAdmin]);

  const noActivityCount = stats?.businesses_without_activity_last_7_days || 0;

  const metricCards = useMemo(
    () => [
      {
        label: 'Negocios activos',
        value: String(stats?.active_businesses || 0),
        valueClass: 'text-[#185FA5]'
      },
      {
        label: 'Conversaciones hoy',
        value: String(stats?.conversations_today || 0),
        valueClass: 'text-[#185FA5]'
      },
      {
        label: 'Leads esta semana',
        value: String(stats?.leads_this_week || 0),
        valueClass: 'text-[#1D9E75]'
      },
      {
        label: 'Negocios sin actividad (7 dias)',
        value: String(noActivityCount),
        valueClass: noActivityCount > 0 ? 'text-[#B42318]' : 'text-[#6F7782]'
      }
    ],
    [stats, noActivityCount]
  );

  const handleStatusToggle = async (business: AdminBusiness) => {
    setTogglingId(business.id);
    try {
      const response = await apiClient(`/api/admin/businesses/${business.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !business.is_active })
      });

      const updated = (response as { business: AdminBusiness }).business;
      setBusinesses((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          active_businesses: prev.active_businesses + (updated.is_active ? 1 : -1),
          inactive_businesses: prev.inactive_businesses + (updated.is_active ? -1 : 1)
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del negocio');
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreateBusiness = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);

    if (!createForm.name.trim()) {
      setCreateError('El nombre del negocio es obligatorio');
      return;
    }

    if (!createForm.email.trim()) {
      setCreateError('El email del negocio es obligatorio');
      return;
    }

    if (!createForm.owner_email.trim()) {
      setCreateError('El email del propietario es obligatorio');
      return;
    }

    if (createForm.owner_password.length < 8) {
      setCreateError('La contrasena del propietario debe tener minimo 8 caracteres');
      return;
    }

    if (createForm.owner_password !== createForm.owner_password_confirm) {
      setCreateError('Las contrasenas del propietario no coinciden');
      return;
    }

    setCreateSaving(true);
    try {
      await apiClient('/api/admin/businesses', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          phone_number: createForm.phone_number.trim() || null,
          owner_email: createForm.owner_email.trim(),
          owner_password: createForm.owner_password
        })
      });

      setCreateForm({
        name: '',
        email: '',
        phone_number: '',
        owner_email: '',
        owner_password: '',
        owner_password_confirm: ''
      });
      setShowCreateModal(false);
      await loadData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No se pudo crear el negocio');
    } finally {
      setCreateSaving(false);
    }
  };

  if (authLoading || loading || !isPlatformAdmin) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-[#F6F7F9] text-[#1B1D21]" style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header className="fixed inset-x-0 top-0 z-20 bg-white" style={{ borderBottom: '0.5px solid #E3E6EB' }}>
        <div className="mx-auto flex h-[68px] w-full max-w-[1300px] items-center justify-between px-4 md:px-8">
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

          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium" style={{ backgroundColor: '#E6F1FB', color: '#0C447C' }}>
              Administrador de plataforma
            </span>
            <button
              type="button"
              onClick={logout}
              className="h-8 rounded-[8px] border border-[#D7DCE3] bg-white px-4 text-[12px] text-[#3E434B] font-medium"
              style={{ borderWidth: '0.5px' }}
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1300px] px-4 pb-10 pt-[92px] md:px-8">
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => (
            <article key={card.label} className="rounded-[12px] border border-[#D3D9E1] bg-white p-4" style={{ borderWidth: '0.5px' }}>
              <p className="text-[12px] text-[#6F7782] font-normal">{card.label}</p>
              <p className={`mt-2 text-[26px] leading-none font-medium ${card.valueClass}`}>{card.value}</p>
            </article>
          ))}
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] text-[#1B1D21] font-medium">Negocios registrados</h2>
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setShowCreateModal(true);
              }}
              className="h-[34px] rounded-[8px] bg-[#185FA5] px-4 text-[13px] text-white font-medium"
            >
              + Nuevo negocio
            </button>
          </div>

          <div className="space-y-3">
            {businesses.map((business) => (
              <article key={business.id} className="rounded-[12px] border border-[#D3D9E1] bg-white p-4" style={{ borderWidth: '0.5px' }}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6F1FB] text-[12px] text-[#185FA5] font-medium">
                      {getInitials(business.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] text-[#1B1D21] font-medium">{business.name}</p>
                      <p className="mt-1 truncate text-[12px] text-[#6F7782] font-normal">
                        {business.email || 'Sin email'} · {business.phone_number || 'Sin telefono'}
                      </p>
                      <p className="mt-1 text-[11px] text-[#9AA2AE] font-normal">
                        Creado: {formatDate(business.created_at)} · Usuarios: {business.users_count} · Conversaciones: {business.conversations_count}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex rounded-full px-3 py-1 text-[11px] font-medium"
                      style={
                        business.is_active
                          ? { backgroundColor: '#EAF3DE', color: '#27500A' }
                          : { backgroundColor: '#FCEBEB', color: '#791F1F' }
                      }
                    >
                      {business.is_active ? 'Activo' : 'Inactivo'}
                    </span>

                    <button
                      type="button"
                      disabled={togglingId === business.id}
                      onClick={() => handleStatusToggle(business)}
                      className={`relative h-6 w-11 rounded-full border transition-colors ${business.is_active ? 'bg-[#185FA5]' : 'bg-[#E4E8EE]'}`}
                      style={{ borderWidth: '0.5px', borderColor: business.is_active ? '#185FA5' : '#C8CFDA' }}
                      aria-label={business.is_active ? 'Desactivar negocio' : 'Activar negocio'}
                    >
                      <span
                        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white transition-all ${business.is_active ? 'right-1' : 'left-1'}`}
                      />
                    </button>

                    <Link
                      href={`/admin/businesses/${business.id}`}
                      className="inline-flex h-[34px] items-center rounded-[8px] border border-[#185FA5] px-3 text-[13px] text-[#185FA5] font-medium"
                      style={{ borderWidth: '0.5px' }}
                    >
                      Gestionar
                    </Link>
                  </div>
                </div>
              </article>
            ))}

            {businesses.length === 0 && (
              <article className="rounded-[12px] border border-[#D3D9E1] bg-white p-6 text-center" style={{ borderWidth: '0.5px' }}>
                <p className="text-[13px] text-[#6F7782] font-normal">No hay negocios registrados todavia.</p>
              </article>
            )}
          </div>

          {error && <p className="mt-3 text-[12px] text-[#B42318] font-normal">{error}</p>}
        </section>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.45)] p-4">
          <div className="w-full max-w-[460px] rounded-[12px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
            <h3 className="text-[14px] text-[#1B1D21] font-medium">Nuevo negocio</h3>

            <form onSubmit={handleCreateBusiness} className="mt-4 space-y-3">
              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Nombre del negocio</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-[36px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                  style={{ borderWidth: '0.5px' }}
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Email del negocio</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="h-[36px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                  style={{ borderWidth: '0.5px' }}
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Telefono</label>
                <input
                  type="text"
                  value={createForm.phone_number}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                  className="h-[36px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                  style={{ borderWidth: '0.5px' }}
                />
              </div>

              <div style={{ borderTop: '0.5px solid #D3D9E1', marginTop: '4px', paddingTop: '10px' }}>
                <p className="text-[12px] text-[#6F7782] font-medium">Cuenta del propietario</p>
              </div>

              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Email del owner</label>
                <input
                  type="email"
                  value={createForm.owner_email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, owner_email: e.target.value }))}
                  className="h-[36px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                  style={{ borderWidth: '0.5px' }}
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Contrasena del owner</label>
                <input
                  type="password"
                  value={createForm.owner_password}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, owner_password: e.target.value }))}
                  className="h-[36px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                  style={{ borderWidth: '0.5px' }}
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Confirmar contrasena</label>
                <input
                  type="password"
                  value={createForm.owner_password_confirm}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, owner_password_confirm: e.target.value }))}
                  className="h-[36px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                  style={{ borderWidth: '0.5px' }}
                />
              </div>

              {createError && <p className="text-[12px] text-[#B42318] font-normal">{createError}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-[34px] rounded-[8px] border border-[#D3D9E1] bg-white px-4 text-[13px] text-[#3E434B] font-medium"
                  style={{ borderWidth: '0.5px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="h-[34px] rounded-[8px] bg-[#185FA5] px-4 text-[13px] text-white font-medium disabled:opacity-60"
                >
                  {createSaving ? 'Creando...' : 'Crear negocio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
