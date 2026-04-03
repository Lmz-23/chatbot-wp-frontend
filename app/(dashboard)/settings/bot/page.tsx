'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';

type BotTransition = {
  keywords: string[];
  next: string;
};

type BotNode = {
  id: string;
  message: string;
  transitions: BotTransition[];
  default: string;
};

type FlowNodeType = 'start' | 'node' | 'fallback' | 'escalate';

const EMPTY_NODE: BotNode = {
  id: 'nuevo_nodo',
  message: '',
  transitions: [],
  default: 'fallback'
};

function normalizeText(value: string) {
  return value.trim();
}

function createEmptyTransition(next = 'fallback'): BotTransition {
  return {
    keywords: [],
    next
  };
}

function getNodeType(nodeId: string): FlowNodeType {
  if (nodeId === 'start') return 'start';
  if (nodeId === 'fallback') return 'fallback';
  if (nodeId.startsWith('escalate')) return 'escalate';
  return 'node';
}

function getNodeBadgeStyles(type: FlowNodeType) {
  if (type === 'start') return 'bg-[#EAF3DE] text-[#3B6D11]';
  if (type === 'fallback') return 'bg-[#FAEEDA] text-[#854F0B]';
  if (type === 'escalate') return 'bg-[#FCEBEB] text-[#791F1F]';
  return 'bg-[#E6F1FB] text-[#185FA5]';
}

function ensureUniqueNodeId(baseId: string, existingIds: string[]) {
  const normalizedBase = normalizeText(baseId) || 'nuevo_nodo';
  if (!existingIds.includes(normalizedBase)) return normalizedBase;

  let index = 2;
  let candidate = `${normalizedBase}_${index}`;
  while (existingIds.includes(candidate)) {
    index += 1;
    candidate = `${normalizedBase}_${index}`;
  }

  return candidate;
}

function cloneNodes(nodes: BotNode[]): BotNode[] {
  return nodes.map((node) => ({
    ...node,
    transitions: node.transitions.map((transition) => ({
      keywords: [...transition.keywords],
      next: transition.next
    }))
  }));
}

function sanitizeNodes(nodes: BotNode[]) {
  return nodes
    .map((node) => ({
      ...node,
      id: normalizeText(node.id),
      message: node.message ?? '',
      default: normalizeText(node.default) || 'fallback',
      transitions: (node.transitions || []).map((transition) => ({
        keywords: Array.isArray(transition.keywords)
          ? transition.keywords.map((keyword) => normalizeText(keyword)).filter(Boolean)
          : [],
        next: normalizeText(transition.next) || 'fallback'
      }))
    }))
    .filter((node) => Boolean(node.id));
}

function updateReferencesAfterIdChange(nodes: BotNode[], oldId: string, newId: string) {
  return nodes.map((node) => ({
    ...node,
    transitions: node.transitions.map((transition) => ({
      ...transition,
      next: transition.next === oldId ? newId : transition.next
    })),
    default: node.default === oldId ? newId : node.default
  }));
}

function updateReferencesAfterDelete(nodes: BotNode[], deletedId: string, replacementId: string) {
  return nodes.map((node) => ({
    ...node,
    transitions: node.transitions.map((transition) => ({
      ...transition,
      next: transition.next === deletedId ? replacementId : transition.next
    })),
    default: node.default === deletedId ? replacementId : node.default
  }));
}

function getNodePreview(message: string) {
  const clean = normalizeText(message);
  if (!clean) return 'Sin mensaje todavía';
  return clean.length > 60 ? `${clean.slice(0, 60)}...` : clean;
}

