interface ChatHeaderProps {
  title: string;
  subtitle?: string | null;
  attentionBadge?: {
    text: string;
    className: string;
    dotClassName: string;
  } | null;
  statusLabel: string;
  statusClassName: string;
  selectedStatus: 'bot' | 'active' | 'closed';
  onStatusChange: (status: 'active' | 'closed') => void;
  showLeadReactivated: boolean;
  hasLead: boolean;
  leadStatusLabel?: string;
  leadStatusClassName?: string;
  leadActionLabel?: string;
  onLeadAction: () => void;
  leadActionDisabled: boolean;
}

export function ChatHeader({
  title,
  subtitle,
  attentionBadge,
  statusLabel,
  statusClassName,
  selectedStatus,
  onStatusChange,
  showLeadReactivated,
  hasLead,
  leadStatusLabel,
  leadStatusClassName,
  leadActionLabel,
  onLeadAction,
  leadActionDisabled
}: ChatHeaderProps) {
  return (
    <div className="sticky top-0 border-b border-border bg-card p-4 z-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {attentionBadge && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${attentionBadge.className}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${attentionBadge.dotClassName}`} />
              {attentionBadge.text}
            </span>
          )}

          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClassName}`}>
            {statusLabel}
          </span>

          {showLeadReactivated && (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              Lead reactivado
            </span>
          )}

          <select
            value={selectedStatus}
            onChange={(e) => {
              const status = e.target.value as 'bot' | 'active' | 'closed';
              if (status === 'bot') return;
              onStatusChange(status);
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="bot" disabled>Bot (automatico)</option>
            <option value="active">Activo</option>
            <option value="closed">Cerrado</option>
          </select>

          {hasLead ? (
            <>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${leadStatusClassName || ''}`}>
                {leadStatusLabel}
              </span>
              <button
                type="button"
                onClick={onLeadAction}
                disabled={leadActionDisabled}
                className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {leadActionLabel}
              </button>
            </>
          ) : (
            <span className="rounded-md border border-dashed border-input px-2 py-1 text-xs text-muted-foreground">
              Sin lead
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
