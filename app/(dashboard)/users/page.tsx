'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';
import { apiClient } from '@/lib/api/apiClient';

type ProfileResponse = {
  ok?: boolean;
  userId: string;
  email: string;
  platformRole: string;
  businessId: string | null;
  businessRole: string | null;
};

type BusinessUser = {
  id: string;
  email: string;
  platform_role: string;
  is_active: boolean;
  created_at: string;
  business_role?: string;
};

function getInitials(email: string) {
  const prefix = (email || '').split('@')[0] || '';
  const clean = prefix.replace(/[^a-zA-Z0-9]/g, ' ').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (clean.slice(0, 2) || 'US').toUpperCase();
}

function roleBadgeClass(role: 'ADMIN' | 'AGENT') {
  if (role === 'ADMIN') return 'bg-[#E6F1FB] text-[#0C447C]';
  return 'bg-[#EAF3DE] text-[#27500A]';
}

function statusBadgeClass(isActive: boolean) {
  return isActive ? 'bg-[#EAF3DE] text-[#27500A]' : 'bg-[#FCEBEB] text-[#791F1F]';
}

function toRoleType(user: BusinessUser, profile: ProfileResponse | null): 'ADMIN' | 'AGENT' {
  if (user.business_role === 'OWNER') return 'ADMIN';
  if (user.business_role === 'AGENT') return 'AGENT';
  if (profile && profile.userId === user.id && profile.businessRole === 'OWNER') return 'ADMIN';
  if (user.platform_role === 'PLATFORM_ADMIN') return 'ADMIN';
  return 'AGENT';
}

async function proxyClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      throw new Error('invalid_token');
    }

    if (isJson && body && typeof body === 'object') {
      const errorData = body as { error?: string; message?: string };
      throw new Error(errorData.error || errorData.message || 'request_failed');
    }

    throw new Error(typeof body === 'string' ? body : 'request_failed');
  }

  return body as T;
}

