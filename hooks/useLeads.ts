'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import type { LeadItemViewModel } from '@/components/leads/LeadItem';
import {
  formatDate,
  formatShortWaitTime,
  getAttentionLevelFromLastMessage,
  getConversationResponseTimestamp,
  getCustomerUrgencyBadgeClasses,
  getCustomerUrgencyDotClass,
  getNextLeadAction,
  getStatusClasses,
  getUrgencyLevel,
  sortLeadsByPriority,
  STATUS_OPTIONS,
  STATUS_TITLES,
  toTimestamp,
  type AttentionMeta,
  type ConversationSummary,
  type Lead,
  type LeadStatus
} from '@/lib/utils/leads';

interface LeadSectionViewModel {
  status: LeadStatus;
  title: string;
  count: number;
  items: LeadItemViewModel[];
}

export function useLeads() {
  const hasLoadedRef = useRef(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [highlightedLeadId, setHighlightedLeadId] = useState<string | null>(null);
  const [savingByLead, setSavingByLead] = useState<Record<string, boolean>>({});
  const [nameDraftByLead, setNameDraftByLead] = useState<Record<string, string>>({});
  const [onlyPending, setOnlyPending] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | LeadStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [attentionMetaByLeadId, setAttentionMetaByLeadId] = useState<Record<string, AttentionMeta>>({});

  useEffect(() => {
    if (onlyPending && selectedCategory === 'CLOSED') {
      setSelectedCategory('ALL');
    }
  }, [onlyPending, selectedCategory]);

  const leadsById = useMemo(() => {
    const map: Record<string, Lead> = {};
    for (const lead of leads) map[lead.id] = lead;
    return map;
  }, [leads]);

  // Loads leads and conversation context, then computes attention/urgency metadata per lead.
  const fetchLeads = async () => {
    const isInitialLoad = !hasLoadedRef.current;
    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      setError(null);
      const [leadsResponse, conversationsResponse] = await Promise.all([
        apiClient('/business/leads'),
        apiClient('/business/conversations')
      ]);

      if (!leadsResponse || !leadsResponse.ok) {
        setError('No se pudieron cargar los leads');
        return;
      }

      const nextLeads: Lead[] = leadsResponse.leads || [];
      setLeads(nextLeads);

      if (isInitialLoad) {
        const nextDrafts: Record<string, string> = {};
        for (const lead of nextLeads) {
          nextDrafts[lead.id] = lead.name || '';
        }
        setNameDraftByLead(nextDrafts);
      }

      const rawConversations: ConversationSummary[] =
        conversationsResponse && conversationsResponse.ok
          ? (conversationsResponse.conversations || [])
          : [];

      const latestByLeadId: Record<string, ConversationSummary> = {};
      for (const conv of rawConversations) {
        if (!conv.lead_id) continue;
        const existing = latestByLeadId[conv.lead_id];
        if (!existing || toTimestamp(conv.last_message_at) > toTimestamp(existing.last_message_at)) {
          latestByLeadId[conv.lead_id] = conv;
        }
      }

      const nextAttentionMetaByLeadId: Record<string, AttentionMeta> = {};
      const leadStatusById: Record<string, LeadStatus> = {};
      for (const lead of nextLeads) {
        leadStatusById[lead.id] = lead.status;
      }

      for (const leadId of Object.keys(latestByLeadId)) {
        const latest = latestByLeadId[leadId];
        const attentionLevel = getAttentionLevelFromLastMessage({
          senderType: latest.last_message_sender_type,
          status: latest.last_message_status,
          direction: latest.last_message_direction,
          conversationStatus: latest.status
        });

        const responseTs = getConversationResponseTimestamp(latest);
        const urgencyLevel = attentionLevel === 'customer'
          ? getUrgencyLevel(latest.last_message_created_at || latest.last_message_at)
          : null;

        const isReopened =
          leadStatusById[leadId] === 'CONTACTED'
          && attentionLevel === 'customer';

        nextAttentionMetaByLeadId[leadId] = {
          attentionLevel,
          urgencyLevel,
          responseTimeTimestamp: responseTs,
          isReopened
        };
      }
      setAttentionMetaByLeadId(nextAttentionMetaByLeadId);
    } catch (err) {
      console.error('fetch leads error:', err);
      setError('Error al cargar leads');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
        hasLoadedRef.current = true;
      }
    }
  };

  useEffect(() => {
    fetchLeads();

    const intervalId = setInterval(() => {
      fetchLeads();
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  // Applies optimistic lead updates with rollback on failure.
  const patchLead = async (
    leadId: string,
    payload: Partial<Pick<Lead, 'name' | 'status'>>,
    previousLead: Lead,
    successMessage?: string
  ) => {
    setSavingByLead((prev) => ({ ...prev, [leadId]: true }));

    try {
      const response = await apiClient(`/business/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      if (!response || !response.ok || !response.lead) {
        throw new Error('patch_failed');
      }

      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? response.lead : lead))
      );
      setNameDraftByLead((prev) => ({
        ...prev,
        [leadId]: response.lead.name || ''
      }));
      setError(null);
      if (successMessage) {
        setToastMessage(successMessage);
        setHighlightedLeadId(leadId);
        setTimeout(() => setToastMessage(null), 1800);
        setTimeout(() => setHighlightedLeadId((prev) => (prev === leadId ? null : prev)), 1600);
      }
      return response.lead as Lead;
    } catch (err) {
      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? previousLead : lead))
      );
      setNameDraftByLead((prev) => ({
        ...prev,
        [leadId]: previousLead.name || ''
      }));
      console.error('patch lead error:', err);
      setError('No se pudo guardar el lead. Revirtiendo cambios.');
      return null;
    } finally {
      setSavingByLead((prev) => ({ ...prev, [leadId]: false }));
    }
  };

  const saveLeadName = async (leadId: string) => {
    const currentLead = leadsById[leadId];
    if (!currentLead) return;

    const draftName = nameDraftByLead[leadId] ?? '';
    const currentName = currentLead.name ?? '';
    if (draftName === currentName) return;

    await patchLead(
      leadId,
      { name: draftName === '' ? null : draftName },
      currentLead,
      'Nombre actualizado'
    );
  };

  const advanceLeadStatus = (leadId: string, nextStatus: LeadStatus) => {
    const currentLead = leadsById[leadId];
    if (!currentLead) return;

    if (currentLead.status === nextStatus) return;

    const optimisticLead: Lead = { ...currentLead, status: nextStatus };
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? optimisticLead : lead)));
    patchLead(leadId, { status: nextStatus }, currentLead, `Lead movido a ${nextStatus}`);
  };

  const filteredLeads = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();

    return leads.filter((lead) => {
      if (onlyPending && lead.status === 'CLOSED') return false;
      if (selectedCategory !== 'ALL' && lead.status !== selectedCategory) return false;

      if (!term) return true;

      const haystack = `${lead.name || ''} ${lead.phone}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [leads, onlyPending, searchQuery, selectedCategory]);

  const visibleStatusOptions = useMemo(() => {
    const base = selectedCategory === 'ALL' ? STATUS_OPTIONS : [selectedCategory];
    return onlyPending ? base.filter((status) => status !== 'CLOSED') : base;
  }, [onlyPending, selectedCategory]);

  const groupedLeads = useMemo(() => {
    const grouped: Record<LeadStatus, Lead[]> = {
      NEW: [],
      CONTACTED: [],
      QUALIFIED: [],
      CLOSED: []
    };

    for (const lead of filteredLeads) {
      grouped[lead.status].push(lead);
    }

    for (const status of STATUS_OPTIONS) {
      grouped[status] = sortLeadsByPriority(grouped[status], attentionMetaByLeadId);
    }

    return grouped;
  }, [attentionMetaByLeadId, filteredLeads]);

  const sections = useMemo<LeadSectionViewModel[]>(() => {
    return visibleStatusOptions.map((status) => ({
      status,
      title: STATUS_TITLES[status],
      count: groupedLeads[status].length,
      items: groupedLeads[status].map((lead) => {
        const nextAction = getNextLeadAction(lead.status);
        const attentionMeta = attentionMetaByLeadId[lead.id];
        const attentionLevel = attentionMeta?.attentionLevel || null;
        const urgencyLevel = attentionMeta?.urgencyLevel || null;
        const isReopened = attentionMeta?.isReopened || false;
        const waitText = attentionLevel === 'customer' && attentionMeta?.responseTimeTimestamp
          ? formatShortWaitTime(new Date(attentionMeta.responseTimeTimestamp).toISOString())
          : '';

        return {
          id: lead.id,
          nameOrPhone: lead.name || lead.phone,
          phone: lead.phone,
          status: lead.status,
          statusClassName: getStatusClasses(lead.status),
          lastInteractionLabel: formatDate(lead.last_interaction_at),
          attentionLevel,
          urgencyLevel,
          waitText,
          urgencyBadgeClassName: getCustomerUrgencyBadgeClasses(urgencyLevel),
          urgencyDotClassName: getCustomerUrgencyDotClass(urgencyLevel),
          isReopened,
          nextActionLabel: nextAction.label,
          nextActionStatus: nextAction.next,
          isSaving: !!savingByLead[lead.id],
          isHighlighted: highlightedLeadId === lead.id,
          nameDraft: nameDraftByLead[lead.id] ?? '',
          canSaveName: (nameDraftByLead[lead.id] ?? '') !== (lead.name ?? '')
        };
      })
    }));
  }, [attentionMetaByLeadId, groupedLeads, highlightedLeadId, nameDraftByLead, savingByLead, visibleStatusOptions]);

  return {
    loading,
    error,
    toastMessage,
    onlyPending,
    selectedCategory,
    searchQuery,
    hasAnyLeads: filteredLeads.length > 0,
    sections,
    setOnlyPending,
    setSelectedCategory,
    setSearchQuery,
    setLeadNameDraft: (leadId: string, value: string) => {
      setNameDraftByLead((prev) => ({ ...prev, [leadId]: value }));
    },
    saveLeadName,
    advanceLeadStatus
  };
}
