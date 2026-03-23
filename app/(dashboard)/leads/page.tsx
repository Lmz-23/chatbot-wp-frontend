'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CLOSED';

interface Lead {
  id: string;
  phone: string;
  name: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  last_interaction_at: string;
}

const STATUS_OPTIONS: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'];

const STATUS_TITLES: Record<LeadStatus, string> = {
  NEW: 'Nuevos',
  CONTACTED: 'Contactados',
  QUALIFIED: 'Calificados',
  CLOSED: 'Cerrados'
};

function getStatusClasses(status: LeadStatus): string {
  if (status === 'NEW') return 'bg-sky-100 text-sky-700 border-sky-200';
  if (status === 'CONTACTED') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (status === 'QUALIFIED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

function getNextLeadAction(status: LeadStatus): { label: string; next: LeadStatus } {
  if (status === 'NEW') return { label: 'Marcar Contactado', next: 'CONTACTED' };
  if (status === 'CONTACTED') return { label: 'Calificar', next: 'QUALIFIED' };
  if (status === 'QUALIFIED') return { label: 'Cerrar', next: 'CLOSED' };
  return { label: 'Reabrir', next: 'CONTACTED' };
}

function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [highlightedLeadId, setHighlightedLeadId] = useState<string | null>(null);
  const [savingByLead, setSavingByLead] = useState<Record<string, boolean>>({});
  const [nameDraftByLead, setNameDraftByLead] = useState<Record<string, string>>({});
  const [onlyPending, setOnlyPending] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const leadsById = useMemo(() => {
    const map: Record<string, Lead> = {};
    for (const lead of leads) map[lead.id] = lead;
    return map;
  }, [leads]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient('/business/leads');
      if (!response || !response.ok) {
        setError('No se pudieron cargar los leads');
        return;
      }

      const nextLeads: Lead[] = response.leads || [];
      setLeads(nextLeads);

      const nextDrafts: Record<string, string> = {};
      for (const lead of nextLeads) {
        nextDrafts[lead.id] = lead.name || '';
      }
      setNameDraftByLead(nextDrafts);
    } catch (err) {
      console.error('fetch leads error:', err);
      setError('Error al cargar leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const patchLead = async (
    leadId: string,
    payload: Partial<Pick<Lead, 'name' | 'status'>>,
    previousLead: Lead,
    successMessage?: string
  ) => {
    setSavingByLead((prev) => ({ ...prev, [leadId]: true }));

    try {
      const response = await apiClient(`/business/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      if (!response || !response.ok || !response.lead) {
        throw new Error('patch_failed');
      }

      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? response.lead : lead))
      );
      setNameDraftByLead((prev) => ({
        ...prev,
        [leadId]: response.lead.name || ''
      }));
      setError(null);
      if (successMessage) {
        setToastMessage(successMessage);
        setHighlightedLeadId(leadId);
        setTimeout(() => setToastMessage(null), 1800);
        setTimeout(() => setHighlightedLeadId((prev) => (prev === leadId ? null : prev)), 1600);
      }
      return response.lead as Lead;
    } catch (err) {
      // Rollback optimistic update on failure.
      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? previousLead : lead))
      );
      setNameDraftByLead((prev) => ({
        ...prev,
        [leadId]: previousLead.name || ''
      }));
      console.error('patch lead error:', err);
      setError('No se pudo guardar el lead. Revirtiendo cambios.');
      return null;
    } finally {
      setSavingByLead((prev) => ({ ...prev, [leadId]: false }));
    }
  };

  const handleNameSave = async (leadId: string) => {
    const currentLead = leadsById[leadId];
    if (!currentLead) return;

    const draftName = nameDraftByLead[leadId] ?? '';
    const currentName = currentLead.name ?? '';
    if (draftName === currentName) return;

    await patchLead(
      leadId,
      { name: draftName === '' ? null : draftName },
      currentLead,
      'Nombre actualizado'
    );
  };

  const handleStatusChange = (leadId: string, nextStatus: LeadStatus) => {
    const currentLead = leadsById[leadId];
    if (!currentLead) return;

    if (currentLead.status === nextStatus) return;

    const optimisticLead: Lead = { ...currentLead, status: nextStatus };
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? optimisticLead : lead)));
    patchLead(leadId, { status: nextStatus }, currentLead, `Lead movido a ${nextStatus}`);
  };

  const filteredLeads = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();

    return leads.filter((lead) => {
      if (onlyPending && lead.status === 'CLOSED') return false;

      if (!term) return true;

      const haystack = `${lead.name || ''} ${lead.phone}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [leads, onlyPending, searchQuery]);

  const groupedLeads = useMemo(() => {
    const grouped: Record<LeadStatus, Lead[]> = {
      NEW: [],
      CONTACTED: [],
      QUALIFIED: [],
      CLOSED: []
    };

    for (const lead of filteredLeads) {
      grouped[lead.status].push(lead);
    }

    for (const status of STATUS_OPTIONS) {
      grouped[status].sort((a, b) => {
        const aTs = new Date(a.last_interaction_at || a.updated_at || a.created_at).getTime();
        const bTs = new Date(b.last_interaction_at || b.updated_at || b.created_at).getTime();
        return aTs - bTs;
      });
    }

    return grouped;
  }, [filteredLeads]);

  if (loading) {
    return <div className="p-6">Cargando leads...</div>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-4 md:p-6">
      <header className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <Link
            href="/"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
          >
            Inicio
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">Prospectos por negocio conectados a conversaciones.</p>
      </header>

      <div className="mb-4 flex flex-col gap-2 rounded-lg border bg-card p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <input
            id="pending-only"
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => setOnlyPending(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="pending-only" className="text-sm text-foreground">Solo pendientes</label>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre o telefono"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm md:max-w-xs"
        />
      </div>

      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {toastMessage && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {toastMessage}
        </div>
      )}

      {filteredLeads.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay leads todavía.
        </div>
      ) : (
        <div className="space-y-4">
          {STATUS_OPTIONS.map((status) => (
            <section key={status} className="rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                <h2 className="font-medium">{STATUS_TITLES[status]}</h2>
                <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  {groupedLeads[status].length}
                </span>
              </div>

              <div className="p-3 space-y-2">
                {groupedLeads[status].length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin leads en esta seccion.</p>
                ) : (
                  groupedLeads[status].map((lead) => {
                    const nextAction = getNextLeadAction(lead.status);

                    return (
                      <article
                        key={lead.id}
                        className={`rounded-md border p-3 ${highlightedLeadId === lead.id ? 'bg-amber-50 border-amber-200' : 'bg-background'}`}
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{lead.name || lead.phone}</p>
                            <p className="truncate text-xs text-muted-foreground">{lead.phone}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Ultima interaccion: {formatDate(lead.last_interaction_at)}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusClasses(lead.status)}`}>
                              {lead.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(lead.id, nextAction.next)}
                              disabled={savingByLead[lead.id]}
                              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingByLead[lead.id] ? 'Guardando...' : nextAction.label}
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="text"
                            value={nameDraftByLead[lead.id] ?? ''}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              setNameDraftByLead((prev) => ({ ...prev, [lead.id]: nextValue }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleNameSave(lead.id);
                              }
                            }}
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                            placeholder="Nombre del lead"
                          />
                          <button
                            type="button"
                            onClick={() => void handleNameSave(lead.id)}
                            disabled={savingByLead[lead.id] || (nameDraftByLead[lead.id] ?? '') === (lead.name ?? '')}
                            className="rounded-md border border-input bg-muted px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Guardar
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
