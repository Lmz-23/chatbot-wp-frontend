'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import { type ConversationListItemData } from '@/components/conversations/ConversationList';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import {
  formatTime,
  formatShortWaitTime,
  getAttentionLevelFromLastMessage,
  getConversationLastMessageTimestamp,
  getCustomerUrgencyBadgeClasses,
  getCustomerUrgencyDotClass,
  getCustomerUrgencyFromConversation,
  requiresAttentionFromLastMessage,
  sortConversationsByPriority,
  type ConversationStatus
} from '@/lib/utils/conversation';

interface Conversation {
  id: string;
  user_phone: string;
  lead_id?: string | null;
  lead_name?: string | null;
  lead_status?: LeadStatus | null;
  status: ConversationStatus;
  last_message_at: string;
  last_message_text?: string;
  last_message_direction?: string;
  last_message_status?: string;
  last_message_sender_type?: 'customer' | 'bot' | 'agent' | 'unknown' | null;
  last_message_created_at?: string | null;
}

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CLOSED';

interface LeadLookupItem {
  id: string;
  name?: string | null;
  status?: LeadStatus | null;
}

interface HeaderBadge {
  text: string;
  className: string;
  dotClassName: string;
}

interface SelectedHeaderData {
  title: string;
  subtitle: string | null;
  attentionBadge: HeaderBadge | null;
  statusLabel: string;
  statusClassName: string;
  selectedStatus: 'bot' | 'active' | 'closed';
  showLeadReactivated: boolean;
  hasLead: boolean;
  leadStatusLabel: string;
  leadStatusClassName: string;
  leadActionLabel: string | undefined;
  leadActionDisabled: boolean;
}

interface UseConversationsParams {
  authLoading: boolean;
}

const normalizePhone = (value?: string): string => {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
};

const toLeadPhoneKey = (value?: string): string => {
  const digits = normalizePhone(value);
  if (/^521\d{10}$/.test(digits)) {
    return `52${digits.slice(3)}`;
  }
  return digits;
};

const getStatusLabel = (status: ConversationStatus): string => {
  if (status === 'bot') return 'Bot';
  if (status === 'active') return 'Activo';
  return 'Cerrado';
};

const getStatusClasses = (status: ConversationStatus): string => {
  if (status === 'bot') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (status === 'active') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
};

