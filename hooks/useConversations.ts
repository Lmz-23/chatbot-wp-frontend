'use client';

import { useEffect, useState } from 'react';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { useConversationDataLoader } from '@/hooks/internal/useConversationDataLoader';
import { useConversationLeadActions } from '@/hooks/internal/useConversationLeadActions';
import { useConversationActions } from '@/hooks/internal/useConversationActions';
import { useConversationPresentation, type SelectedHeaderData } from '@/hooks/internal/useConversationPresentation';
import { type ConversationStatus } from '@/lib/utils/conversation';
import {
  type LeadLookupItem,
  type LeadStatus
} from '@/lib/utils/conversationData';

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

interface UseConversationsParams {
  authLoading: boolean;
}

/**
 * Orquesta estado de conversaciones, mensajes, estado de lead y acciones de operador.
 * @param {{ authLoading: boolean }} param0 - Estado de autenticacion para gatear carga inicial.
 * @returns {object} Estado agregado y handlers para la UI de conversaciones.
 */
export function useConversations({ authLoading }: UseConversationsParams) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [previewByConversation, setPreviewByConversation] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [leadLookupByPhone, setLeadLookupByPhone] = useState<Record<string, LeadLookupItem>>({});
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

  const {
    loadingConversations,
    fetchConversations
  } = useConversationDataLoader<Conversation>({
    leadLookupByPhone,
    setLeadLookupByPhone,
    setConversations,
    setPreviewByConversation,
    setError,
    fetchMessages
  });

  const {
    savingLeadStatus,
    selectedConversation,
    selectedLeadId,
    selectedLeadStatus,
    getLeadStatusClasses,
    getLeadStatusLabel,
    getNextLeadAction,
    advanceLeadStatus
  } = useConversationLeadActions({
    conversations,
    selectedConversationId,
    leadLookupByPhone,
    setConversations,
    setLeadLookupByPhone,
    setError,
    setHighlightedConversationId,
    setToastMessage
  });

  const {
    selectConversation,
    clearSelectedConversation,
    sendMessage,
    updateConversationStatus
  } = useConversationActions<Conversation>({
    selectedConversationId,
    setSelectedConversationId,
    setPreviewByConversation,
    setConversations,
    setError,
    loadMessagesForConversation,
    sendConversationMessage
  });

  const {
    attentionCount,
    conversationListItems,
    selectedHeaderData
  } = useConversationPresentation({
    conversations,
    selectedConversationId,
    selectedConversation,
    selectedLeadId,
    selectedLeadStatus,
    savingLeadStatus,
    highlightedConversationId,
    messagesByConversation,
    previewByConversation,
    getLeadStatusClasses,
    getLeadStatusLabel,
    getNextLeadAction
  });

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