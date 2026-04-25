'use client';

import { apiClient } from '@/lib/api/apiClient';
import type { ConversationStatus } from '@/lib/utils/conversation';

interface ConversationActionItem {
  id: string;
  status: ConversationStatus;
  last_message_at: string;
}

interface UseConversationActionsParams<T extends ConversationActionItem> {
  selectedConversationId: string | null;
  setSelectedConversationId: React.Dispatch<React.SetStateAction<string | null>>;
  setPreviewByConversation: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setConversations: React.Dispatch<React.SetStateAction<T[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  loadMessagesForConversation: (conversationId: string) => Promise<Array<{ text?: string }>>;
  sendConversationMessage: (text: string) => Promise<boolean>;
}

export function useConversationActions<T extends ConversationActionItem>({
  selectedConversationId,
  setSelectedConversationId,
  setPreviewByConversation,
  setConversations,
  setError,
  loadMessagesForConversation,
  sendConversationMessage
}: UseConversationActionsParams<T>) {
  const selectConversation = async (conversationId: string) => {
    setSelectedConversationId(conversationId);

    const transformedMessages = await loadMessagesForConversation(conversationId);
    const last = transformedMessages[transformedMessages.length - 1];
    if (last) {
      setPreviewByConversation((prev) => ({
        ...prev,
        [conversationId]: last.text ?? ''
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

  return {
    selectConversation,
    clearSelectedConversation,
    sendMessage,
    updateConversationStatus
  };
}