import type { LeadStatus } from '@/lib/utils/leads';
import { LeadItem, type LeadItemViewModel } from './LeadItem';

interface LeadSectionViewModel {
  status: LeadStatus;
  title: string;
  count: number;
  items: LeadItemViewModel[];
}

interface LeadListProps {
  sections: LeadSectionViewModel[];
  hasAnyLeads: boolean;
  emptyStateMessage: string;
  onAdvanceStatus: (leadId: string, nextStatus: LeadStatus) => void;
  onNameChange: (leadId: string, value: string) => void;
  onSaveName: (leadId: string) => void;
}

export function LeadList({
  sections,
  hasAnyLeads,
  emptyStateMessage,
  onAdvanceStatus,
  onNameChange,
  onSaveName
}: LeadListProps) {
  if (!hasAnyLeads) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyStateMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.status} className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
            <h2 className="font-medium">{section.title}</h2>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
              {section.count}
            </span>
          </div>

          <div className="p-3 space-y-2">
            {section.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin leads en esta seccion.</p>
            ) : (
              section.items.map((item) => (
                <LeadItem
                  key={item.id}
                  item={item}
                  onAdvanceStatus={onAdvanceStatus}
                  onNameChange={onNameChange}
                  onSaveName={onSaveName}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
