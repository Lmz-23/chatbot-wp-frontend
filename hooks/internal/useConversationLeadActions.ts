'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import { toLeadPhoneKey, type LeadLookupItem, type LeadStatus } from '@/lib/utils/conversationData';
import type { ConversationStatus } from '@/lib/utils/conversation';

interface ConversationBase {
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

interface UseConversationLeadActionsParams<T extends ConversationBase> {
  conversations: T[];
  selectedConversationId: string | null;
  leadLookupByPhone: Record<string, LeadLookupItem>;
  setConversations: Dispatch<SetStateAction<T[]>>;
  setLeadLookupByPhone: Dispatch<SetStateAction<Record<string, LeadLookupItem>>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setHighlightedConversationId: Dispatch<SetStateAction<string | null>>;
  setToastMessage: Dispatch<SetStateAction<string | null>>;
}

export function useConversationLeadActions<T extends ConversationBase>({
  conversations,
  selectedConversationId,
  leadLookupByPhone,
  setConversations,
  setLeadLookupByPhone,
  setError,
  setHighlightedConversationId,
  setToastMessage
}: UseConversationLeadActionsParams<T>) {
  const [savingLeadStatus, setSavingLeadStatus] = useState(false);

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

  return {
    savingLeadStatus,
    selectedConversation,
    selectedLeadId,
    selectedLeadStatus,
    getLeadStatusClasses,
    getLeadStatusLabel,
    getNextLeadAction,
    advanceLeadStatus
  };
}