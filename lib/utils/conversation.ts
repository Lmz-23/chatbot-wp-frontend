export type LastMessageActor = 'customer' | 'bot' | 'agent' | 'unknown';
export type AttentionLevel = 'customer' | 'bot' | null;
export type UrgencyLevel = 'critical' | 'high' | 'normal' | null;
export type ConversationStatus = 'bot' | 'active' | 'closed';

export {
  classifyLastMessageActor,
  getAttentionLevelFromLastMessage,
  requiresAttentionFromLastMessage
} from './shared/attention';
export { toTimestamp, formatShortWaitTime } from './shared/time';
export { getUrgencyLevel, getUrgencyRank } from './shared/sorting';
import {
  getAttentionLevelFromLastMessage,
  getUrgencyLevel,
  getUrgencyRank,
  toTimestamp
} from './shared';

export interface LastMessageContext {
  senderType?: string | null;
  status?: string | null;
  direction?: string | null;
  conversationStatus?: ConversationStatus | null;
}

export interface ConversationPriorityInput {
  id: string;
  status: ConversationStatus;
  last_message_at: string;
  last_message_created_at?: string | null;
  last_message_direction?: string;
  last_message_status?: string;
  last_message_sender_type?: 'customer' | 'bot' | 'agent' | 'unknown' | null;
}

export function getConversationLastMessageTimestamp(conversation?: ConversationPriorityInput | null): number {
  if (!conversation) return 0;
  return toTimestamp(conversation.last_message_created_at || conversation.last_message_at);
}

export function getCustomerUrgencyFromConversation(
  conversation: ConversationPriorityInput,
  attentionLevel: AttentionLevel
): UrgencyLevel {
  if (attentionLevel !== 'customer') return null;
  return getUrgencyLevel(conversation.last_message_created_at || conversation.last_message_at);
}

export function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function getCustomerUrgencyBadgeClasses(urgency: UrgencyLevel): string {
  if (urgency === 'critical') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (urgency === 'high') return 'border-orange-200 bg-orange-50 text-orange-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export function getCustomerUrgencyDotClass(urgency: UrgencyLevel): string {
  if (urgency === 'critical') return 'bg-rose-500';
  if (urgency === 'high') return 'bg-orange-500';
  return 'bg-amber-500';
}

export function sortConversationsByPriority<T extends ConversationPriorityInput>(conversations: T[]): T[] {
  return [...conversations].sort((a, b) => {
    const aLevel = getAttentionLevelFromLastMessage({
      senderType: a.last_message_sender_type,
      status: a.last_message_status,
      direction: a.last_message_direction,
      conversationStatus: a.status
    });
    const bLevel = getAttentionLevelFromLastMessage({
      senderType: b.last_message_sender_type,
      status: b.last_message_status,
      direction: b.last_message_direction,
      conversationStatus: b.status
    });

    const aRequiresAttention = aLevel !== null ? 1 : 0;
    const bRequiresAttention = bLevel !== null ? 1 : 0;
    if (aRequiresAttention !== bRequiresAttention) return bRequiresAttention - aRequiresAttention;

    const aUrgency = getCustomerUrgencyFromConversation(a, aLevel);
    const bUrgency = getCustomerUrgencyFromConversation(b, bLevel);
    const urgencyDiff = getUrgencyRank(bUrgency) - getUrgencyRank(aUrgency);
    if (urgencyDiff !== 0) return urgencyDiff;

    const tsDiff = getConversationLastMessageTimestamp(b) - getConversationLastMessageTimestamp(a);
    if (tsDiff !== 0) return tsDiff;
    return a.id.localeCompare(b.id);
  });
}
