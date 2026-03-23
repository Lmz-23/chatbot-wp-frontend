'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';

export interface ConversationMessage {
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

interface LastMessageSyncPatch {
  last_message_text?: string;
  last_message_at?: string;
  last_message_created_at?: string;
  last_message_direction?: string;
  last_message_status?: string;
  last_message_sender_type?: 'customer' | 'bot' | 'agent' | 'unknown';
  status?: 'bot' | 'active' | 'closed';
}

interface UseConversationMessagesParams {
  selectedConversationId: string | null;
  conversationPhoneById: (conversationId: string) => string | undefined;
  onConversationLastMessageSync: (conversationId: string, patch: LastMessageSyncPatch) => void;
  onError: (message: string) => void;
  pollIntervalMs?: number;
}

const normalizePhone = (value?: string): string => {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
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

const transformApiMessage = (apiMsg: any, conversationPhone?: string): ConversationMessage => {
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

export function useConversationMessages({
  selectedConversationId,
  conversationPhoneById,
  onConversationLastMessageSync,
  onError,
  pollIntervalMs = 5000
}: UseConversationMessagesParams) {
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ConversationMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const fetchMessages = async (conversationId: string) => {
    const response = await apiClient(`/business/conversations/${conversationId}/messages`);
    if (!response || !response.ok) return [] as ConversationMessage[];

    const conversationPhone = conversationPhoneById(conversationId);
    const apiMessages = response.messages || [];
    return apiMessages.map((msg: any) => transformApiMessage(msg, conversationPhone));
  };

  const loadMessagesForConversation = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const transformedMessages = await fetchMessages(conversationId);
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: transformedMessages
      }));

      return transformedMessages;
    } catch (err) {
      console.error('fetch messages error:', err);
      onError('Error al cargar mensajes');
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: []
      }));
      return [] as ConversationMessage[];
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !selectedConversationId) return false;

    const messageText = text.trim();
    setSendingMessage(true);

    try {
      const response = await apiClient(`/business/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: messageText })
      });

      if (response && response.ok) {
        const sentMessage: ConversationMessage = {
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

        onConversationLastMessageSync(selectedConversationId, {
          status: 'active',
          last_message_text: sentMessage.text,
          last_message_at: sentMessage.created_at,
          last_message_created_at: sentMessage.created_at,
          last_message_direction: sentMessage.direction || 'outgoing',
          last_message_status: sentMessage.status || 'agent_sent',
          last_message_sender_type: 'agent'
        });

        return true;
      }

      onError(`Error al enviar: ${response?.error || 'Unknown error'}`);
      return false;
    } catch (err) {
      console.error('send message error:', err);
      onError('Error al enviar el mensaje');
      return false;
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    if (!selectedConversationId) return;

    const intervalId = setInterval(async () => {
      try {
        const latestMessages = await fetchMessages(selectedConversationId);
        const last = latestMessages[latestMessages.length - 1];
        let hasNewLastMessage = false;

        setMessagesByConversation((prev) => {
          const previous = prev[selectedConversationId] || [];
          if (previous.length === latestMessages.length) {
            const prevLast = previous[previous.length - 1]?.id;
            const nextLast = latestMessages[latestMessages.length - 1]?.id;
            if (prevLast === nextLast) return prev;
          }

          hasNewLastMessage = true;

          return {
            ...prev,
            [selectedConversationId]: latestMessages
          };
        });

        if (last?.text && hasNewLastMessage) {
          onConversationLastMessageSync(selectedConversationId, {
            last_message_text: last.text,
            last_message_at: last.created_at,
            last_message_created_at: last.created_at,
            last_message_direction: last.direction,
            last_message_status: last.status,
            last_message_sender_type: last.senderType
          });
        }
      } catch {
        // Silent in background polling
      }
    }, pollIntervalMs);

    return () => clearInterval(intervalId);
  }, [selectedConversationId, pollIntervalMs]);

  const selectedMessages = selectedConversationId ? messagesByConversation[selectedConversationId] || [] : [];

  return {
    messagesByConversation,
    selectedMessages,
    loadingMessages,
    sendingMessage,
    fetchMessages,
    loadMessagesForConversation,
    sendMessage
  };
}