export function useConversations({ authLoading }: UseConversationsParams) {
  const hasLoadedConversationsRef = useRef(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [previewByConversation, setPreviewByConversation] = useState<Record<string, string>>({});
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leadLookupByPhone, setLeadLookupByPhone] = useState<Record<string, LeadLookupItem>>({});
  const [savingLeadStatus, setSavingLeadStatus] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [highlightedConversationId, setHighlightedConversationId] = useState<string | null>(null);

  const getConversationById = (conversationId: string) =>
    conversations.find((c) => c.id === conversationId);

  // Synchronizes list-level last message metadata from message hook updates.
  const onConversationLastMessageSync = (
    conversationId: string,
    patch: {
      last_message_text?: string;
      last_message_at?: string;
      last_message_created_at?: string;
      last_message_direction?: string;
      last_message_status?: string;
      last_message_sender_type?: 'customer' | 'bot' | 'agent' | 'unknown';
      status?: 'bot' | 'active' | 'closed';
    }
  ) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              status: patch.status || conv.status,
              last_message_text: patch.last_message_text || conv.last_message_text,
              last_message_at: patch.last_message_at || conv.last_message_at,
              last_message_created_at: patch.last_message_created_at || conv.last_message_created_at,
              last_message_direction: patch.last_message_direction || conv.last_message_direction,
              last_message_status: patch.last_message_status || conv.last_message_status,
              last_message_sender_type: patch.last_message_sender_type || conv.last_message_sender_type
            }
          : conv
      )
    );

    if (patch.last_message_text) {
      setPreviewByConversation((prev) => ({
        ...prev,
        [conversationId]: patch.last_message_text as string
      }));
    }
  };

  const {
    messagesByConversation,
    selectedMessages,
    loadingMessages,
    sendingMessage,
    fetchMessages,
    loadMessagesForConversation,
    sendMessage: sendConversationMessage
  } = useConversationMessages({
    selectedConversationId,
    conversationPhoneById: (conversationId) => getConversationById(conversationId)?.user_phone,
    onConversationLastMessageSync,
    onError: setError,
    pollIntervalMs: 5000
  });

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

  // Loads conversations + leads snapshot and stitches fallback lead data by normalized phone.
  const fetchConversations = async () => {
    const isInitialLoad = !hasLoadedConversationsRef.current;
    try {
      if (isInitialLoad) setLoadingConversations(true);

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

            const sameLastMessage =
              getConversationLastMessageTimestamp(previous) > 0
              && getConversationLastMessageTimestamp(previous) === getConversationLastMessageTimestamp(conv);

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
          if (conv.last_message_text) initialPreview[conv.id] = conv.last_message_text;
        });
        setPreviewByConversation(initialPreview);

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
      if (isInitialLoad) setError('Error al cargar conversaciones');
      console.error('fetch conversations error:', err);
    } finally {
      if (isInitialLoad) {
        setLoadingConversations(false);
        hasLoadedConversationsRef.current = true;
      }
    }
  };

  const getLeadStatusClasses = (status: LeadStatus | null): string => {
    if (status === 'NEW') return 'bg-sky-100 text-sky-700 border-sky-200';
    if (status === 'CONTACTED') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (status === 'QUALIFIED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'CLOSED') return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    return 'bg-muted text-muted-foreground border-border';
  };

  const getLeadStatusLabel = (status: LeadStatus | null): string => {
    if (!status) return 'Sin estado';
    return status;
  };

  const getNextLeadAction = (status: LeadStatus | null): { label: string; next: LeadStatus } | null => {
    if (status === 'NEW') return { label: 'Marcar Contactado', next: 'CONTACTED' };
    if (status === 'CONTACTED') return { label: 'Calificar Lead', next: 'QUALIFIED' };
    if (status === 'QUALIFIED') return { label: 'Cerrar Lead', next: 'CLOSED' };
    if (status === 'CLOSED') return { label: 'Reabrir Lead', next: 'CONTACTED' };
    return { label: 'Marcar Contactado', next: 'CONTACTED' };
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

  const updateLeadStatus = async (nextStatus: LeadStatus) => {
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

  const advanceLeadStatus = async () => {
    const nextAction = getNextLeadAction(selectedLeadStatus);
    if (!nextAction) return;
    await updateLeadStatus(nextAction.next);
  };

  const selectConversation = async (conversationId: string) => {
    setSelectedConversationId(conversationId);

    const transformedMessages = await loadMessagesForConversation(conversationId);
    const last = transformedMessages[transformedMessages.length - 1];
    if (last?.text) {
      setPreviewByConversation((prev) => ({
        ...prev,
        [conversationId]: last.text
      }));
    }
  };

  const clearSelectedConversation = () => {
    setSelectedConversationId(null);
  };

  const sendMessage = async (text: string) => {
    const ok = await sendConversationMessage(text);
    if (ok && selectedConversationId && text.trim()) {
      setPreviewByConversation((prev) => ({
        ...prev,
        [selectedConversationId]: text.trim()
      }));
    }
    return ok;
  };

  const updateConversationStatus = async (nextStatus: 'active' | 'closed') => {
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

  const selectedAttentionLevel = getAttentionLevelFromLastMessage({
    senderType: selectedConversation?.last_message_sender_type,
    status: selectedConversation?.last_message_status,
    direction: selectedConversation?.last_message_direction,
    conversationStatus: selectedConversation?.status
  });
  const selectedLastMessageInbound = selectedAttentionLevel === 'customer';
  const selectedLeadReactivated = selectedLeadStatus === 'CONTACTED' && selectedLastMessageInbound;
  const selectedUrgencyLevel = selectedConversation
    ? getCustomerUrgencyFromConversation(selectedConversation, selectedAttentionLevel)
    : null;
  const selectedWaitText = selectedConversation
    ? formatShortWaitTime(selectedConversation.last_message_created_at || selectedConversation.last_message_at)
    : '';

  const prioritizedConversations = useMemo(() => sortConversationsByPriority(conversations), [conversations]);

  const buildConversationListItem = (conv: Conversation): ConversationListItemData => {
    const attentionLevel = getAttentionLevelFromLastMessage({
      senderType: conv.last_message_sender_type,
      status: conv.last_message_status,
      direction: conv.last_message_direction,
      conversationStatus: conv.status
    });
    const customerUrgency = getCustomerUrgencyFromConversation(conv, attentionLevel);
    const waitTime = attentionLevel === 'customer'
      ? formatShortWaitTime(conv.last_message_created_at || conv.last_message_at)
      : '';

    return {
      id: conv.id,
      name: conv.lead_name || conv.user_phone,
      phone: conv.lead_name ? conv.user_phone : null,
      lastMessage:
        messagesByConversation[conv.id]?.[messagesByConversation[conv.id].length - 1]?.text
        || previewByConversation[conv.id]
        || conv.last_message_text
        || 'Sin mensajes',
      requiresAttention: attentionLevel !== null,
      attentionType: attentionLevel,
      urgencyLevel: customerUrgency,
      attentionText: attentionLevel === 'customer' ? `Cliente espera${waitTime ? ` · ${waitTime}` : ''}` : undefined,
      attentionBadgeClassName: attentionLevel === 'customer' ? getCustomerUrgencyBadgeClasses(customerUrgency) : undefined,
      attentionDotClassName: attentionLevel === 'customer' ? getCustomerUrgencyDotClass(customerUrgency) : undefined,
      formattedTime: formatTime(conv.last_message_created_at || conv.last_message_at),
      statusLabel: getStatusLabel(conv.status),
      statusClassName: getStatusClasses(conv.status),
      isSelected: selectedConversationId === conv.id,
      isHighlighted: highlightedConversationId === conv.id
    };
  };

  const conversationListItems = useMemo<ConversationListItemData[]>(
    () => prioritizedConversations.map(buildConversationListItem),
    [messagesByConversation, previewByConversation, highlightedConversationId, prioritizedConversations, selectedConversationId]
  );

  const selectedAttentionBadge = useMemo<HeaderBadge | null>(() => {
    if (selectedAttentionLevel === 'customer') {
      return {
        text: `Cliente espera${selectedWaitText ? ` · ${selectedWaitText}` : ''}`,
        className: getCustomerUrgencyBadgeClasses(selectedUrgencyLevel),
        dotClassName: getCustomerUrgencyDotClass(selectedUrgencyLevel)
      };
    }

    if (selectedAttentionLevel === 'bot') {
      return {
        text: 'Bot respondio, falta agente',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
        dotClassName: 'bg-amber-500'
      };
    }

    return null;
  }, [selectedAttentionLevel, selectedUrgencyLevel, selectedWaitText]);

  const attentionCount = useMemo(
    () => conversations.filter((conv) => requiresAttentionFromLastMessage({
      senderType: conv.last_message_sender_type,
      status: conv.last_message_status,
      direction: conv.last_message_direction,
      conversationStatus: conv.status
    })).length,
    [conversations]
  );

  const selectedHeaderData: SelectedHeaderData | null = selectedConversationId
    ? {
        title: selectedConversation?.lead_name || selectedConversation?.user_phone || '',
        subtitle: selectedConversation?.lead_name ? selectedConversation?.user_phone : null,
        attentionBadge: selectedAttentionBadge,
        statusLabel: getStatusLabel((selectedConversation?.status || 'bot') as ConversationStatus),
        statusClassName: getStatusClasses((selectedConversation?.status || 'bot') as ConversationStatus),
        selectedStatus: (selectedConversation?.status || 'bot') as 'bot' | 'active' | 'closed',
        showLeadReactivated: selectedLeadReactivated,
        hasLead: !!selectedLeadId,
        leadStatusLabel: `Lead: ${getLeadStatusLabel(selectedLeadStatus)}`,
        leadStatusClassName: getLeadStatusClasses(selectedLeadStatus),
        leadActionLabel: savingLeadStatus ? 'Guardando...' : getNextLeadAction(selectedLeadStatus)?.label,
        leadActionDisabled: savingLeadStatus
      }
    : null;

  useEffect(() => {
    if (authLoading) return;

    fetchConversations();
    const intervalId = setInterval(fetchConversations, 5000);

    return () => clearInterval(intervalId);
  }, [authLoading]);

  return {
    loadingConversations,
    loadingMessages,
    sendingMessage,
    savingLeadStatus,
    error,
    toastMessage,
    attentionCount,
    selectedConversationId,
    selectedMessages,
    conversationListItems,
    selectedHeaderData,
    selectConversation,
    clearSelectedConversation,
    sendMessage,
    updateConversationStatus,
    advanceLeadStatus
  };
}