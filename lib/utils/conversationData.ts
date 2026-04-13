export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CLOSED';

export interface LeadLookupItem {
  id: string;
  name?: string | null;
  status?: LeadStatus | null;
}

export interface LeadSourceItem {
  id?: string;
  phone?: string;
  name?: string | null;
  status?: LeadStatus | null;
}

export interface ConversationLeadAware {
  id: string;
  user_phone: string;
  lead_id?: string | null;
  lead_name?: string | null;
  lead_status?: LeadStatus | null;
  last_message_text?: string;
  last_message_at: string;
  last_message_created_at?: string | null;
  last_message_status?: string;
  last_message_sender_type?: 'customer' | 'bot' | 'agent' | 'unknown' | null;
}

/**
 * Normaliza un telefono a solo digitos para matching de identidad.
 * @param {string | undefined} value - Telefono potencialmente formateado.
 * @returns {string} Telefono reducido a digitos.
 */
export function normalizePhone(value?: string): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

/**
 * Convierte telefono a key de lookup de leads con ajuste 521->52 para Mexico.
 * @param {string | undefined} value - Telefono a convertir.
 * @returns {string} Clave normalizada para mapas por telefono.
 */
export function toLeadPhoneKey(value?: string): string {
  const digits = normalizePhone(value);
  if (/^521\d{10}$/.test(digits)) {
    return `52${digits.slice(3)}`;
  }
  return digits;
}

/**
 * Construye lookup por telefono de leads para enrich de conversaciones.
 * @param {LeadSourceItem[]} leads - Leads crudos de API.
 * @returns {Record<string, LeadLookupItem>} Mapa por telefono normalizado.
 */
export function buildLeadLookupByPhone(leads: LeadSourceItem[]): Record<string, LeadLookupItem> {
  return leads.reduce((acc: Record<string, LeadLookupItem>, lead) => {
    const key = toLeadPhoneKey(lead.phone);
    if (!key || !lead.id) return acc;

    acc[key] = {
      id: lead.id,
      name: lead.name ?? null,
      status: lead.status ?? null
    };
    return acc;
  }, {});
}

/**
 * Enriquce conversaciones con datos de lead cuando faltan en el payload principal.
 * @param {T[]} conversations - Conversaciones base.
 * @param {Record<string, LeadLookupItem>} leadLookup - Lookup por telefono.
 * @returns {T[]} Conversaciones enriquecidas.
 */
export function enrichConversationsWithLeads<T extends ConversationLeadAware>(
  conversations: T[],
  leadLookup: Record<string, LeadLookupItem>
): T[] {
  return conversations.map((conv) => {
    const fallbackLead = leadLookup[toLeadPhoneKey(conv.user_phone)];
    if (!fallbackLead) return conv;

    return {
      ...conv,
      lead_id: conv.lead_id ?? fallbackLead.id,
      lead_name: conv.lead_name ?? fallbackLead.name ?? null,
      lead_status: conv.lead_status ?? fallbackLead.status ?? null
    };
  });
}

/**
 * Preserva metadata de sender/status cuando no cambia el ultimo mensaje.
 * @param {T[]} previous - Snapshot previo.
 * @param {T[]} next - Snapshot nuevo.
 * @param {(conversation: T) => number} getLastMessageTimestamp - Funcion para resolver timestamp comparable.
 * @returns {T[]} Conversaciones reconciliadas.
 */
export function mergeConversationsKeepingLastMessageMeta<T extends ConversationLeadAware>(
  previous: T[],
  next: T[],
  getLastMessageTimestamp: (conversation: T) => number
): T[] {
  const prevById = new Map(previous.map((item) => [item.id, item]));

  return next.map((conv) => {
    const previousConv = prevById.get(conv.id);
    if (!previousConv) return conv;

    const sameLastMessage =
      getLastMessageTimestamp(previousConv) > 0
      && getLastMessageTimestamp(previousConv) === getLastMessageTimestamp(conv);

    if (!sameLastMessage) return conv;

    return {
      ...conv,
      last_message_status: conv.last_message_status || previousConv.last_message_status,
      last_message_sender_type: conv.last_message_sender_type || previousConv.last_message_sender_type
    };
  });
}

/**
 * Construye el mapa de previews iniciales usando ultimo texto conocido.
 * @param {Array<{ id: string, last_message_text?: string }>} conversations - Conversaciones de entrada.
 * @returns {Record<string, string>} Mapa de preview por id de conversacion.
 */
export function buildPreviewByConversation(
  conversations: Array<{ id: string; last_message_text?: string }>
): Record<string, string> {
  const preview: Record<string, string> = {};
  conversations.forEach((conv) => {
    if (conv.last_message_text) preview[conv.id] = conv.last_message_text;
  });
  return preview;
}