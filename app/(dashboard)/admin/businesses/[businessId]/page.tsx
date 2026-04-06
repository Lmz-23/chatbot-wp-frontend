'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';
import { apiClient } from '@/lib/api/apiClient';

type BusinessUser = {
  id: string;
  email: string;
  platform_role: string;
  business_role: 'OWNER' | 'AGENT';
  is_active: boolean;
  created_at: string;
};

type BusinessDetail = {
  business: {
    id: string;
    name: string;
    phone_number: string | null;
    is_active: boolean;
    created_at: string;
  };
  users: BusinessUser[];
  bot_settings: {
    welcome_message: string;
  } | null;
  bot_flow: {
    nodes: Array<{ id: string; message: string }>;
  } | null;
  whatsapp_account: {
    phone_number_id: string;
    phone_number: string | null;
  } | null;
};

function getInitials(email: string) {
  const prefix = (email || '').split('@')[0] || '';
  const clean = prefix.replace(/[^a-zA-Z0-9]/g, ' ').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (clean.slice(0, 2) || 'US').toUpperCase();
}

function roleBadgeClass(role: 'OWNER' | 'AGENT') {
  if (role === 'OWNER') return 'bg-[#FAEEDA] text-[#633806]';
  return 'bg-[#EAF3DE] text-[#27500A]';
}

function statusBadgeClass(isActive: boolean) {
  return isActive ? 'bg-[#EAF3DE] text-[#27500A]' : 'bg-[#FCEBEB] text-[#791F1F]';
}

function firstMessage(nodes: Array<{ id: string; message: string }> | undefined) {
  const first = nodes && nodes.length > 0 ? nodes[0].message : '';
  if (!first) return 'Sin mensaje inicial';
  return first.length > 80 ? `${first.slice(0, 80)}...` : first;
}

