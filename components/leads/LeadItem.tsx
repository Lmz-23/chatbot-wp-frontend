import type { LeadStatus, UrgencyLevel } from '@/lib/utils/leads';

export interface LeadItemViewModel {
  id: string;
  nameOrPhone: string;
  phone: string;
  status: LeadStatus;
  statusClassName: string;
  lastInteractionLabel: string;
  attentionLevel: 'customer' | 'bot' | null;
  urgencyLevel: UrgencyLevel;
  waitText: string;
  urgencyBadgeClassName: string;
  urgencyDotClassName: string;
  isReopened: boolean;
  nextActionLabel: string;
  nextActionStatus: LeadStatus;
  isSaving: boolean;
  isHighlighted: boolean;
  nameDraft: string;
  canSaveName: boolean;
}

interface LeadItemProps {
  item: LeadItemViewModel;
  onAdvanceStatus: (leadId: string, nextStatus: LeadStatus) => void;
  onNameChange: (leadId: string, value: string) => void;
  onSaveName: (leadId: string) => void;
}

export function LeadItem({ item, onAdvanceStatus, onNameChange, onSaveName }: LeadItemProps) {
  return (
    <article
      className={`rounded-md border p-3 ${item.isHighlighted ? 'bg-amber-50 border-amber-200' : 'bg-background'}`}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{item.nameOrPhone}</p>
          <p className="truncate text-xs text-muted-foreground">{item.phone}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ultima interaccion: {item.lastInteractionLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${item.statusClassName}`}>
            {item.status}
          </span>
          {item.attentionLevel === 'customer' && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${item.urgencyBadgeClassName}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${item.urgencyDotClassName}`} />
              Cliente espera{item.waitText ? ` · ${item.waitText}` : ''}
            </span>
          )}
          {item.attentionLevel === 'bot' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Falta agente
            </span>
          )}
          {item.isReopened && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Lead reabierto
            </span>
          )}
          <button
            type="button"
            onClick={() => onAdvanceStatus(item.id, item.nextActionStatus)}
            disabled={item.isSaving}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {item.isSaving ? 'Guardando...' : item.nextActionLabel}
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={item.nameDraft}
          onChange={(e) => onNameChange(item.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSaveName(item.id);
            }
          }}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          placeholder="Nombre del lead"
        />
        <button
          type="button"
          onClick={() => onSaveName(item.id)}
          disabled={!item.canSaveName || item.isSaving}
          className="rounded-md border border-input bg-muted px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </article>
  );
}
