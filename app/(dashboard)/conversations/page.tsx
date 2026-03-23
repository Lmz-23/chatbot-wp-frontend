'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChatHeader } from '@/components/conversations/ChatHeader';
import { ConversationList } from '@/components/conversations/ConversationList';
import { useAuth, useConversations } from '@/hooks';

export default function ConversationsPage() {
  const { loading: authLoading } = useAuth();
  const {
    loadingConversations,
    loadingMessages,
    sendingMessage,
    error,
    toastMessage,
    attentionCount,
    selectedConversationId,
    selectedMessages,
    conversationListItems,
    selectedHeaderData,
    selectConversation,
    sendMessage,
    updateConversationStatus,
    advanceLeadStatus
  } = useConversations({ authLoading });

  const [draftMessage, setDraftMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversationId, selectedMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftMessage.trim() || !selectedConversationId) return;

    const wasSent = await sendMessage(draftMessage);
    if (wasSent) setDraftMessage('');
  };

  if (authLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="flex h-[100dvh] gap-0">
      <div className="w-1/3 border-r border-border bg-muted/30 flex flex-col">
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

        {error && (
          <div className="p-4 text-sm text-destructive">{error}</div>
        )}

        {loadingConversations && (
          <div className="p-4 text-sm text-muted-foreground">Cargando...</div>
        )}

        <ConversationList
          items={conversationListItems}
          emptyStateMessage="No hay conversaciones aún"
          showEmptyState={!loadingConversations}
          onSelectConversation={selectConversation}
        />
      </div>

      <div className="flex-1 flex flex-col bg-background">
        {!selectedConversationId || !selectedHeaderData ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Selecciona una conversación
          </div>
        ) : (
          <>
            <ChatHeader
              title={selectedHeaderData.title}
              subtitle={selectedHeaderData.subtitle}
              attentionBadge={selectedHeaderData.attentionBadge}
              statusLabel={selectedHeaderData.statusLabel}
              statusClassName={selectedHeaderData.statusClassName}
              selectedStatus={selectedHeaderData.selectedStatus}
              onStatusChange={updateConversationStatus}
              showLeadReactivated={selectedHeaderData.showLeadReactivated}
              hasLead={selectedHeaderData.hasLead}
              leadStatusLabel={selectedHeaderData.leadStatusLabel}
              leadStatusClassName={selectedHeaderData.leadStatusClassName}
              leadActionLabel={selectedHeaderData.leadActionLabel}
              onLeadAction={advanceLeadStatus}
              leadActionDisabled={selectedHeaderData.leadActionDisabled}
            />

            {toastMessage && (
              <div className="fixed right-4 top-4 z-50 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm">
                {toastMessage}
              </div>
            )}

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
