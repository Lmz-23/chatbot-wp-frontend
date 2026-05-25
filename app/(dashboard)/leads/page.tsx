'use client';

import { useMemo, useState } from 'react';
import { useLeads } from '@/hooks';
import type { LeadStatus } from '@/lib/utils/leads';

interface CapturedInfoEntry {
  key: string;
  label: string;
  value: string;
}

function extractCapturedInfoEntries(notes: unknown): CapturedInfoEntry[] {
  if (!notes) return [];

  const fieldLabels: Record<string, string> = {
    client_name: 'Nombre',
    clientName: 'Nombre',
    nombre_cliente: 'Nombre',
    business_name: 'Negocio',
    businessName: 'Negocio',
    negocio: 'Negocio',
    contact: 'Contacto',
    contact_name: 'Contacto',
    interest: 'Interes',
    interes: 'Interes'
  };

  const parseSource = (): Record<string, unknown> | null => {
    if (typeof notes === 'object' && notes !== null && !Array.isArray(notes)) {
      return notes as Record<string, unknown>;
    }

    if (typeof notes !== 'string') return null;

    try {
      const parsed = JSON.parse(notes);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const parsed = parseSource();
  if (!parsed) return [];

  const preferredOrder = [
    'client_name',
    'clientName',
    'nombre_cliente',
    'business_name',
    'businessName',
    'negocio',
    'contact',
    'contact_name',
    'interest',
    'interes'
  ];

  const consumedCanonicalKeys = new Set<string>();
  const canonicalByKey: Record<string, string> = {
    client_name: 'client_name',
    clientName: 'client_name',
    nombre_cliente: 'client_name',
    business_name: 'business_name',
    businessName: 'business_name',
    negocio: 'business_name',
    contact: 'contact',
    contact_name: 'contact',
    interest: 'interest',
    interes: 'interest'
  };

  const entries: CapturedInfoEntry[] = [];
  for (const key of preferredOrder) {
    const canonical = canonicalByKey[key];
    if (!canonical || consumedCanonicalKeys.has(canonical)) continue;

    const raw = parsed[key];
    const value = String(raw ?? '').trim();
    if (!value) continue;

    entries.push({
      key: canonical,
      label: fieldLabels[key] || key,
      value
    });
    consumedCanonicalKeys.add(canonical);
  }

  return entries;
}

export default function LeadsPage() {
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [expandedNotesByLeadId, setExpandedNotesByLeadId] = useState<Record<string, boolean>>({});

  const {
    loading,
    error,
    toastMessage,
    onlyPending,
    selectedCategory,
    searchQuery,
    metricCounts,
    hasAnyLeads,
    sections,
    setOnlyPending,
    setSelectedCategory,
    setSearchQuery,
    setLeadNameDraft,
    saveLeadName,
    advanceLeadStatus
  } = useLeads();

  const safeSections = sections ?? [];
  const allItems = useMemo(() => safeSections.flatMap((section) => section.items), [safeSections]);
  const editingLead = editingLeadId
    ? allItems.find((item) => item.id === editingLeadId) || null
    : null;

  if (loading) {
    return <div className="p-6">Cargando leads...</div>;
  }

  const closeEditor = () => setEditingLeadId(null);
  const toggleLeadNotes = (leadId: string) => {
    setExpandedNotesByLeadId((prev) => ({
      ...prev,
      [leadId]: !prev[leadId]
    }));
  };

  const saveEditingLeadName = async () => {
    if (!editingLeadId) return;
    await saveLeadName(editingLeadId);
    closeEditor();
  };

  const getInitials = (value: string) => {
    const clean = value.trim();
    if (!clean) return 'LD';
    const parts = clean.split(/\s+/).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
  };

  const getActionButton = (status: LeadStatus) => {
    if (status === 'NEW') {
      return {
        label: 'Marcar contactado',
        className: 'h-[30px] rounded-[8px] border border-transparent bg-[#185FA5] px-4 text-[12px] font-medium text-white'
      };
    }

    if (status === 'CONTACTED') {
      return {
        label: 'Calificar',
        className: 'h-[30px] rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-4 text-[12px] font-medium text-[#3D444F]'
      };
    }

    return {
      label: status === 'QUALIFIED' ? 'Cerrar' : 'Reabrir',
      className: 'h-[30px] rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-4 text-[12px] font-medium text-[#3D444F]'
    };
  };

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[#F6F7F9]" style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="mx-auto max-w-[1200px] px-4 pb-8 pt-6 md:px-8">
        <header className="mb-6">
          <h1 className="text-[32px] leading-[1.2] text-[#1B1D21] font-medium">Leads</h1>
          <p className="mt-1 text-[28px] leading-[1.2] text-[#6F7782] font-normal">Prospectos capturados desde conversaciones de WhatsApp</p>
        </header>

        <section className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[8px] bg-[#F3F5F7] p-4">
            <p className="text-[12px] leading-none text-[#6F7782] font-normal">Total leads</p>
            <p className="mt-3 text-[22px] leading-none text-[#1B1D21] font-medium">{metricCounts.total}</p>
          </article>
          <article className="rounded-[8px] bg-[#F3F5F7] p-4">
            <p className="text-[12px] leading-none text-[#6F7782] font-normal">Nuevos</p>
            <p className="mt-3 text-[22px] leading-none text-[#185FA5] font-medium">{metricCounts.NEW}</p>
          </article>
          <article className="rounded-[8px] bg-[#F3F5F7] p-4">
            <p className="text-[12px] leading-none text-[#6F7782] font-normal">En seguimiento</p>
            <p className="mt-3 text-[22px] leading-none text-[#854F0B] font-medium">{metricCounts.CONTACTED}</p>
          </article>
          <article className="rounded-[8px] bg-[#F3F5F7] p-4">
            <p className="text-[12px] leading-none text-[#6F7782] font-normal">Calificados</p>
            <p className="mt-3 text-[22px] leading-none text-[#3B6D11] font-medium">{metricCounts.QUALIFIED}</p>
          </article>
        </section>

        <section className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="h-10 flex-1 rounded-[8px] border border-[#D3D9E1] bg-white px-3 text-[14px] font-normal text-[#1B1D21] outline-none"
            style={{ borderWidth: '0.5px' }}
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as 'ALL' | LeadStatus)}
            className="h-10 rounded-[8px] border border-[#D3D9E1] bg-white px-3 text-[14px] font-normal text-[#49515C] outline-none"
            style={{ borderWidth: '0.5px' }}
          >
            <option value="ALL">Todas las categorías</option>
            <option value="NEW">Nuevos</option>
            <option value="CONTACTED">Contactados</option>
            <option value="QUALIFIED">Calificados</option>
            {!onlyPending && <option value="CLOSED">Cerrados</option>}
          </select>

          <label
            htmlFor="pending-only"
            className={`inline-flex h-10 items-center gap-2 rounded-[8px] border px-3 text-[14px] font-medium ${
              onlyPending
                ? 'border-[#B5D4F4] bg-[#E6F1FB] text-[#185FA5]'
                : 'border-[#D3D9E1] bg-white text-[#5E6773]'
            }`}
            style={{ borderWidth: '0.5px' }}
          >
            <span
              className={`relative inline-flex h-4 w-4 items-center justify-center rounded-[4px] ${
                onlyPending ? 'bg-[#185FA5]' : 'border border-[#C8D0DB] bg-white'
              }`}
              style={{ borderWidth: onlyPending ? undefined : '0.5px' }}
            >
              <input
                id="pending-only"
                type="checkbox"
                checked={onlyPending}
                onChange={(e) => setOnlyPending(e.target.checked)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              {onlyPending && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M2.5 6.3L4.8 8.4L9.6 3.8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            Solo pendientes
          </label>
        </section>

        {error && <div className="mb-4 rounded-[8px] border border-[#F2C7C7] bg-[#FCEBEB] p-3 text-[12px] text-[#791F1F]">{error}</div>}
        {toastMessage && (
          <div className="mb-4 rounded-[8px] border border-[#B7DEC2] bg-[#EAF3DE] p-3 text-[12px] text-[#27500A]">
            {toastMessage}
          </div>
        )}

        {!hasAnyLeads ? (
          <div className="rounded-[12px] border border-[#D3D9E1] bg-white p-8 text-center text-[13px] text-[#6F7782]" style={{ borderWidth: '0.5px' }}>
            No hay leads todavía.
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.status}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[13px] uppercase tracking-wide text-[#6F7782] font-medium">{section.title}</h2>
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#E8EBF0] px-2 text-[12px] text-[#5E6773] font-medium">
                    {section.count}
                  </span>
                </div>

                <div className="space-y-3">
                  {section.items.length === 0 ? (
                    <p className="rounded-[12px] border border-[#D3D9E1] bg-white p-4 text-[12px] text-[#7C8591]" style={{ borderWidth: '0.5px' }}>
                      Sin leads en esta sección.
                    </p>
                  ) : (
                    section.items.map((item) => {
                      const action = getActionButton(item.status);
                      const capturedInfoEntries = extractCapturedInfoEntries(item.notes);
                      const hasCapturedInfo = capturedInfoEntries.length > 0;
                      const notesOpen = !!expandedNotesByLeadId[item.id];

                      return (
                        <article
                          key={item.id}
                          className={`rounded-[12px] border bg-white px-5 py-4 ${item.isHighlighted ? 'border-[#BFD5EA]' : 'border-[#D3D9E1]'}`}
                          style={{ borderWidth: '0.5px' }}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6F1FB] text-[14px] text-[#185FA5] font-medium">
                                {getInitials(item.nameOrPhone)}
                              </div>

                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setEditingLeadId(item.id)}
                                  className="truncate text-left text-[14px] text-[#1B1D21] font-medium"
                                >
                                  {item.nameOrPhone}
                                </button>
                                <p className="truncate text-[12px] text-[#6F7782] font-normal">{item.phone}</p>
                                <p className="mt-0.5 text-[11px] text-[#9EA6B1] font-normal">Última interacción: {item.lastInteractionLabel}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                              <span
                                className="inline-flex items-center rounded-full px-2 py-1 text-[12px] font-medium"
                                style={{
                                  backgroundColor:
                                    item.status === 'NEW'
                                      ? '#E6F1FB'
                                      : item.status === 'CONTACTED'
                                        ? '#FAEEDA'
                                        : item.status === 'QUALIFIED'
                                          ? '#EAF3DE'
                                          : '#ECEFF3',
                                  color:
                                    item.status === 'NEW'
                                      ? '#0C447C'
                                      : item.status === 'CONTACTED'
                                        ? '#633806'
                                        : item.status === 'QUALIFIED'
                                          ? '#27500A'
                                          : '#4A525E'
                                }}
                              >
                                {item.status}
                              </span>

                              {item.attentionLevel === 'customer' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#FCEBEB] px-2 py-1 text-[12px] font-medium text-[#791F1F]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#C02727]" />
                                  Cliente espera{item.waitText ? ` · ${item.waitText}` : ''}
                                </span>
                              )}

                              {item.attentionLevel === 'bot' && (
                                <span className="inline-flex items-center rounded-full bg-[#ECEFF3] px-2 py-1 text-[12px] font-medium text-[#4A525E]">
                                  Bot reactivado
                                </span>
                              )}

                              {item.isReopened && item.attentionLevel !== 'bot' && (
                                <span className="inline-flex items-center rounded-full bg-[#ECEFF3] px-2 py-1 text-[12px] font-medium text-[#4A525E]">
                                  Bot reactivado
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => advanceLeadStatus(item.id, item.nextActionStatus)}
                                disabled={item.isSaving}
                                className={`${action.className} disabled:opacity-60`}
                              >
                                {item.isSaving ? 'Guardando...' : action.label}
                              </button>
                            </div>
                          </div>

                          {hasCapturedInfo && (
                            <div className="mt-3 border-t border-[#E3E6EB] pt-3" style={{ borderWidth: '0.5px' }}>
                              <button
                                type="button"
                                onClick={() => toggleLeadNotes(item.id)}
                                className="inline-flex items-center gap-2 text-[12px] font-medium text-[#4A525E]"
                              >
                                <span className={`inline-block transition-transform ${notesOpen ? 'rotate-90' : ''}`}>▶</span>
                                Info capturada
                              </button>

                              {notesOpen && (
                                <div className="mt-2 space-y-1">
                                  {capturedInfoEntries.map((entry) => (
                                    <p key={`${item.id}-${entry.key}`} className="text-[12px] text-[#6F7782]">
                                      <span className="font-medium text-[#3D444F]">{entry.label}:</span> {entry.value}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {editingLead && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/25 px-4">
          <div className="w-full max-w-md rounded-[12px] border border-[#D3D9E1] bg-white p-5" style={{ borderWidth: '0.5px' }}>
            <h3 className="text-[16px] text-[#1B1D21] font-medium">Editar nombre del lead</h3>
            <p className="mt-1 text-[12px] text-[#6F7782] font-normal">Actualiza el nombre visible para este contacto.</p>

            <input
              type="text"
              value={editingLead.nameDraft}
              onChange={(e) => setLeadNameDraft(editingLead.id, e.target.value)}
              className="mt-4 h-10 w-full rounded-[8px] border border-[#D3D9E1] bg-white px-3 text-[14px] font-normal text-[#1B1D21] outline-none"
              style={{ borderWidth: '0.5px' }}
              placeholder="Nombre del lead"
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeEditor}
                className="h-9 rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-4 text-[12px] text-[#4A525E] font-medium"
                style={{ borderWidth: '0.5px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEditingLeadName}
                disabled={editingLead.isSaving}
                className="h-9 rounded-[8px] border border-transparent bg-[#185FA5] px-4 text-[12px] text-white font-medium disabled:opacity-60"
              >
                {editingLead.isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
