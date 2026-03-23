import { toTimestamp } from './time';

export type UrgencyLevel = 'critical' | 'high' | 'normal' | null;

export function getUrgencyLevel(lastMessageAt?: string | null, nowTs = Date.now()): UrgencyLevel {
  const ts = toTimestamp(lastMessageAt);
  if (!ts) return null;

  const diffMinutes = Math.max(0, Math.floor((nowTs - ts) / 60000));

  if (diffMinutes >= 60) return 'critical';
  if (diffMinutes >= 15) return 'high';
  return 'normal';
}

export function getUrgencyRank(urgency: UrgencyLevel): number {
  if (urgency === 'critical') return 3;
  if (urgency === 'high') return 2;
  if (urgency === 'normal') return 1;
  return 0;
}