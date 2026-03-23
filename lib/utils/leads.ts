export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CLOSED';
export type ConversationStatus = 'bot' | 'active' | 'closed';
export type LastMessageActor = 'customer' | 'bot' | 'agent' | 'unknown';
export type AttentionLevel = 'customer' | 'bot' | null;
export type UrgencyLevel = 'critical' | 'high' | 'normal' | null;

export { classifyLastMessageActor, getAttentionLevelFromLastMessage } from './shared/attention';
export { toTimestamp, formatShortWaitTime } from './shared/time';
export { getUrgencyLevel, getUrgencyRank } from './shared/sorting';
import {
  getAttentionLevelFromLastMessage,
  getUrgencyLevel,
  getUrgencyRank,
  toTimestamp
} from './shared';

export interface Lead {
  id: string;
  phone: string;
  name: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  last_interaction_at: string;
}

export interface ConversationSummary {
  id: string;
  lead_id?: string | null;
  status?: ConversationStatus;
  last_message_sender_type?: 'customer' | 'bot' | 'agent' | 'unknown' | null;
  last_message_status?: string | null;
  last_message_direction?: string;
  last_message_created_at?: string | null;
  last_message_at?: string;
}

export interface AttentionMeta {
  attentionLevel: AttentionLevel;
  urgencyLevel: UrgencyLevel;
  responseTimeTimestamp: number;
  isReopened: boolean;
}

export const STATUS_OPTIONS: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'];

export const STATUS_TITLES: Record<LeadStatus, string> = {
  NEW: 'Nuevos',
  CONTACTED: 'Contactados',
  QUALIFIED: 'Calificados',
  CLOSED: 'Cerrados'
};

export function getStatusClasses(status: LeadStatus): string {
  if (status === 'NEW') return 'bg-sky-100 text-sky-700 border-sky-200';
  if (status === 'CONTACTED') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (status === 'QUALIFIED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

export function getNextLeadAction(status: LeadStatus): { label: string; next: LeadStatus } {
  if (status === 'NEW') return { label: 'Marcar Contactado', next: 'CONTACTED' };
  if (status === 'CONTACTED') return { label: 'Calificar', next: 'QUALIFIED' };
  if (status === 'QUALIFIED') return { label: 'Cerrar', next: 'CLOSED' };
  return { label: 'Reabrir', next: 'CONTACTED' };
}

export function getConversationResponseTimestamp(conversation?: ConversationSummary): number {
  if (!conversation) return 0;
  return toTimestamp(conversation.last_message_created_at || conversation.last_message_at);
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

export function formatDate(dateString?: string): string {
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

export function sortLeadsByPriority(leads: Lead[], attentionMetaByLeadId: Record<string, AttentionMeta>): Lead[] {
  return [...leads].sort((a, b) => {
    const aMeta = attentionMetaByLeadId[a.id];
    const bMeta = attentionMetaByLeadId[b.id];
    const aAttention = aMeta?.attentionLevel ? 1 : 0;
    const bAttention = bMeta?.attentionLevel ? 1 : 0;
    if (aAttention !== bAttention) return bAttention - aAttention;

    const aUrgencyRank = getUrgencyRank(aMeta?.urgencyLevel || null);
    const bUrgencyRank = getUrgencyRank(bMeta?.urgencyLevel || null);
    if (aUrgencyRank !== bUrgencyRank) return bUrgencyRank - aUrgencyRank;

    const aResponseTs = aMeta?.responseTimeTimestamp || 0;
    const bResponseTs = bMeta?.responseTimeTimestamp || 0;
    if (aResponseTs !== bResponseTs) return bResponseTs - aResponseTs;

    const aTs = toTimestamp(a.last_interaction_at || a.updated_at || a.created_at);
    const bTs = toTimestamp(b.last_interaction_at || b.updated_at || b.created_at);
    if (aTs !== bTs) return bTs - aTs;
    return a.id.localeCompare(b.id);
  });
}
