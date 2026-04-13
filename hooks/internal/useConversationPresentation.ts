'use client';

import { useMemo } from 'react';
import { type ConversationListItemData } from '@/components/conversations/ConversationList';
import {
  formatTime,
  formatShortWaitTime,
  getAttentionLevelFromLastMessage,
  getCustomerUrgencyBadgeClasses,
  getCustomerUrgencyDotClass,
  getCustomerUrgencyFromConversation,
  requiresAttentionFromLastMessage,
  sortConversationsByPriority,
  type ConversationStatus
} from '@/lib/utils/conversation';
import type { LeadStatus } from '@/lib/utils/conversationData';

interface ConversationPresentationItem {
  id: string;
  user_phone: string;
  lead_name?: string | null;
  status: ConversationStatus;
  last_message_at: string;
  last_message_text?: string;
  last_message_direction?: string;
  last_message_status?: string;
  last_message_sender_type?: 'customer' | 'bot' | 'agent' | 'unknown' | null;
  last_message_created_at?: string | null;
}

interface HeaderBadge {
  text: string;
  className: string;
  dotClassName: string;
}

export interface SelectedHeaderData {
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

interface UseConversationPresentationParams<T extends ConversationPresentationItem> {
  conversations: T[];
  selectedConversationId: string | null;
  selectedConversation: T | undefined;
  selectedLeadId: string | null;
  selectedLeadStatus: LeadStatus | null;
  savingLeadStatus: boolean;
  highlightedConversationId: string | null;
  messagesByConversation: Record<string, Array<{ text: string }>>;
  previewByConversation: Record<string, string>;
  getLeadStatusClasses: (status: LeadStatus | null) => string;
  getLeadStatusLabel: (status: LeadStatus | null) => string;
  getNextLeadAction: (status: LeadStatus | null) => { label: string; next: LeadStatus } | null;
}

function getStatusLabel(status: ConversationStatus): string {
  if (status === 'bot') return 'Bot';
  if (status === 'active') return 'Activo';
  return 'Cerrado';
}

function getStatusClasses(status: ConversationStatus): string {
  if (status === 'bot') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (status === 'active') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

export function useConversationPresentation<T extends ConversationPresentationItem>({
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
}: UseConversationPresentationParams<T>) {
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

  const conversationListItems = useMemo<ConversationListItemData[]>(() => {
    return prioritizedConversations.map((conv) => {
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
    });
  }, [messagesByConversation, previewByConversation, highlightedConversationId, prioritizedConversations, selectedConversationId]);

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

  return {
    attentionCount,
    conversationListItems,
    selectedHeaderData
  };
}