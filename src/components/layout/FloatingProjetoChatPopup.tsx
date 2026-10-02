import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  useLeadProjetoMutations,
  useLeadProjetoNotas,
} from '@/hooks/useLeadProjetos'
import {
  useMarkLeadProjetoChatRead,
  type ProjetoChatUnreadThread,
} from '@/hooks/useProjetoChatUnread'
import { ProjetoChatThread } from '@/components/projetos/ProjetoChatThread'
import { ProjetoChatComposer } from '@/components/projetos/ProjetoChatComposer'
import { floatingAgendaPanelClass, FLOATING_UI_ROOT_ATTR } from '@/lib/overlay-z-index'
import {
  FLOATING_TOP_EDGE,
  FLOATING_PROJETO_CHAT_ICON_RIGHT,
} from '@/lib/floating-ui-layout'

interface FloatingProjetoChatPopupProps {
  isOpen: boolean
  onClose: () => void
  threads: ProjetoChatUnreadThread[]
}

function previewHora(iso: string): string {
  const date = new Date(iso)
  if (date.toDateString() === new Date().toDateString()) {
    return format(date, 'HH:mm')
  }
  return format(date, 'dd/MM', { locale: ptBR })
}

export function FloatingProjetoChatPopup({
  isOpen,
  onClose,
  threads,
}: FloatingProjetoChatPopupProps) {
  const { user, userRoles } = useAuth()
  const { markLeadChatRead, markLeadChatUnread, isMarkingUnread, lastReadByLead } =
    useMarkLeadProjetoChatRead()
  const { adicionarNota } = useLeadProjetoMutations()
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null)
  const [activeLeadNome, setActiveLeadNome] = useState<string | null>(null)
  const { data: notas = [], isLoading: loadingNotas } = useLeadProjetoNotas(
    isOpen ? activeLeadId : null,
  )
  const activeLastRead = activeLeadId != null ? lastReadByLead[activeLeadId] ?? null : null

  useEffect(() => {
    if (!isOpen) {
      setActiveLeadId(null)
      setActiveLeadNome(null)
      return
    }
    if (activeLeadId == null && threads.length === 1) {
      setActiveLeadId(threads[0].lead_id)
      setActiveLeadNome(threads[0].lead_nome)
    }
  }, [activeLeadId, isOpen, threads])

  useEffect(() => {
    if (!isOpen || activeLeadId == null) return
    markLeadChatRead(activeLeadId)
  }, [activeLeadId, isOpen, markLeadChatRead])

  if (!isOpen) return null

  const showThread = activeLeadId != null

  const openThread = (thread: ProjetoChatUnreadThread) => {
    setActiveLeadId(thread.lead_id)
    setActiveLeadNome(thread.lead_nome)
  }

  return (
    <div
      {...{ [FLOATING_UI_ROOT_ATTR]: '' }}
      data-floating-projeto-chat-root=""
      className={cn(
        'fixed pointer-events-auto',
        FLOATING_TOP_EDGE,
        FLOATING_PROJETO_CHAT_ICON_RIGHT,
        floatingAgendaPanelClass,
        'flex w-[min(calc(100vw-1.25rem),22rem)] flex-col overflow-hidden rounded-2xl',
        'border border-[rgba(125,211,252,0.28)] bg-[#120c09]/96 shadow-[0_16px_48px_rgba(0,0,0,0.55)]',
        'backdrop-blur-md animate-in fade-in zoom-in-95 duration-200',
        'max-h-[min(calc(100vh-5rem),34rem)]',
      )}
      role="dialog"
      aria-modal="false"
      aria-label="Chat do ateliê"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5">
        {showThread ? (
          <button
            type="button"
            onClick={() => setActiveLeadId(null)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sky-200/90 hover:bg-white/10"
            aria-label="Voltar para lista"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-400/30 bg-sky-950/40">
            <MessageSquare className="h-3.5 w-3.5 text-sky-200" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] tracking-[0.28em] text-sky-300/90">ATELIÊ</p>
          <p className="truncate text-sm font-medium text-[#f5e6c8]">
            {showThread && activeLeadNome ? activeLeadNome : 'Mensagens não lidas'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#c4b09a] hover:bg-white/10 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {!showThread ? (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2">
          {threads.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-[#a89078]">
              Nenhuma mensagem nova no momento.
            </li>
          ) : (
            threads.map((thread) => (
              <li key={thread.lead_id}>
                <button
                  type="button"
                  onClick={() => openThread(thread)}
                  className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-sky-400" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-[14px] font-medium text-[#f5e6c8]">
                        {thread.lead_nome}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-[#8a7060]">
                        {previewHora(thread.lastAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-[#a89078]">
                      {thread.lastPreview}
                    </span>
                  </span>
                  <span className="mt-0.5 inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-sky-400/90 px-1.5 py-0.5 text-[10px] font-bold text-[#0c2a36]">
                    {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col bg-[#fffcf8]">
          <div className="flex shrink-0 items-center justify-end border-b border-[rgba(42,24,18,0.08)] px-3 py-1.5">
            <button
              type="button"
              className="text-[11px] text-[#8a7060] hover:text-[#8d5e22] disabled:opacity-50"
              disabled={isMarkingUnread || activeLeadId == null}
              onClick={() => {
                if (activeLeadId == null) return
                markLeadChatUnread(activeLeadId)
              }}
            >
              Marcar não lida
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-3 pt-3">
            {loadingNotas ? (
              <p className="py-8 text-center text-sm text-[#8a7060]">Carregando conversa…</p>
            ) : (
              <ProjetoChatThread
                notas={notas}
                currentUserId={user?.id}
                currentUserRoles={userRoles}
                lastReadAt={activeLastRead}
                className="max-h-[min(18rem,42vh)]"
                markUnreadPending={isMarkingUnread}
                onMarkUnread={(nota) => {
                  if (activeLeadId == null) return
                  markLeadChatUnread(activeLeadId, nota.criado_em)
                }}
              />
            )}
          </div>
          <div className="shrink-0 border-t border-[rgba(42,24,18,0.1)] p-3">
            <ProjetoChatComposer
              compact
              disabled={adicionarNota.isPending || activeLeadId == null}
              onSend={({ mensagem, file }) => {
                if (activeLeadId == null) return
                adicionarNota.mutate(
                  { leadId: activeLeadId, mensagem, file },
                  {
                    onSuccess: () => {
                      markLeadChatRead(activeLeadId)
                    },
                  },
                )
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
