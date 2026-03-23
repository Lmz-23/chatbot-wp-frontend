import type { UrgencyLevel } from '@/lib/utils/conversation';
import { ConversationItem } from './ConversationItem';

export interface ConversationListItemData {
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
}

interface ConversationListProps {
  items: ConversationListItemData[];
  emptyStateMessage: string;
  showEmptyState?: boolean;
  onSelectConversation: (id: string) => void;
}

export function ConversationList({
  items,
  emptyStateMessage,
  showEmptyState = true,
  onSelectConversation
}: ConversationListProps) {
  if (items.length === 0 && showEmptyState) {
    return (
      <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
        {emptyStateMessage}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {items.map((item) => (
        <ConversationItem
          key={item.id}
          id={item.id}
          name={item.name}
          phone={item.phone}
          lastMessage={item.lastMessage}
          requiresAttention={item.requiresAttention}
          attentionType={item.attentionType}
          urgencyLevel={item.urgencyLevel}
          attentionText={item.attentionText}
          attentionBadgeClassName={item.attentionBadgeClassName}
          attentionDotClassName={item.attentionDotClassName}
          formattedTime={item.formattedTime}
          statusLabel={item.statusLabel}
          statusClassName={item.statusClassName}
          isSelected={item.isSelected}
          isHighlighted={item.isHighlighted}
          onClick={onSelectConversation}
        />
      ))}
    </div>
  );
}
