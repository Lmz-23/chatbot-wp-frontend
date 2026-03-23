import type { UrgencyLevel } from '@/lib/utils/conversation';

interface ConversationItemProps {
  id: string;
  name: string;
  phone?: string | null;
  lastMessage: string;
  requiresAttention: boolean;
  attentionType: 'customer' | 'bot' | null;
  urgencyLevel: UrgencyLevel;
  attentionText?: string;
  attentionBadgeClassName?: string;
  attentionDotClassName?: string;
  formattedTime: string;
  statusLabel: string;
  statusClassName: string;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: (id: string) => void;
}

export function ConversationItem({
  id,
  name,
  phone,
  lastMessage,
  requiresAttention,
  attentionType,
  urgencyLevel,
  attentionText,
  attentionBadgeClassName,
  attentionDotClassName,
  formattedTime,
  statusLabel,
  statusClassName,
  isSelected,
  isHighlighted,
  onClick
}: ConversationItemProps) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`w-full border-b border-border/50 p-4 text-left transition-colors hover:bg-muted/50 ${
        isSelected ? 'bg-background' : ''
      } ${
        isHighlighted ? 'bg-amber-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">{name}</p>
            {requiresAttention && attentionType === 'customer' && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${attentionBadgeClassName || ''}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${attentionDotClassName || ''}`} />
                {attentionText}
              </span>
            )}
            {requiresAttention && attentionType === 'bot' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Falta agente
              </span>
            )}
          </div>
          {phone && (
            <p className="truncate text-xs text-muted-foreground">{phone}</p>
          )}
          <p className="truncate text-sm text-muted-foreground">{lastMessage}</p>
        </div>
        <p className="text-xs text-muted-foreground whitespace-nowrap">{formattedTime}</p>
      </div>
      <div className="mt-2">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>
    </button>
  );
}
