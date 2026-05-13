import { useState } from 'react';
import type { LeadStatus, UrgencyLevel } from '@/lib/utils/leads';

export interface LeadItemViewModel {
  id: string;
  nameOrPhone: string;
  phone: string;
  name?: string | null;
  status: LeadStatus;
  statusClassName: string;
  lastInteractionLabel: string;
  attentionLevel: 'customer' | 'bot' | null;
  urgencyLevel: UrgencyLevel;
  waitText: string;
  urgencyBadgeClassName: string;
  urgencyDotClassName: string;
  isReopened: boolean;
  nextActionLabel: string;
  nextActionStatus: LeadStatus;
  isSaving: boolean;
  isHighlighted: boolean;
  nameDraft: string;
  canSaveName: boolean;
  conversationStatus?: string | null;
  notes?: string | null;
}

interface LeadItemProps {
  item: LeadItemViewModel;
  onAdvanceStatus: (leadId: string, nextStatus: LeadStatus) => void;
  onNameChange: (leadId: string, value: string) => void;
  onSaveName: (leadId: string) => void;
}

function getConversationStatusBadge(status: string | null | undefined) {
  if (!status) return null;
  
  const statusLower = String(status || '').toLowerCase();
  
  switch (statusLower) {
    case 'bot':
      return {
        label: '🤖 Bot activo',
        bgColor: '#E6F1FB',
        textColor: '#0C447C'
      };
    case 'active':
      return {
        label: '👤 Con agente',
        bgColor: '#EAF3DE',
        textColor: '#27500A'
      };
    case 'closed':
      return {
        label: '✓ Cerrado',
        bgColor: '#F1EFE8',
        textColor: '#5F5E5A'
      };
    default:
      return null;
  }
}