export default function UsersPage() {
  const router = useRouter();
  const { loading: authLoading, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [users, setUsers] = useState<BusinessUser[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'OWNER' | 'AGENT'>('AGENT');
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const isOwner = profile?.businessRole === 'OWNER';

  const myRoleType = useMemo<'ADMIN' | 'AGENT'>(() => {
    if (profile?.businessRole === 'OWNER' || profile?.platformRole === 'PLATFORM_ADMIN') {
      return 'ADMIN';
    }
    return 'AGENT';
  }, [profile]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const loadData = async () => {
      setLoading(true);
      setListError(null);
      try {
        const profileResponse = await proxyClient<ProfileResponse>('/api/user/profile');
        setProfile(profileResponse);

        if (profileResponse.businessRole === 'OWNER') {
          const usersResponse = await proxyClient<{ ok: boolean; users: BusinessUser[] }>('/api/users');
          setUsers(Array.isArray(usersResponse?.users) ? usersResponse.users : []);
        }
      } catch (err) {
        setListError(err instanceof Error ? err.message : 'No se pudo cargar la página de usuarios');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, isAuthenticated]);

  const reloadUsers = async () => {
    if (!isOwner) return;
    const usersResponse = await proxyClient<{ ok: boolean; users: BusinessUser[] }>('/api/users');
    setUsers(Array.isArray(usersResponse?.users) ? usersResponse.users : []);
  };

  const handleUpdatePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!profile?.userId) {
      setPasswordError('No se pudo identificar el usuario actual');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener mínimo 8 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }

    setPasswordSaving(true);
    try {
      await apiClient(`/api/users/${profile.userId}/password`, {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Contraseña actualizada correctamente');
      setTimeout(() => setPasswordSuccess(null), 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar la contraseña';
      if (message.includes('currentPassword is invalid')) {
        setPasswordError('La contraseña actual no es correcta');
      } else {
        setPasswordError(message);
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleToggleStatus = async (target: BusinessUser) => {
    if (!profile || profile.userId === target.id) return;

    setTogglingUserId(target.id);
    try {
      const response = await apiClient(`/api/users/${target.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !target.is_active })
      });

      const payload = response as { ok: boolean; user: BusinessUser };
      setUsers((prev) => prev.map((user) => (user.id === target.id ? { ...user, ...payload.user } : user)));
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del usuario');
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleCreateAgent = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);

    if (!createEmail.trim()) {
      setCreateError('El correo es obligatorio');
      return;
    }

    if (createPassword.length < 8) {
      setCreateError('La contraseña debe tener mínimo 8 caracteres');
      return;
    }

    setCreateSaving(true);
    try {
      await proxyClient<{ ok: boolean; user: BusinessUser }>('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: createEmail.trim(),
          password: createPassword,
          role: createRole
        })
      });

      setCreateEmail('');
      setCreatePassword('');
      setCreateRole('AGENT');
      setShowCreateModal(false);
      await reloadUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No se pudo crear el agente');
    } finally {
      setCreateSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-[#F6F7F9] text-[#1B1D21]" style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header className="fixed inset-x-0 top-0 z-10 bg-white" style={{ borderBottom: '0.5px solid #E3E6EB' }}>
        <div className="mx-auto flex h-[68px] w-full max-w-[1400px] items-center justify-between px-4 md:px-8">
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

          <Link
            href="/"
            className="inline-flex h-8 items-center rounded-[8px] border px-3 text-[12px] font-medium"
            style={{ borderColor: '#B5D4F4', borderWidth: '0.5px', backgroundColor: '#E6F1FB', color: '#185FA5' }}
          >
            ← Inicio
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-4 pb-8 pt-[88px] md:px-8">
        <div className="space-y-4">
          <article className="rounded-[8px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
            <h2 className="text-[13px] text-[#6F7782] font-medium">Mi perfil</h2>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Correo electrónico</label>
                <input
                  type="text"
                  value={profile?.email || ''}
                  disabled
                  className="h-[34px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal"
                  style={{ borderWidth: '0.5px' }}
                />
                <p className="mt-2 text-[11px] text-[#6F7782] font-normal">El correo no puede modificarse</p>
              </div>

              <div>
                <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-medium ${roleBadgeClass(myRoleType)}`}>
                  {myRoleType === 'ADMIN' ? 'Administrador' : 'Agente'}
                </span>
              </div>

              <div style={{ borderTop: '0.5px solid #D3D9E1' }} />

              <form onSubmit={handleUpdatePassword} className="space-y-3">
                <h3 className="text-[13px] text-[#4A525E] font-medium">Cambiar contraseña</h3>

                <div>
                  <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Contraseña actual</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-[34px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                    style={{ borderWidth: '0.5px' }}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Nueva contraseña</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-[34px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                    style={{ borderWidth: '0.5px' }}
                  />
                  <p className="mt-2 text-[11px] text-[#6F7782] font-normal">Mínimo 8 caracteres</p>
                </div>

                <div>
                  <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Confirmar nueva contraseña</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-[34px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                    style={{ borderWidth: '0.5px' }}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="h-[34px] rounded-[8px] bg-[#185FA5] px-4 text-[13px] text-white font-medium disabled:opacity-60"
                  >
                    {passwordSaving ? 'Actualizando...' : 'Actualizar contraseña'}
                  </button>
                </div>

                {passwordSuccess && (
                  <p className="text-[12px] text-[#1D9E75] font-medium">{passwordSuccess}</p>
                )}

                {passwordError && (
                  <p className="text-[12px] text-[#B42318] font-normal">{passwordError}</p>
                )}
              </form>
            </div>
          </article>

          {isOwner && (
            <div className="relative">
              <article className="rounded-[8px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
                <h2 className="text-[13px] text-[#6F7782] font-medium">Agentes del negocio</h2>

                <div className="mt-4 overflow-hidden rounded-[8px] border border-[#D3D9E1]" style={{ borderWidth: '0.5px' }}>
                  {users.map((user, index) => {
                    const roleType = toRoleType(user, profile);
                    const isSelf = profile?.userId === user.id;
                    const isToggling = togglingUserId === user.id;

                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between gap-3 bg-white px-3 py-3"
                        style={{ borderBottom: index === users.length - 1 ? 'none' : '0.5px solid #D3D9E1' }}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E6F1FB] text-[12px] text-[#185FA5] font-medium">
                            {getInitials(user.email)}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-[13px] text-[#1B1D21] font-medium">{user.email}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${roleBadgeClass(roleType)}`}>
                                {roleType === 'ADMIN' ? 'Administrador' : 'Agente'}
                              </span>

                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${statusBadgeClass(user.is_active)}`}>
                                <span
                                  className="inline-block h-[6px] w-[6px] rounded-full"
                                  style={{ backgroundColor: user.is_active ? '#1D9E75' : '#B42318' }}
                                />
                                {user.is_active ? 'Activo' : 'Inactivo'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {!isSelf ? (
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleStatus(user)}
                            className={`relative h-6 w-11 rounded-full border transition-colors ${user.is_active ? 'bg-[#185FA5]' : 'bg-[#E4E8EE]'}`}
                            style={{ borderWidth: '0.5px', borderColor: user.is_active ? '#185FA5' : '#C8CFDA' }}
                          >
                            <span
                              className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white transition-all ${user.is_active ? 'right-1' : 'left-1'}`}
                            />
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#6F7782] font-normal">Tu cuenta</span>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setCreateError(null);
                      setShowCreateModal(true);
                    }}
                    className="flex h-[38px] w-full items-center justify-center border-t border-dashed border-[#C8D0DB] bg-white text-[13px] text-[#4A525E] font-medium"
                    style={{ borderWidth: '0.5px 0 0 0' }}
                  >
                    + Agregar agente
                  </button>
                </div>

                {listError && (
                  <p className="mt-3 text-[12px] text-[#B42318] font-normal">{listError}</p>
                )}
              </article>

              {showCreateModal && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.45)] p-4">
                  <div className="w-full max-w-[420px] rounded-[8px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
                    <h3 className="text-[13px] text-[#6F7782] font-medium">Crear agente</h3>

                    <form onSubmit={handleCreateAgent} className="mt-4 space-y-3">
                      <div>
                        <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Correo electrónico</label>
                        <input
                          type="email"
                          value={createEmail}
                          onChange={(e) => setCreateEmail(e.target.value)}
                          className="h-[34px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] text-[#1B1D21] font-normal outline-none"
                          style={{ borderWidth: '0.5px' }}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Contraseña</label>
                        <input
                          type="password"
                          value={createPassword}
                          onChange={(e) => setCreatePassword(e.target.value)}
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
                          <option value="OWNER">Administrador</option>
                          <option value="AGENT">Agente</option>
                        </select>
                      </div>

                      {createError && (
                        <p className="text-[12px] text-[#B42318] font-normal">{createError}</p>
                      )}

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
                          {createSaving ? 'Creando...' : 'Crear agente'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