export default function AdminBusinessDetailPage() {
  const params = useParams<{ businessId: string }>();
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [detail, setDetail] = useState<BusinessDetail | null>(null);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createConfirmPassword, setCreateConfirmPassword] = useState('');
  const [createRole, setCreateRole] = useState<'OWNER' | 'AGENT'>('AGENT');
  const [createUserSaving, setCreateUserSaving] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  const businessId = String(params?.businessId || '');
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

  const loadBusiness = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient(`/api/admin/businesses/${businessId}`);
      const payload = response as { data: BusinessDetail };
      setDetail(payload.data);
      setName(payload.data.business.name || '');
      setPhoneNumber(payload.data.business.phone_number || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el negocio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!businessId || authLoading || !isPlatformAdmin) return;
    loadBusiness();
  }, [businessId, authLoading, isPlatformAdmin]);

  const nodesCount = useMemo(() => detail?.bot_flow?.nodes?.length || 0, [detail]);

  const handleSaveBusiness = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!name.trim()) {
      setError('El nombre del negocio es obligatorio');
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient(`/api/admin/businesses/${businessId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          phone_number: phoneNumber.trim() || null
        })
      });

      const updatedBusiness = (response as { business: BusinessDetail['business'] }).business;
      setDetail((prev) => (prev ? { ...prev, business: updatedBusiness } : prev));
      setNotice('Datos del negocio actualizados');
      setTimeout(() => setNotice(null), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el negocio');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserStatus = async (target: BusinessUser) => {
    setTogglingUserId(target.id);
    try {
      const response = await apiClient(`/api/admin/businesses/${businessId}/users/${target.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !target.is_active })
      });

      const payload = response as { user: BusinessUser };
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: prev.users.map((userItem) => (userItem.id === target.id ? { ...userItem, ...payload.user } : userItem))
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el usuario');
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    setCreateUserError(null);

    if (!createEmail.trim()) {
      setCreateUserError('El correo es obligatorio');
      return;
    }

    if (createPassword.length < 8) {
      setCreateUserError('La contrasena debe tener minimo 8 caracteres');
      return;
    }

    if (createPassword !== createConfirmPassword) {
      setCreateUserError('Las contrasenas no coinciden');
      return;
    }

    setCreateUserSaving(true);
    try {
      const response = await apiClient(`/api/admin/businesses/${businessId}/users`, {
        method: 'POST',
        body: JSON.stringify({
          email: createEmail.trim(),
          password: createPassword,
          role: createRole
        })
      });

      const payload = response as { user: BusinessUser };
      setDetail((prev) => {
        if (!prev) return prev;
        return { ...prev, users: [payload.user, ...prev.users] };
      });

      setCreateEmail('');
      setCreatePassword('');
      setCreateConfirmPassword('');
      setCreateRole('AGENT');
      setShowCreateUserModal(false);
    } catch (err) {
      setCreateUserError(err instanceof Error ? err.message : 'No se pudo crear el usuario');
    } finally {
      setCreateUserSaving(false);
    }
  };

  if (authLoading || loading || !isPlatformAdmin) {
    return <div className="p-6">Loading...</div>;
  }

  if (!detail) {
    return <div className="p-6 text-[13px] text-[#B42318]">No se pudo cargar el negocio.</div>;
  }

  return (
    <main className="min-h-screen bg-[#F6F7F9] text-[#1B1D21]" style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="mx-auto max-w-[1100px] px-4 pb-8 pt-8 md:px-8">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-[12px] text-[#185FA5] font-medium">
              ← Negocios
            </Link>
            <h1 className="mt-2 text-[18px] text-[#1B1D21] font-medium">{detail.business.name}</h1>
          </div>
        </header>

        <div className="space-y-4">
          <article className="rounded-[12px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
            <h2 className="text-[13px] text-[#6F7782] font-medium">Datos del negocio</h2>

            <form onSubmit={handleSaveBusiness} className="mt-4 space-y-3">
              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-[34px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                  style={{ borderWidth: '0.5px' }}
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Telefono</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="h-[34px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                  style={{ borderWidth: '0.5px' }}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-[34px] rounded-[8px] bg-[#185FA5] px-4 text-[13px] text-white font-medium disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </article>

          <article className="rounded-[12px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[13px] text-[#6F7782] font-medium">Usuarios del negocio</h2>
              <button
                type="button"
                onClick={() => {
                  setCreateUserError(null);
                  setShowCreateUserModal(true);
                }}
                className="h-[32px] rounded-[8px] border border-[#D3D9E1] bg-white px-3 text-[12px] text-[#3E434B] font-medium"
                style={{ borderWidth: '0.5px' }}
              >
                + Agregar usuario
              </button>
            </div>

            <div className="overflow-hidden rounded-[8px] border border-[#D3D9E1]" style={{ borderWidth: '0.5px' }}>
              {detail.users.map((userItem, index) => (
                <div
                  key={userItem.id}
                  className="flex items-center justify-between gap-3 bg-white px-3 py-3"
                  style={{ borderBottom: index === detail.users.length - 1 ? 'none' : '0.5px solid #D3D9E1' }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6F1FB] text-[12px] text-[#185FA5] font-medium">
                      {getInitials(userItem.email)}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-[#1B1D21] font-medium">{userItem.email}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${roleBadgeClass(userItem.business_role)}`}>
                          {userItem.business_role === 'OWNER' ? 'Propietario' : 'Agente'}
                        </span>

                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClass(userItem.is_active)}`}>
                          <span
                            className="inline-block h-[6px] w-[6px] rounded-full"
                            style={{ backgroundColor: userItem.is_active ? '#1D9E75' : '#B42318' }}
                          />
                          {userItem.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={togglingUserId === userItem.id}
                    onClick={() => handleToggleUserStatus(userItem)}
                    className={`relative h-6 w-11 rounded-full border transition-colors ${userItem.is_active ? 'bg-[#185FA5]' : 'bg-[#E4E8EE]'}`}
                    style={{ borderWidth: '0.5px', borderColor: userItem.is_active ? '#185FA5' : '#C8CFDA' }}
                  >
                    <span
                      className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white transition-all ${userItem.is_active ? 'right-1' : 'left-1'}`}
                    />
                  </button>
                </div>
              ))}

              {detail.users.length === 0 && (
                <div className="px-3 py-4 text-[12px] text-[#6F7782] font-normal">No hay usuarios asociados.</div>
              )}
            </div>
          </article>

          <article className="rounded-[12px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
            <h2 className="text-[13px] text-[#6F7782] font-medium">Configuracion del bot</h2>
            <p className="mt-3 text-[12px] text-[#4A525E] font-normal">Nodos del flujo: {nodesCount}</p>
            <p className="mt-1 text-[12px] text-[#6F7782] font-normal">Primer mensaje: {firstMessage(detail.bot_flow?.nodes)}</p>

            <Link
              href={`/settings/bot?businessId=${businessId}`}
              className="mt-4 inline-flex h-[34px] items-center rounded-[8px] border border-[#185FA5] px-3 text-[13px] text-[#185FA5] font-medium"
              style={{ borderWidth: '0.5px' }}
            >
              Ver configuracion completa
            </Link>
          </article>

          <article className="rounded-[12px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
            <h2 className="text-[13px] text-[#6F7782] font-medium">Estado de conexion WhatsApp</h2>
            <p className="mt-2 text-[11px] text-[#6F7782] font-normal">
              El numero de WhatsApp se configura directamente en Meta Business Manager y se conecta automaticamente al recibir el primer mensaje.
            </p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] text-[#4A525E] font-normal">
                  {detail.whatsapp_account?.phone_number_id || 'Sin numero conectado'}
                </p>
                <p className="mt-1 text-[11px] text-[#9AA2AE] font-normal">
                  {detail.whatsapp_account?.phone_number || 'Sin configurar'}
                </p>
              </div>

              <span
                className="inline-flex rounded-full px-3 py-1 text-[11px] font-medium"
                style={
                  detail.whatsapp_account
                    ? { backgroundColor: '#EAF3DE', color: '#27500A' }
                    : { backgroundColor: '#EEF1F5', color: '#6F7782' }
                }
              >
                {detail.whatsapp_account ? 'Conectado' : 'Sin configurar'}
              </span>
            </div>
          </article>
        </div>

        {notice && <p className="mt-3 text-[12px] text-[#1D9E75] font-medium">{notice}</p>}
        {error && <p className="mt-3 text-[12px] text-[#B42318] font-normal">{error}</p>}
      </div>

      {showCreateUserModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.45)] p-4">
          <div className="w-full max-w-[420px] rounded-[8px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
            <h3 className="text-[13px] text-[#6F7782] font-medium">Agregar usuario</h3>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Correo electronico</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="h-[34px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                  style={{ borderWidth: '0.5px' }}
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Contrasena</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="h-[34px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                  style={{ borderWidth: '0.5px' }}
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Confirmar contrasena</label>
                <input
                  type="password"
                  value={createConfirmPassword}
                  onChange={(e) => setCreateConfirmPassword(e.target.value)}
                  className="h-[34px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                  style={{ borderWidth: '0.5px' }}
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Rol</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as 'OWNER' | 'AGENT')}
                  className="h-[34px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                  style={{ borderWidth: '0.5px' }}
                >
                  <option value="OWNER">Propietario</option>
                  <option value="AGENT">Agente</option>
                </select>
              </div>

              {createUserError && (
                <p className="text-[12px] text-[#B42318] font-normal">{createUserError}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="h-[34px] rounded-[8px] border border-[#D3D9E1] bg-white px-4 text-[13px] text-[#3E434B] font-medium"
                  style={{ borderWidth: '0.5px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createUserSaving}
                  className="h-[34px] rounded-[8px] bg-[#185FA5] px-4 text-[13px] text-white font-medium disabled:opacity-60"
                >
                  {createUserSaving ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
