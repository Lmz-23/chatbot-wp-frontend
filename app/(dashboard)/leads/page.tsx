'use client';

import Link from 'next/link';
import { LeadList } from '@/components/leads/LeadList';
import { useLeads } from '@/hooks';
import type { LeadStatus } from '@/lib/utils/leads';

export default function LeadsPage() {
  const {
    loading,
    error,
    toastMessage,
    onlyPending,
    selectedCategory,
    searchQuery,
    hasAnyLeads,
    sections,
    setOnlyPending,
    setSelectedCategory,
    setSearchQuery,
    setLeadNameDraft,
    saveLeadName,
    advanceLeadStatus
  } = useLeads();

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
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as 'ALL' | LeadStatus)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm md:w-44"
          >
            <option value="ALL">Todas las categorias</option>
            <option value="NEW">Nuevos</option>
            <option value="CONTACTED">Contactados</option>
            <option value="QUALIFIED">Calificados</option>
            {!onlyPending && <option value="CLOSED">Cerrados</option>}
          </select>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o telefono"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm md:max-w-xs"
          />
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {toastMessage && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {toastMessage}
        </div>
      )}

      <LeadList
        sections={sections}
        hasAnyLeads={hasAnyLeads}
        emptyStateMessage="No hay leads todavía."
        onAdvanceStatus={advanceLeadStatus}
        onNameChange={setLeadNameDraft}
        onSaveName={saveLeadName}
      />
    </main>
  );
}
