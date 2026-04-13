'use client';

import { useRef, useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import { getConversationLastMessageTimestamp, type ConversationStatus } from '@/lib/utils/conversation';
import {
  buildLeadLookupByPhone,
  buildPreviewByConversation,
  enrichConversationsWithLeads,
  mergeConversationsKeepingLastMessageMeta,
  type LeadLookupItem,
  type LeadStatus
} from '@/lib/utils/conversationData';

interface ConversationDataItem {
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

interface UseConversationDataLoaderParams<T extends ConversationDataItem> {
  leadLookupByPhone: Record<string, LeadLookupItem>;
  setLeadLookupByPhone: React.Dispatch<React.SetStateAction<Record<string, LeadLookupItem>>>;
  setConversations: React.Dispatch<React.SetStateAction<T[]>>;
  setPreviewByConversation: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  fetchMessages: (conversationId: string) => Promise<Array<{ text?: string }>>;
}

export function useConversationDataLoader<T extends ConversationDataItem>({
  leadLookupByPhone,
  setLeadLookupByPhone,
  setConversations,
  setPreviewByConversation,
  setError,
  fetchMessages
}: UseConversationDataLoaderParams<T>) {
  const hasLoadedConversationsRef = useRef(false);
  const [loadingConversations, setLoadingConversations] = useState(true);

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
          nextLeadLookup = buildLeadLookupByPhone(leadsResponse.leads);
          setLeadLookupByPhone(nextLeadLookup);
        }

        const nextConversations = enrichConversationsWithLeads<T>(rawConversations, nextLeadLookup);
        setConversations((prev) =>
          mergeConversationsKeepingLastMessageMeta<T>(prev, nextConversations, getConversationLastMessageTimestamp)
        );

        const initialPreview: Record<string, string> = buildPreviewByConversation(nextConversations);
        setPreviewByConversation(initialPreview);

        const missingPreviewConversations = nextConversations.filter((conv) => !conv.last_message_text);

        if (missingPreviewConversations.length > 0) {
          Promise.all(
            missingPreviewConversations.map(async (conv) => {
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

  return {
    loadingConversations,
    fetchConversations
  };
}