function parseNotes(notes: string | null | undefined): Record<string, any> {
  if (!notes) return {};
  
  if (typeof notes === 'string') {
    try {
      const parsed = JSON.parse(notes);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  
  return {};
}

const FIELD_LABELS: Record<string, string> = {
  client_name: 'Nombre',
  business_name: 'Negocio',
  contact: 'Contacto',
  interest: 'Interés'
};

const FIELD_ORDER = ['client_name', 'business_name', 'contact', 'interest'];

export function LeadItem({ item, onAdvanceStatus, onNameChange, onSaveName }: LeadItemProps) {
  const [showNotes, setShowNotes] = useState(false);
  const parsedNotes = parseNotes(item.notes);
  const hasNotes = Object.keys(parsedNotes).length > 0;
  const conversationBadge = getConversationStatusBadge(item.conversationStatus);

  return (
    <article
      className={`rounded-[8px] border p-4 ${item.isHighlighted ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}
      style={{ borderWidth: '0.5px', borderColor: item.isHighlighted ? '#fbbf24' : '#E3E6EB' }}
    >
      {/* Header: Name and Status Badges */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          {/* Lead Name (Prominent) */}
          <p className="text-[16px] leading-none font-medium text-[#1B1D21]">
            {item.name || item.phone}
          </p>
          
          {/* Phone (Secondary) */}
          {item.name && (
            <p className="mt-1 text-[14px] leading-none text-[#6F7782]">
              {item.phone}
            </p>
          )}
          
          {/* Last Interaction */}
          <p className="mt-2 text-[12px] leading-none text-[#6F7782]">
            Última interacción: {item.lastInteractionLabel}
          </p>
        </div>

        {/* Status Badges Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lead Status Badge */}
          <span
            className="inline-flex rounded-[8px] border px-2 py-1 text-[11px] font-medium"
            style={{
              ...(() => {
                switch (item.status) {
                  case 'NEW':
                    return {
                      borderColor: '#B5D4F4',
                      backgroundColor: '#E6F1FB',
                      color: '#185FA5'
                    };
                  case 'CONTACTED':
                    return {
                      borderColor: '#FFD699',
                      backgroundColor: '#FFF4E6',
                      color: '#B67800'
                    };
                  case 'QUALIFIED':
                    return {
                      borderColor: '#A8D5BA',
                      backgroundColor: '#EAF3DE',
                      color: '#27500A'
                    };
                  case 'CLOSED':
                    return {
                      borderColor: '#D3CFCA',
                      backgroundColor: '#F1EFE8',
                      color: '#5F5E5A'
                    };
                  default:
                    return {};
                }
              })()
            }}
          >
            {item.status}
          </span>

          {/* Conversation Status Badge */}
          {conversationBadge && (
            <span
              className="inline-flex rounded-[8px] border px-2 py-1 text-[11px] font-medium"
              style={{
                borderColor: '#E3E6EB',
                backgroundColor: conversationBadge.bgColor,
                color: conversationBadge.textColor,
                borderWidth: '0.5px'
              }}
            >
              {conversationBadge.label}
            </span>
          )}

          {/* Attention Level Badge */}
          {item.attentionLevel === 'customer' && (
            <span
              className="inline-flex items-center gap-1 rounded-[8px] border px-2 py-1 text-[11px] font-medium"
              style={{
                borderColor: '#FFB5B5',
                backgroundColor: '#FFE6E6',
                color: '#C10000',
                borderWidth: '0.5px'
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: '#C10000' }}
              />
              Cliente espera{item.waitText ? ` · ${item.waitText}` : ''}
            </span>
          )}

          {item.attentionLevel === 'bot' && (
            <span
              className="inline-flex items-center gap-1 rounded-[8px] border px-2 py-1 text-[11px] font-medium"
              style={{
                borderColor: '#FFD699',
                backgroundColor: '#FFF4E6',
                color: '#B67800',
                borderWidth: '0.5px'
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: '#B67800' }}
              />
              Falta agente
            </span>
          )}

          {item.isReopened && (
            <span
              className="inline-flex items-center gap-1 rounded-[8px] border px-2 py-1 text-[11px] font-medium"
              style={{
                borderColor: '#A8D5BA',
                backgroundColor: '#EAF3DE',
                color: '#27500A',
                borderWidth: '0.5px'
              }}
            >
              Lead reabierto
            </span>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={() => onAdvanceStatus(item.id, item.nextActionStatus)}
            disabled={item.isSaving}
            className="h-[30px] rounded-[8px] border border-transparent bg-[#185FA5] px-3 text-[12px] font-medium text-white hover:bg-[#1446A8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {item.isSaving ? 'Guardando...' : item.nextActionLabel}
          </button>
        </div>
      </div>

      {/* Name Input Field */}
      <div className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={item.nameDraft}
          onChange={(e) => onNameChange(item.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSaveName(item.id);
            }
          }}
          className="flex-1 h-9 rounded-[8px] border border-[#D3D9E1] bg-white px-3 text-[14px] font-normal text-[#1B1D21] outline-none"
          style={{ borderWidth: '0.5px' }}
          placeholder="Nombre del lead"
        />
        <button
          type="button"
          onClick={() => onSaveName(item.id)}
          disabled={!item.canSaveName || item.isSaving}
          className="h-9 rounded-[8px] border border-[#D3D9E1] bg-[#F3F5F7] px-3 text-[12px] font-medium text-[#3D444F] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderWidth: '0.5px' }}
        >
          Guardar
        </button>
      </div>

      {/* Info Capturada Section */}
      {hasNotes && (
        <div className="mt-4 border-t border-[#E3E6EB]" style={{ borderWidth: '0.5px' }}>
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className="mt-3 flex items-center gap-2 text-[11px] font-normal text-[#6F7782] hover:text-[#1B1D21]"
          >
            <span
              className={`inline-block transition-transform ${showNotes ? 'rotate-90' : ''}`}
              style={{ width: '12px', height: '12px' }}
            >
              ▶
            </span>
            Info capturada
          </button>

          {showNotes && (
            <div className="mt-2 space-y-1">
              {FIELD_ORDER.map((fieldKey) => {
                const value = parsedNotes[fieldKey];
                if (value === null || value === undefined || value === '') {
                  return null;
                }
                
                const label = FIELD_LABELS[fieldKey] || fieldKey;
                
                return (
                  <p key={fieldKey} className="text-[12px] text-[#3D444F]">
                    <span className="font-medium">{label}:</span> {String(value)}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
