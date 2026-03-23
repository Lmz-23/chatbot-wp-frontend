'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks';
import { apiClient } from '@/lib/api/apiClient';

interface Message {
  id: string;
  text: string;
  fromMe: boolean;
  senderType: 'customer' | 'bot' | 'agent' | 'unknown';
  direction?: string;
  status?: string;
  from_number?: string;
  to_number?: string;
  created_at?: string;
}

interface Conversation {
  id: string;
  user_phone: string;
  lead_id?: string | null;
  lead_name?: string | null;
  lead_status?: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CLOSED' | null;
  status: 'bot' | 'active' | 'closed';
  last_message_at: string;
  last_message_text?: string;
  last_message_direction?: string;
  last_message_status?: string;
  last_message_sender_type?: 'customer' | 'bot' | 'agent' | 'unknown' | null;
}

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CLOSED';

interface LeadLookupItem {
  id: string;
  name?: string | null;
  status?: LeadStatus | null;
}

function getLeadStatusClasses(status: LeadStatus | null): string {
  if (status === 'NEW') return 'bg-sky-100 text-sky-700 border-sky-200';
  if (status === 'CONTACTED') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (status === 'QUALIFIED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'CLOSED') return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  return 'bg-muted text-muted-foreground border-border';
}

function getLeadStatusLabel(status: LeadStatus | null): string {
  if (!status) return 'Sin estado';
  return status;
}

function getNextLeadAction(status: LeadStatus | null): { label: string; next: LeadStatus } | null {
  if (status === 'NEW') return { label: 'Marcar Contactado', next: 'CONTACTED' };
  if (status === 'CONTACTED') return { label: 'Calificar Lead', next: 'QUALIFIED' };
  if (status === 'QUALIFIED') return { label: 'Cerrar Lead', next: 'CLOSED' };
  if (status === 'CLOSED') return { label: 'Reabrir Lead', next: 'CONTACTED' };
  return { label: 'Marcar Contactado', next: 'CONTACTED' };
}

type LastMessageActor = 'customer' | 'bot' | 'agent' | 'unknown';
type AttentionLevel = 'customer' | 'bot' | null;

function classifyLastMessageActor(params: {
  senderType?: string | null;
  status?: string | null;
  direction?: string | null;
  conversationStatus?: Conversation['status'] | null;
}): LastMessageActor {
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

function getAttentionLevelFromLastMessage(params: {
  senderType?: string | null;
  status?: string | null;
  direction?: string | null;
  conversationStatus?: Conversation['status'] | null;
}): AttentionLevel {
  const actor = classifyLastMessageActor(params);
  if (actor === 'customer') return 'customer';
  if (actor === 'bot') return 'bot';
  return null;
}

function requiresAttentionFromLastMessage(params: {
  senderType?: string | null;
  status?: string | null;
  direction?: string | null;
  conversationStatus?: Conversation['status'] | null;
}): boolean {
  return getAttentionLevelFromLastMessage(params) !== null;
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

// Simple time formatter (HH:MM)
const formatTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const normalizePhone = (value?: string): string => {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
};

const toLeadPhoneKey = (value?: string): string => {
  const digits = normalizePhone(value);
  // WhatsApp numbers can appear as 52XXXXXXXXXX or 521XXXXXXXXXX.
  if (/^521\d{10}$/.test(digits)) {
    return `52${digits.slice(3)}`;
  }
  return digits;
};

const inferSenderType = (
  apiMsg: any,
  conversationPhone?: string
): 'customer' | 'bot' | 'agent' | 'unknown' => {
  const explicit = apiMsg.sender_type;
  if (explicit === 'customer' || explicit === 'bot' || explicit === 'agent' || explicit === 'unknown') {
    return explicit;
  }

  const direction = String(apiMsg.direction || '').toLowerCase();
  const status = String(apiMsg.status || '').toLowerCase();

  if (status.startsWith('agent_')) return 'agent';
  if (direction === 'inbound' || direction === 'incoming') return 'customer';
  if (direction === 'outgoing') return 'agent';
  if (direction === 'outbound') return 'bot';

  const msgFrom = normalizePhone(apiMsg.from_number);
  const msgTo = normalizePhone(apiMsg.to_number);
  const convPhone = normalizePhone(conversationPhone);

  if (convPhone && msgFrom && msgFrom === convPhone) return 'customer';
  if (convPhone && msgTo && msgTo === convPhone) return 'bot';

  return 'unknown';
};

const getStatusLabel = (status: Conversation['status']): string => {
  if (status === 'bot') return 'Bot';
  if (status === 'active') return 'Activo';
  return 'Cerrado';
};

const getStatusClasses = (status: Conversation['status']): string => {
  if (status === 'bot') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (status === 'active') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
};

// Transform API message to UI format
const transformApiMessage = (apiMsg: any, conversationPhone?: string): Message => {
  const senderType = inferSenderType(apiMsg, conversationPhone);
  const fromMe = senderType === 'bot' || senderType === 'agent';

  return {
    id: apiMsg.id,
    text: apiMsg.message_text || apiMsg.body,
    fromMe,
    senderType,
    direction: apiMsg.direction,
    status: apiMsg.status,
    from_number: apiMsg.from_number,
    to_number: apiMsg.to_number,
    created_at: apiMsg.created_at
  };
};

export default function ConversationsPage() {
  const { loading: authLoading } = useAuth();
  const hasLoadedConversationsRef = useRef(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Message[]>>({});
  const [previewByConversation, setPreviewByConversation] = useState<Record<string, string>>({});
  const [draftMessage, setDraftMessage] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadLookupByPhone, setLeadLookupByPhone] = useState<Record<string, LeadLookupItem>>({});
  const [savingLeadStatus, setSavingLeadStatus] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [highlightedConversationId, setHighlightedConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getConversationById = (conversationId: string) =>
    conversations.find((c) => c.id === conversationId);

  const fetchMessages = async (conversationId: string) => {
    const response = await apiClient(`/business/conversations/${conversationId}/messages`);
    if (!response || !response.ok) return [] as Message[];

    const conversation = getConversationById(conversationId);
    const apiMessages = response.messages || [];
    const transformedMessages = apiMessages.map((msg: any) =>
      transformApiMessage(msg, conversation?.user_phone)
    );

    return transformedMessages;
  };

  const enrichConversationsWithLeads = (
    nextConversations: Conversation[],
    nextLeadLookup: Record<string, LeadLookupItem>
  ): Conversation[] => {
    return nextConversations.map((conv) => {
      const fallbackLead = nextLeadLookup[toLeadPhoneKey(conv.user_phone)];
      if (!fallbackLead) return conv;

      return {
        ...conv,
        lead_id: conv.lead_id ?? fallbackLead.id,
        lead_name: conv.lead_name ?? fallbackLead.name ?? null,
        lead_status: conv.lead_status ?? fallbackLead.status ?? null
      };
    });
  };

  // Fetch conversations on mount
  useEffect(() => {
    if (authLoading) return;

    const fetchConversations = async () => {
      const isInitialLoad = !hasLoadedConversationsRef.current;
      try {
        if (isInitialLoad) {
          setLoadingConversations(true);
        }
        const [conversationsResponse, leadsResponse] = await Promise.all([
          apiClient('/business/conversations'),
          apiClient('/business/leads')
        ]);

        if (conversationsResponse && conversationsResponse.ok) {
          const rawConversations = conversationsResponse.conversations || [];

          let nextLeadLookup: Record<string, LeadLookupItem> = leadLookupByPhone;
          if (leadsResponse && leadsResponse.ok && Array.isArray(leadsResponse.leads)) {
            nextLeadLookup = leadsResponse.leads.reduce((acc: Record<string, LeadLookupItem>, lead: any) => {
              const key = toLeadPhoneKey(lead.phone);
              if (!key || !lead.id) return acc;

              acc[key] = {
                id: lead.id,
                name: lead.name ?? null,
                status: lead.status ?? null
              };
              return acc;
            }, {});
            setLeadLookupByPhone(nextLeadLookup);
          }

          const nextConversations = enrichConversationsWithLeads(rawConversations, nextLeadLookup);
          setConversations((prev) => {
            const prevById = new Map(prev.map((item) => [item.id, item]));

            return nextConversations.map((conv) => {
              const previous = prevById.get(conv.id);
              if (!previous) return conv;

              // Preserve known sender/status metadata when the same last message timestamp remains.
              // Some endpoints may omit or format message text differently, so text comparison is unstable.
              const sameLastMessage =
                toTimestamp(previous.last_message_at) > 0
                && toTimestamp(previous.last_message_at) === toTimestamp(conv.last_message_at);

              if (!sameLastMessage) return conv;

              return {
                ...conv,
                last_message_status: conv.last_message_status || previous.last_message_status,
                last_message_sender_type: conv.last_message_sender_type || previous.last_message_sender_type
              };
            });
          });

          const initialPreview: Record<string, string> = {};
          nextConversations.forEach((conv: Conversation) => {
            if (conv.last_message_text) {
              initialPreview[conv.id] = conv.last_message_text;
            }
          });
          setPreviewByConversation(initialPreview);

          // Backfill preview from messages endpoint for conversations without last_message_text.
          const missingPreviewConversations = nextConversations.filter(
            (conv: Conversation) => !conv.last_message_text
          );

          if (missingPreviewConversations.length > 0) {
            Promise.all(
              missingPreviewConversations.map(async (conv: Conversation) => {
                try {
                  const messages = await fetchMessages(conv.id);
                  const last = messages[messages.length - 1];
                  return { id: conv.id, text: last?.text || '' };
                } catch {
                  return { id: conv.id, text: '' };
                }
              })
            ).then((previewList) => {
              setPreviewByConversation((prev) => {
                const next = { ...prev };
                previewList.forEach((item) => {
                  if (item.text) next[item.id] = item.text;
                });
                return next;
              });
            });
          }
        } else {
          setError('No se pudieron cargar las conversaciones');
        }
      } catch (err) {
        if (isInitialLoad) {
          setError('Error al cargar conversaciones');
        }
        console.error('fetch conversations error:', err);
      } finally {
        if (isInitialLoad) {
          setLoadingConversations(false);
          hasLoadedConversationsRef.current = true;
        }
      }
    };

    fetchConversations();

    const intervalId = setInterval(() => {
      fetchConversations();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [authLoading]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversationId, messagesByConversation]);

  // Handle conversation selection - load real messages
  const handleSelectConversation = async (conversationId: string) => {
    setSelectedConversationId(conversationId);

    setLoadingMessages(true);
    try {
      const transformedMessages = await fetchMessages(conversationId);
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: transformedMessages
      }));

      const last = transformedMessages[transformedMessages.length - 1];
      if (last?.text) {
        setPreviewByConversation((prev) => ({
          ...prev,
          [conversationId]: last.text
        }));
      }
    } catch (err) {
      console.error('fetch messages error:', err);
      setError('Error al cargar mensajes');
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: []
      }));
    } finally {
      setLoadingMessages(false);
    }
  };

  // Realtime refresh for selected conversation (polling).
  useEffect(() => {
    if (!selectedConversationId) return;

    const intervalId = setInterval(async () => {
      try {
        const latestMessages = await fetchMessages(selectedConversationId);
        setMessagesByConversation((prev) => {
          const previous = prev[selectedConversationId] || [];
          if (previous.length === latestMessages.length) {
            const prevLast = previous[previous.length - 1]?.id;
            const nextLast = latestMessages[latestMessages.length - 1]?.id;
            if (prevLast === nextLast) return prev;
          }

          return {
            ...prev,
            [selectedConversationId]: latestMessages
          };
        });

        const last = latestMessages[latestMessages.length - 1];
        if (last?.text) {
          setPreviewByConversation((prev) => ({
            ...prev,
            [selectedConversationId]: last.text
          }));

          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === selectedConversationId
                ? {
                    ...conv,
                    last_message_text: last.text,
                    last_message_at: last.created_at || conv.last_message_at,
                    last_message_direction: last.direction || conv.last_message_direction,
                    last_message_status: last.status || conv.last_message_status,
                    last_message_sender_type: last.senderType || conv.last_message_sender_type
                  }
                : conv
            )
          );
        }
      } catch {
        // Silent in background polling
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [selectedConversationId]);

  // Handle message send - real API call
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftMessage.trim() || !selectedConversationId) return;

    const messageText = draftMessage.trim();
    setSendingMessage(true);

    try {
      const response = await apiClient(`/business/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: messageText })
      });

      if (response && response.ok) {
        // Add sent message to state
        const sentMessage: Message = {
          id: response.message.id,
          text: response.message.message_text || response.message.body,
          fromMe: true,
          senderType: 'agent',
          direction: response.message.direction || 'outgoing',
          status: response.message.status || 'agent_sent',
          created_at: response.message.created_at
        };

        setMessagesByConversation((prev) => ({
          ...prev,
          [selectedConversationId]: [...(prev[selectedConversationId] || []), sentMessage]
        }));

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversationId
              ? {
                  ...conv,
                  status: 'active',
                  last_message_text: sentMessage.text,
                  last_message_at: sentMessage.created_at || conv.last_message_at,
                    last_message_direction: sentMessage.direction || 'outgoing',
                    last_message_status: sentMessage.status || 'agent_sent',
                    last_message_sender_type: 'agent'
                }
              : conv
          )
        );

        setPreviewByConversation((prev) => ({
          ...prev,
          [selectedConversationId]: sentMessage.text
        }));

        setDraftMessage('');
      } else {
        setError(`Error al enviar: ${response?.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('send message error:', err);
      setError('Error al enviar el mensaje');
    } finally {
      setSendingMessage(false);
    }
  };

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);
  const selectedConversationFallbackLead = selectedConversation
    ? leadLookupByPhone[toLeadPhoneKey(selectedConversation.user_phone)]
    : null;
  const selectedLeadId = selectedConversation?.lead_id || selectedConversationFallbackLead?.id || null;
  const selectedLeadStatus =
    selectedConversation?.lead_status
    || selectedConversationFallbackLead?.status
    || null;
  const selectedMessages = selectedConversationId ? messagesByConversation[selectedConversationId] || [] : [];
  const selectedAttentionLevel = getAttentionLevelFromLastMessage({
    senderType: selectedConversation?.last_message_sender_type,
    status: selectedConversation?.last_message_status,
    direction: selectedConversation?.last_message_direction,
    conversationStatus: selectedConversation?.status
  });
  const selectedNeedsAttention = selectedAttentionLevel !== null;

  const prioritizedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aAttention = requiresAttentionFromLastMessage({
        senderType: a.last_message_sender_type,
        status: a.last_message_status,
        direction: a.last_message_direction,
        conversationStatus: a.status
      }) ? 1 : 0;
      const bAttention = requiresAttentionFromLastMessage({
        senderType: b.last_message_sender_type,
        status: b.last_message_status,
        direction: b.last_message_direction,
        conversationStatus: b.status
      }) ? 1 : 0;
      if (aAttention !== bAttention) return bAttention - aAttention;

      const tsDiff = toTimestamp(b.last_message_at) - toTimestamp(a.last_message_at);
      if (tsDiff !== 0) return tsDiff;
      return a.id.localeCompare(b.id);
    });
  }, [conversations]);

  const attentionCount = useMemo(
    () => conversations.filter((conv) => requiresAttentionFromLastMessage({
      senderType: conv.last_message_sender_type,
      status: conv.last_message_status,
      direction: conv.last_message_direction,
      conversationStatus: conv.status
    })).length,
    [conversations]
  );

  const handleLeadStatusChange = async (nextStatus: LeadStatus) => {
    if (!selectedConversationId || !selectedLeadId) return;

    const previousStatus = selectedLeadStatus || null;
    setSavingLeadStatus(true);
    setError(null);

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === selectedConversationId
          ? {
              ...conv,
              lead_status: nextStatus
            }
          : conv
      )
    );

    try {
      const response = await apiClient(`/business/leads/${selectedLeadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response || !response.ok || !response.lead) {
        throw new Error('update_lead_status_failed');
      }

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === selectedConversationId
            ? {
                ...conv,
                lead_id: selectedLeadId,
                lead_status: response.lead.status
              }
            : conv
        )
      );

      setLeadLookupByPhone((prev) => {
        const phoneKey = selectedConversation ? toLeadPhoneKey(selectedConversation.user_phone) : '';
        if (!phoneKey) return prev;
        const current = prev[phoneKey] || { id: selectedLeadId };
        return {
          ...prev,
          [phoneKey]: {
            ...current,
            id: selectedLeadId,
            status: response.lead.status
          }
        };
      });

      setHighlightedConversationId(selectedConversationId);
      setToastMessage(`Lead actualizado a ${response.lead.status}`);
      setTimeout(() => setHighlightedConversationId((prev) => (prev === selectedConversationId ? null : prev)), 1600);
      setTimeout(() => setToastMessage(null), 1800);
    } catch (err) {
      console.error('update lead status error:', err);
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === selectedConversationId
            ? {
                ...conv,
                lead_status: previousStatus
              }
            : conv
        )
      );
      setError('No se pudo actualizar el estado del lead');
    } finally {
      setSavingLeadStatus(false);
    }
  };

  const handleAdvanceLeadStatus = async () => {
    const nextAction = getNextLeadAction(selectedLeadStatus);
    if (!nextAction) return;
    await handleLeadStatusChange(nextAction.next);
  };

  const handleConversationStatusChange = async (nextStatus: 'active' | 'closed') => {
    if (!selectedConversationId) return;

    try {
      const response = await apiClient(`/business/conversations/${selectedConversationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response || !response.ok) {
        setError('No se pudo actualizar el estado de la conversación');
        return;
      }

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === selectedConversationId
            ? {
                ...conv,
                status: response.conversation.status,
                last_message_at: response.conversation.last_message_at || conv.last_message_at
              }
            : conv
        )
      );
    } catch (err) {
      console.error('update status error:', err);
      setError('Error al actualizar estado');
    }
  };

  if (authLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="flex h-[100dvh] gap-0">
      {/* Left Column: Conversations List */}
      <div className="w-1/3 border-r border-border bg-muted/30 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Conversations</h2>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
              {attentionCount} por responder
            </span>
            <Link
              href="/"
              className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              Inicio
            </Link>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 text-sm text-destructive">{error}</div>
        )}

        {/* Loading State */}
        {loadingConversations && (
          <div className="p-4 text-sm text-muted-foreground">Cargando...</div>
        )}

        {/* Empty State */}
        {!loadingConversations && conversations.length === 0 && (
          <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
            No hay conversaciones aún
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {prioritizedConversations.map((conv) => (
            (() => {
              const attentionLevel = getAttentionLevelFromLastMessage({
                senderType: conv.last_message_sender_type,
                status: conv.last_message_status,
                direction: conv.last_message_direction,
                conversationStatus: conv.status
              });

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`w-full border-b border-border/50 p-4 text-left transition-colors hover:bg-muted/50 ${
                    selectedConversationId === conv.id ? 'bg-background' : ''
                  } ${
                    highlightedConversationId === conv.id ? 'bg-amber-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{conv.lead_name || conv.user_phone}</p>
                        {attentionLevel === 'customer' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Cliente espera
                          </span>
                        )}
                        {attentionLevel === 'bot' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Falta agente
                          </span>
                        )}
                      </div>
                      {conv.lead_name && (
                        <p className="truncate text-xs text-muted-foreground">{conv.user_phone}</p>
                      )}
                      <p className="truncate text-sm text-muted-foreground">
                        {messagesByConversation[conv.id]?.[messagesByConversation[conv.id].length - 1]?.text
                          || previewByConversation[conv.id]
                          || conv.last_message_text
                          || 'Sin mensajes'}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(conv.last_message_at)}
                    </p>
                  </div>
                  <div className="mt-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusClasses(conv.status)}`}>
                      {getStatusLabel(conv.status)}
                    </span>
                  </div>
                </button>
              );
            })()
          ))}
        </div>
      </div>

      {/* Right Column: Chat */}
      <div className="flex-1 flex flex-col bg-background">
        {/* No Selection State */}
        {!selectedConversationId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Selecciona una conversación
          </div>
        ) : (
          <>
            {/* Chat Header (Sticky) */}
            <div className="sticky top-0 border-b border-border bg-card p-4 z-10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{selectedConversation?.lead_name || selectedConversation?.user_phone}</h3>
                  {selectedConversation?.lead_name && (
                    <p className="text-xs text-muted-foreground">{selectedConversation?.user_phone}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedNeedsAttention && (
                    <>
                      {selectedAttentionLevel === 'customer' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          Cliente espera respuesta
                        </span>
                      )}
                      {selectedAttentionLevel === 'bot' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Bot respondio, falta agente
                        </span>
                      )}
                    </>
                  )}
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusClasses(selectedConversation?.status || 'bot')}`}>
                    {getStatusLabel((selectedConversation?.status || 'bot') as Conversation['status'])}
                  </span>
                  <select
                    value={selectedConversation?.status || 'bot'}
                    onChange={(e) => {
                      const status = e.target.value as 'bot' | 'active' | 'closed';
                      if (status === 'bot') return;
                      handleConversationStatusChange(status);
                    }}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="bot" disabled>Bot (automatico)</option>
                    <option value="active">Activo</option>
                    <option value="closed">Cerrado</option>
                  </select>
                  {selectedLeadId ? (
                    <>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getLeadStatusClasses(selectedLeadStatus)}`}>
                        Lead: {getLeadStatusLabel(selectedLeadStatus)}
                      </span>
                      <button
                        type="button"
                        onClick={handleAdvanceLeadStatus}
                        disabled={savingLeadStatus}
                        className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingLeadStatus ? 'Guardando...' : getNextLeadAction(selectedLeadStatus)?.label}
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

            {toastMessage && (
              <div className="fixed right-4 top-4 z-50 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm">
                {toastMessage}
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="text-sm text-muted-foreground">Cargando mensajes...</div>
              ) : selectedMessages.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sin mensajes</div>
              ) : (
                selectedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                        msg.senderType === 'customer'
                          ? 'bg-muted text-foreground border border-border/50'
                          : msg.senderType === 'bot'
                            ? 'bg-blue-600 text-white'
                            : msg.senderType === 'agent'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-zinc-600 text-white'
                      }`}
                    >
                      <p className="mb-1 text-[10px] uppercase opacity-80 tracking-wide">
                        {msg.senderType === 'customer'
                          ? 'Cliente'
                          : msg.senderType === 'bot'
                            ? 'Bot'
                            : msg.senderType === 'agent'
                              ? 'Agente'
                              : 'Desconocido'}
                      </p>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area (Fixed) */}
            <form
              onSubmit={handleSendMessage}
              className="border-t border-border bg-card p-4"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  disabled={sendingMessage}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!draftMessage.trim() || sendingMessage}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingMessage ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
