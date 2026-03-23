export function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

export function formatShortWaitTime(value?: string | null): string {
  const ts = toTimestamp(value);
  if (!ts) return '';

  const diffMinutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMinutes >= 60) return `${Math.floor(diffMinutes / 60)}h`;
  return `${Math.max(1, diffMinutes)}m`;
}