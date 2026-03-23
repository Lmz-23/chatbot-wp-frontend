export type LastMessageActor = 'customer' | 'bot' | 'agent' | 'unknown';
export type AttentionLevel = 'customer' | 'bot' | null;

export interface LastMessageContext {
  senderType?: string | null;
  status?: string | null;
  direction?: string | null;
  conversationStatus?: string | null;
}

export function classifyLastMessageActor(params: LastMessageContext): LastMessageActor {
  const senderType = String(params.senderType || '').toLowerCase();
  if (senderType === 'customer' || senderType === 'bot' || senderType === 'agent') {
    return senderType;
  }

  const status = String(params.status || '').toLowerCase();
  if (status.startsWith('agent_')) return 'agent';

  const direction = String(params.direction || '').toLowerCase();
  if (direction === 'inbound' || direction === 'incoming') return 'customer';
  if (direction === 'outgoing') return 'agent';
  if (direction === 'outbound' && params.conversationStatus === 'bot') return 'bot';

  return 'unknown';
}

export function getAttentionLevelFromLastMessage(params: LastMessageContext): AttentionLevel {
  const actor = classifyLastMessageActor(params);
  if (actor === 'customer') return 'customer';
  if (actor === 'bot') return 'bot';
  return null;
}

export function requiresAttentionFromLastMessage(params: LastMessageContext): boolean {
  return getAttentionLevelFromLastMessage(params) !== null;
}