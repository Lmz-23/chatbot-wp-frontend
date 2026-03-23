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
  const [savingByLead, setSavingByLead] = useState<Record<string, boolean>>({});
  const [nameDraftByLead, setNameDraftByLead] = useState<Record<string, string>>({});

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
    previousLead: Lead
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
    } finally {
      setSavingByLead((prev) => ({ ...prev, [leadId]: false }));
    }
  };

  const handleNameSave = (leadId: string) => {
    const currentLead = leadsById[leadId];
    if (!currentLead) return;

    const draftName = nameDraftByLead[leadId] ?? '';
    const currentName = currentLead.name ?? '';
    if (draftName === currentName) return;

    patchLead(leadId, { name: draftName === '' ? null : draftName }, currentLead);
  };

  const handleStatusChange = (leadId: string, nextStatus: LeadStatus) => {
    const currentLead = leadsById[leadId];
    if (!currentLead) return;

    if (currentLead.status === nextStatus) return;

    const optimisticLead: Lead = { ...currentLead, status: nextStatus };
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? optimisticLead : lead)));
    patchLead(leadId, { status: nextStatus }, currentLead);
  };

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

      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {leads.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay leads todavía.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] table-fixed text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="w-[24%] px-3 py-2 font-medium">Lead</th>
                <th className="w-[28%] px-3 py-2 font-medium">Nombre</th>
                <th className="w-[16%] px-3 py-2 font-medium">Estado</th>
                <th className="w-[16%] px-3 py-2 font-medium">Ultima interaccion</th>
                <th className="w-[16%] px-3 py-2 font-medium">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="truncate font-medium">{lead.name || lead.phone}</div>
                    <div className="truncate text-xs text-muted-foreground">{lead.phone}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
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
                            handleNameSave(lead.id);
                          }
                        }}
                        className="w-full rounded-md border border-input bg-background px-2 py-1"
                        placeholder="Nombre del lead"
                      />
                      <button
                        type="button"
                        onClick={() => handleNameSave(lead.id)}
                        disabled={savingByLead[lead.id] || (nameDraftByLead[lead.id] ?? '') === (lead.name ?? '')}
                        className="rounded-md border border-input bg-muted px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Guardar
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                      className="rounded-md border border-input bg-background px-2 py-1"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="truncate px-3 py-2">{formatDate(lead.last_interaction_at)}</td>
                  <td className="px-3 py-2">
                    <span className="truncate">{savingByLead[lead.id] ? 'Guardando...' : formatDate(lead.updated_at)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