export default function BotSettingsPage() {
  const [nodes, setNodes] = useState<BotNode[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string>('start');
  const [businessName, setBusinessName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeNode = useMemo(
    () => nodes.find((node) => node.id === activeNodeId) || nodes[0] || null,
    [nodes, activeNodeId]
  );

  const nodeIds = useMemo(() => nodes.map((node) => node.id).filter(Boolean), [nodes]);

  useEffect(() => {
    const loadFlow = async () => {
      setLoading(true);
      setError(null);
      setProfileError(null);

      try {
        const response = await apiClient('/api/settings/bot');
        const loadedNodes = Array.isArray(response?.nodes) ? response.nodes : [];

        const normalizedNodes = sanitizeNodes(
          loadedNodes.length > 0
            ? loadedNodes
            : [
                {
                  ...EMPTY_NODE,
                  id: 'start',
                  message: 'Hola, bienvenido a [Nombre Clínica]. ¿En qué podemos ayudarte hoy?',
                  transitions: [
                    { keywords: ['especialidad', 'consulta'], next: 'ask_specialty' },
                    { keywords: ['precio', 'costo', 'tarifa'], next: 'ask_service_price' },
                    { keywords: ['horario', 'hora', 'abierto'], next: 'hours_info' },
                    { keywords: ['agente', 'humano', 'asesor'], next: 'escalate_agent' }
                  ],
                  default: 'ask_specialty'
                }
              ]
        );

        setNodes(normalizedNodes);
        setActiveNodeId(normalizedNodes.find((node) => node.id === 'start')?.id || normalizedNodes[0]?.id || 'start');

        try {
          const profile = await apiClient('/api/business/profile');
          setBusinessName(typeof profile?.name === 'string' ? profile.name : '');
        } catch (profileErr) {
          setProfileError(profileErr instanceof Error ? profileErr.message : 'No se pudo cargar el perfil del negocio');
        }
      } catch (loadErr) {
        setError(loadErr instanceof Error ? loadErr.message : 'No se pudo cargar el flujo del bot');
      } finally {
        setLoading(false);
      }
    };

    loadFlow();
  }, []);

  useEffect(() => {
    if (!activeNode && nodes.length > 0) {
      setActiveNodeId(nodes[0].id);
    }
  }, [activeNode, nodes]);

  const updateActiveNode = (updater: (node: BotNode) => BotNode) => {
    setNodes((prev) => {
      const next = prev.map((node) => (node.id === activeNodeId ? updater(node) : node));
      return next;
    });
  };

  const addNode = () => {
    setNodes((prev) => {
      const nextId = ensureUniqueNodeId('nuevo_nodo', prev.map((node) => node.id));
      const nextNodes = [...cloneNodes(prev), { ...EMPTY_NODE, id: nextId }];
      setActiveNodeId(nextId);
      return nextNodes;
    });
  };

  const deleteNode = () => {
    if (!activeNode) return;

    const confirmed = typeof window !== 'undefined'
      ? window.confirm(`¿Eliminar el nodo "${activeNode.id}"?`)
      : true;

    if (!confirmed) return;

    setNodes((prev) => {
      const remaining = prev.filter((node) => node.id !== activeNode.id);
      if (remaining.length === 0) {
        setActiveNodeId('start');
        return [];
      }

      const replacementId = remaining.find((node) => node.id === 'fallback')?.id || remaining[0].id;
      const updated = updateReferencesAfterDelete(remaining, activeNode.id, replacementId);
      setActiveNodeId(replacementId);
      return updated;
    });
  };

  const addTransition = () => {
    if (!activeNode) return;

    updateActiveNode((node) => ({
      ...node,
      transitions: [...node.transitions, createEmptyTransition(node.default || 'fallback')]
    }));
  };

  const removeTransition = (index: number) => {
    if (!activeNode) return;

    updateActiveNode((node) => ({
      ...node,
      transitions: node.transitions.filter((_, currentIndex) => currentIndex !== index)
    }));
  };

  const updateTransition = (index: number, patch: Partial<BotTransition> & { keywordsText?: string }) => {
    if (!activeNode) return;

    updateActiveNode((node) => ({
      ...node,
      transitions: node.transitions.map((transition, currentIndex) => {
        if (currentIndex !== index) return transition;

        const nextTransition: BotTransition = {
          keywords: patch.keywordsText !== undefined
            ? patch.keywordsText.split(',').map((keyword) => normalizeText(keyword)).filter(Boolean)
            : patch.keywords ?? transition.keywords,
          next: patch.next !== undefined ? normalizeText(patch.next) : transition.next
        };

        return nextTransition;
      })
    }));
  };

  const updateNodeId = (newId: string) => {
    if (!activeNode) return;

    const trimmed = normalizeText(newId);
    if (!trimmed) {
      updateActiveNode((node) => ({ ...node, id: '' }));
      setActiveNodeId('');
      return;
    }

    setNodes((prev) => {
      const oldId = activeNode.id;
      const otherIds = prev.filter((node) => node.id !== oldId).map((node) => node.id);
      const uniqueId = trimmed === oldId ? trimmed : ensureUniqueNodeId(trimmed, otherIds);

      setActiveNodeId(uniqueId);

      return updateReferencesAfterIdChange(
        prev.map((node) => (node.id === oldId ? { ...node, id: uniqueId } : node)),
        oldId,
        uniqueId
      );
    });
  };

  const updateNodeDefault = (next: string) => {
    updateActiveNode((node) => ({
      ...node,
      default: normalizeText(next)
    }));
  };

  const saveChanges = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const normalizedNodes = sanitizeNodes(nodes);
      const ids = normalizedNodes.map((node) => node.id);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

      if (duplicates.length > 0) {
        throw new Error(`Hay nodos duplicados: ${[...new Set(duplicates)].join(', ')}`);
      }

      if (normalizedNodes.some((node) => !node.id)) {
        throw new Error('Todos los nodos deben tener un id válido');
      }

      const response = await apiClient('/api/settings/bot', {
        method: 'PUT',
        body: JSON.stringify({ nodes: normalizedNodes })
      });

      const savedNodes = Array.isArray(response?.nodes) ? sanitizeNodes(response.nodes) : normalizedNodes;
      setNodes(savedNodes);
      setActiveNodeId((current) => {
        if (savedNodes.some((node) => node.id === current)) return current;
        return savedNodes[0]?.id || 'start';
      });
      setNotice('Cambios guardados correctamente');
    } catch (saveErr) {
      setError(saveErr instanceof Error ? saveErr.message : 'No se pudieron guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const saveBusinessProfile = async () => {
    setProfileSaving(true);
    setProfileError(null);
    setProfileNotice(null);

    try {
      const trimmedName = normalizeText(businessName);
      if (!trimmedName) {
        throw new Error('El nombre del negocio es obligatorio');
      }

      if (trimmedName.length > 100) {
        throw new Error('El nombre del negocio debe tener máximo 100 caracteres');
      }

      const updated = await apiClient('/api/business/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: trimmedName })
      });

      setBusinessName(typeof updated?.name === 'string' ? updated.name : trimmedName);
      setProfileNotice('Nombre actualizado correctamente');
      setTimeout(() => setProfileNotice(null), 2500);
    } catch (profileSaveErr) {
      setProfileError(profileSaveErr instanceof Error ? profileSaveErr.message : 'No se pudo actualizar el nombre del negocio');
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F6F7F9] px-4 pt-20 text-[#1B1D21]" style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div className="mx-auto max-w-[1200px] rounded-[12px] border border-[#D3D9E1] bg-white p-6 text-[14px] font-normal" style={{ borderWidth: '0.5px' }}>
          Cargando editor del bot...
        </div>
      </main>
    );
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

      <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-0 px-0 pt-[68px] md:grid md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="w-full shrink-0 border-r-0 bg-white md:flex md:flex-col" style={{ borderWidth: '0 0.5px 0 0' }}>
          <div className="border-b border-[#D3D9E1] px-4 py-4" style={{ borderWidth: '0 0 0.5px 0' }}>
            <h2 className="text-[13px] uppercase tracking-[0.12em] text-[#6F7782] font-medium">Nodos del flujo</h2>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3 md:max-h-[calc(100vh-128px)]">
            {nodes.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[#C8D0DB] bg-white p-4 text-[12px] text-[#6F7782]" style={{ borderWidth: '0.5px' }}>
                No hay nodos todavía.
              </div>
            ) : (
              nodes.map((node) => {
                const type = getNodeType(node.id);
                const isActive = node.id === activeNodeId;

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setActiveNodeId(node.id)}
                    className={`w-full rounded-[12px] border px-3 py-3 text-left transition-colors ${isActive ? 'bg-[#E6F1FB]' : 'bg-white'}`}
                    style={{
                      borderColor: isActive ? '#185FA5' : '#D3D9E1',
                      borderWidth: '0.5px'
                    }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${getNodeBadgeStyles(type)}`}>
                        {type === 'start' ? 'Inicio' : type === 'fallback' ? 'Fallback' : type === 'escalate' ? 'Escalar' : 'Nodo'}
                      </span>
                    </div>
                    <p className="truncate text-[13px] text-[#1B1D21] font-medium">{node.id || 'Sin id'}</p>
                    <p className="mt-1 truncate text-[11px] text-[#6F7782] font-normal">{getNodePreview(node.message)}</p>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-[#D3D9E1] p-3" style={{ borderWidth: '0.5px 0 0 0' }}>
            <button
              type="button"
              onClick={addNode}
              className="flex h-10 w-full items-center justify-center rounded-[12px] border border-dashed border-[#C8D0DB] bg-white text-[14px] font-medium text-[#3D444F]"
              style={{ borderWidth: '0.5px' }}
            >
              ＋ Agregar nodo
            </button>
          </div>
        </aside>

        <section className="flex flex-1 flex-col gap-4 p-4 md:p-8">
          <article className="rounded-[12px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
            <h3 className="text-[13px] font-medium text-[#6F7782]">Perfil del negocio</h3>

            <div className="mt-4">
              <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">Nombre del negocio</label>

              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ej: Clínica San Rafael"
                  className="h-[34px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] font-normal text-[#1B1D21] outline-none"
                  style={{ borderWidth: '0.5px' }}
                />

                <button
                  type="button"
                  onClick={saveBusinessProfile}
                  disabled={profileSaving}
                  className="h-[34px] rounded-[8px] border border-transparent bg-[#185FA5] px-4 text-[13px] font-medium text-white disabled:opacity-60"
                >
                  {profileSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>

              <p className="mt-2 text-[11px] text-[#6F7782] font-normal">Este nombre aparecerá automáticamente en los mensajes del bot</p>

              {profileNotice && (
                <p className="mt-2 text-[11px] text-[#1D9E75] font-medium">{profileNotice}</p>
              )}

              {profileError && (
                <p className="mt-2 text-[11px] text-[#B42318] font-normal">{profileError}</p>
              )}
            </div>
          </article>

          {!activeNode ? (
            <div className="rounded-[12px] border border-[#D3D9E1] bg-white p-6 text-[14px] text-[#6F7782]" style={{ borderWidth: '0.5px' }}>
              Selecciona o crea un nodo para empezar.
            </div>
          ) : (
            <>
              <article className="rounded-[12px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-[#F3F5F7] px-3 py-1 text-[12px] font-medium text-[#4A525E]">
                    ID del nodo: {activeNode.id || 'sin id'}
                  </span>
                  <label className="text-[12px] text-[#6F7782] font-normal">
                    Editar id del nodo
                  </label>
                  <input
                    type="text"
                    value={activeNode.id}
                    onChange={(e) => updateNodeId(e.target.value)}
                    className="h-9 w-full max-w-sm rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] font-normal text-[#1B1D21] outline-none"
                    style={{ borderWidth: '0.5px' }}
                  />
                </div>

                <label className="mb-2 block text-[12px] text-[#6F7782] font-normal">
                  Mensaje que envía el bot
                </label>
                <textarea
                  value={activeNode.message}
                  onChange={(e) => updateActiveNode((node) => ({ ...node, message: e.target.value }))}
                  className="min-h-[80px] w-full rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] p-3 text-[14px] font-normal text-[#1B1D21] outline-none"
                  style={{ borderWidth: '0.5px' }}
                />
              </article>

              <article className="rounded-[12px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
                <h3 className="text-[13px] font-medium text-[#6F7782]">Ramas — si el usuario menciona...</h3>

                <div className="mt-4 space-y-3">
                  {activeNode.transitions.length === 0 ? (
                    <p className="rounded-[8px] border border-dashed border-[#C8D0DB] bg-[#F3F5F7] px-3 py-3 text-[12px] text-[#6F7782]" style={{ borderWidth: '0.5px' }}>
                      Aún no hay ramas configuradas.
                    </p>
                  ) : (
                    activeNode.transitions.map((transition, index) => (
                      <div key={`${activeNode.id}-transition-${index}`} className="grid grid-cols-1 items-center gap-2 md:grid-cols-[1fr_auto_220px_auto]">
                        <input
                          type="text"
                          value={transition.keywords.join(', ')}
                          onChange={(e) => updateTransition(index, { keywordsText: e.target.value })}
                          className="h-10 rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] font-normal text-[#1B1D21] outline-none"
                          style={{ borderWidth: '0.5px' }}
                          placeholder="palabra clave, otra palabra"
                        />
                        <span className="hidden justify-center text-[#9AA2AE] md:flex">→</span>
                        <select
                          value={transition.next}
                          onChange={(e) => updateTransition(index, { next: e.target.value })}
                          className="h-10 rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] font-normal text-[#1B1D21] outline-none"
                          style={{ borderWidth: '0.5px' }}
                        >
                          {nodeIds.map((nodeId) => (
                            <option key={`${activeNode.id}-${index}-${nodeId}`} value={nodeId}>
                              {nodeId}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeTransition(index)}
                          className="h-10 rounded-[8px] border border-[#D3D9E1] bg-white px-3 text-[14px] font-medium text-[#791F1F]"
                          style={{ borderWidth: '0.5px' }}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}

                  <button
                    type="button"
                    onClick={addTransition}
                    className="mt-1 flex h-10 items-center justify-center rounded-[8px] border border-dashed border-[#C8D0DB] bg-white px-4 text-[13px] font-medium text-[#4A525E]"
                    style={{ borderWidth: '0.5px' }}
                  >
                    + Agregar rama
                  </button>

                  <div className="flex flex-col gap-2 pt-2 md:flex-row md:items-center">
                    <p className="text-[12px] text-[#6F7782] font-normal">Si no coincide ninguna rama, ir a:</p>
                    <select
                      value={activeNode.default}
                      onChange={(e) => updateNodeDefault(e.target.value)}
                      className="h-10 w-full max-w-sm rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[13px] font-normal text-[#1B1D21] outline-none"
                      style={{ borderWidth: '0.5px' }}
                    >
                      {nodeIds.map((nodeId) => (
                        <option key={`default-${nodeId}`} value={nodeId}>
                          {nodeId}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </article>

              <div className="flex flex-col gap-3 pt-2 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={deleteNode}
                  className="h-10 rounded-[8px] border border-[#E9B8B8] bg-white px-4 text-[13px] font-medium text-[#B42318]"
                  style={{ borderWidth: '0.5px' }}
                >
                  Eliminar nodo
                </button>
                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={saving}
                  className="h-10 rounded-[8px] border border-transparent bg-[#185FA5] px-4 text-[13px] font-medium text-white disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>

              {error && (
                <div className="rounded-[12px] border border-[#F2C7C7] bg-[#FCEBEB] p-3 text-[12px] text-[#791F1F]" style={{ borderWidth: '0.5px' }}>
                  {error}
                </div>
              )}

              {notice && (
                <div className="rounded-[12px] border border-[#B7DEC2] bg-[#EAF3DE] p-3 text-[12px] text-[#27500A]" style={{ borderWidth: '0.5px' }}>
                  {notice}
                </div>
              )}

            </>
          )}
        </section>
      </div>
    </main>
  );
}