import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MailOpen, MessageSquare, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  useLeadProjetoChatBoard,
  useLeadProjetoMutations,
  useLeadProjetoNotas,
  type LeadProjetoChatThread,
} from '@/hooks/useLeadProjetos'
import { useMarkLeadProjetoChatRead } from '@/hooks/useProjetoChatUnread'
import { ProjetoChatThread } from '@/components/projetos/ProjetoChatThread'
import { ProjetoChatComposer } from '@/components/projetos/ProjetoChatComposer'
import { ProjetosChatSheetAura } from '@/components/projetos/ProjetosChatSheetAura'
import { Input } from '@/components/ui/input'
import { floatingAgendaPanelClass, FLOATING_UI_ROOT_ATTR } from '@/lib/overlay-z-index'
import {
  FLOATING_PROJETO_CHAT_ICON_RIGHT,
} from '@/lib/floating-ui-layout'

interface FloatingProjetoChatPopupProps {
  isOpen: boolean
  onClose: () => void
  unreadCountByLead: Record<number, number>
  lastReadByLead: Record<number, string>
}

function previewMensagem(thread: LeadProjetoChatThread): string {
  const msg = thread.last.mensagem.trim()
  if (!msg || msg === '📷 Imagem') return thread.last.imagem_url ? 'Imagem' : 'Sem texto'
  return msg.length > 90 ? `${msg.slice(0, 87)}…` : msg
}

function previewHora(iso: string): string {
  const date = new Date(iso)
  if (date.toDateString() === new Date().toDateString()) {
    return format(date, 'HH:mm')
  }
  return format(date, 'dd/MM', { locale: ptBR })
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function FloatingProjetoChatPopup({
  isOpen,
  onClose,
  unreadCountByLead,
  lastReadByLead,
}: FloatingProjetoChatPopupProps) {
  const navigate = useNavigate()
  const { user, userRoles } = useAuth()
  const { data: boardThreads = [], isLoading: loadingBoard } = useLeadProjetoChatBoard({
    realtime: isOpen,
  })
  const { markLeadChatRead, markLeadChatUnread, isMarkingUnread } = useMarkLeadProjetoChatRead()
  const { adicionarNota } = useLeadProjetoMutations()
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null)
  const [activeLeadNome, setActiveLeadNome] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { data: notas = [], isLoading: loadingNotas } = useLeadProjetoNotas(
    isOpen ? activeLeadId : null,
  )
  const activeLastRead = activeLeadId != null ? lastReadByLead[activeLeadId] ?? null : null

  useEffect(() => {
    if (!isOpen) {
      setActiveLeadId(null)
      setActiveLeadNome(null)
      setSearch('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || activeLeadId == null) return
    markLeadChatRead(activeLeadId)
  }, [activeLeadId, isOpen, markLeadChatRead])

  const filteredThreads = useMemo(() => {
    const q = normalizeSearch(search)
    const list = boardThreads
      .map((thread) => ({
        thread,
        unreadCount: unreadCountByLead[thread.lead_id] ?? 0,
      }))
      .filter(({ thread }) => {
        if (!q) return true
        const haystack = normalizeSearch(
          [
            thread.lead_nome,
            thread.titular_nome ?? '',
            thread.last.mensagem,
            thread.last.autor_nome ?? '',
          ].join(' '),
        )
        return haystack.includes(q)
      })
      .sort((a, b) => {
        if ((a.unreadCount > 0) !== (b.unreadCount > 0)) {
          return a.unreadCount > 0 ? -1 : 1
        }
        return a.thread.last.criado_em < b.thread.last.criado_em ? 1 : -1
      })
    return list
  }, [boardThreads, search, unreadCountByLead])

  if (!isOpen) return null

  const showThread = activeLeadId != null
  const unreadTotal = Object.values(unreadCountByLead).reduce((sum, n) => sum + (n > 0 ? 1 : 0), 0)

  const openThread = (thread: LeadProjetoChatThread) => {
    setActiveLeadId(thread.lead_id)
    setActiveLeadNome(thread.lead_nome)
  }

  const openLeadCard = () => {
    if (activeLeadId == null) return
    onClose()
    navigate(`/pipeline?id=${activeLeadId}`)
  }

  return (
    <div
      {...{ [FLOATING_UI_ROOT_ATTR]: '' }}
      data-floating-projeto-chat-root=""
      className={cn(
        'fixed pointer-events-auto',
        // Logo abaixo do ícone (h-14), para o botão continuar visível e clicável.
        'top-[calc(max(0.75rem,env(safe-area-inset-top))+4.25rem)] sm:top-[calc(1rem+4.25rem)]',
        FLOATING_PROJETO_CHAT_ICON_RIGHT,
        floatingAgendaPanelClass,
        'flex w-[min(calc(100vw-1.25rem),24rem)] flex-col overflow-hidden rounded-2xl',
        'shadow-[0_20px_48px_rgba(18,8,4,0.32)]',
        'origin-top-right animate-in fade-in zoom-in-95 duration-200',
        'h-[min(calc(100vh-6.5rem),38rem)] max-h-[min(calc(100vh-6.5rem),38rem)]',
      )}
      style={{
        background:
          'linear-gradient(165deg, rgba(255,252,248,0.98) 0%, rgba(255,248,238,0.97) 55%, rgba(240,249,255,0.96) 100%)',
        color: '#2a1812',
        border: '1px solid rgba(14, 116, 144, 0.38)',
      }}
      role="dialog"
      aria-modal="false"
      aria-label="Histórico de conversas do ateliê"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
        <ProjetosChatSheetAura
          pulse={unreadTotal > 0 ? 1.15 : 0.85}
          className="opacity-80"
        />
      </div>

      <header
        className="relative z-[1] flex shrink-0 items-center gap-2 px-3 py-2.5"
        style={{
          backgroundColor: 'rgba(255,248,238,0.92)',
          borderBottom: '1px solid rgba(42, 24, 18, 0.12)',
        }}
      >
        {showThread ? (
          <button
            type="button"
            onClick={() => setActiveLeadId(null)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-sky-100"
            style={{ color: '#0e7490' }}
            aria-label="Voltar para histórico"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              border: '1px solid rgba(14, 116, 144, 0.35)',
              backgroundColor: '#e0f2fe',
              color: '#0e7490',
            }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] tracking-[0.28em]" style={{ color: '#0e7490' }}>
            ATELIÊ
          </p>
          {showThread && activeLeadNome ? (
            <button
              type="button"
              onClick={openLeadCard}
              className="block w-full truncate text-left text-sm font-semibold hover:underline"
              style={{ color: '#2a1812' }}
              title="Abrir card do lead"
            >
              {activeLeadNome}
            </button>
          ) : (
            <p className="truncate text-sm font-semibold" style={{ color: '#2a1812' }}>
              Histórico de conversas
              {unreadTotal > 0 ? (
                <span className="ml-1.5 text-[11px] font-medium" style={{ color: '#0284c7' }}>
                  · {unreadTotal} não lida{unreadTotal === 1 ? '' : 's'}
                </span>
              ) : null}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5"
          style={{ color: '#5c4638' }}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {!showThread ? (
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className="shrink-0 px-3 pb-2 pt-2.5"
            style={{ borderBottom: '1px solid rgba(42, 24, 18, 0.08)' }}
          >
            <label className="relative block">
              <span className="sr-only">Pesquisar conversas</span>
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: '#0e7490' }}
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, mensagem…"
                className={cn(
                  'h-9 rounded-xl border-[rgba(14,116,144,0.28)] bg-white/80 pl-8 pr-8 text-[13px]',
                  'placeholder:text-[#8a7364] focus-visible:ring-sky-300/60',
                )}
                autoComplete="off"
                spellCheck={false}
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full hover:bg-black/5"
                  style={{ color: '#5c4638' }}
                  aria-label="Limpar busca"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </label>
            <p className="mt-1.5 px-0.5 text-[10px] tabular-nums" style={{ color: '#8a7364' }}>
              {loadingBoard
                ? 'Carregando histórico…'
                : `${filteredThreads.length} de ${boardThreads.length} conversa${boardThreads.length === 1 ? '' : 's'}`}
            </p>
          </div>

          <ul
            className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2"
            style={{ backgroundColor: 'transparent' }}
          >
            {loadingBoard ? (
              <li className="px-3 py-10 text-center text-sm" style={{ color: '#5c4638' }}>
                Carregando conversas…
              </li>
            ) : filteredThreads.length === 0 ? (
              <li className="px-3 py-10 text-center text-sm" style={{ color: '#5c4638' }}>
                {search.trim()
                  ? 'Nenhuma conversa combina com a busca.'
                  : 'Ainda não há conversas no histórico.'}
              </li>
            ) : (
              filteredThreads.map(({ thread, unreadCount }) => (
                <li key={thread.lead_id}>
                  <div
                    className={cn(
                      'group flex w-full items-start gap-2 rounded-xl px-2 py-2 transition-colors',
                      unreadCount > 0 ? 'bg-sky-50/90 hover:bg-sky-100/90' : 'hover:bg-white/70',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openThread(thread)}
                      className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg px-0.5 py-0.5 text-left"
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          unreadCount > 0 && 'animate-pulse',
                        )}
                        style={{
                          backgroundColor: unreadCount > 0 ? '#0284c7' : 'rgba(42,24,18,0.22)',
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className="truncate text-[14px] font-semibold"
                            style={{ color: '#1a100c' }}
                          >
                            {thread.lead_nome}
                          </span>
                          <span
                            className="shrink-0 text-[10px] tabular-nums"
                            style={{ color: '#5c4638' }}
                          >
                            {previewHora(thread.last.criado_em)}
                          </span>
                        </span>
                        {thread.titular_nome ? (
                          <span
                            className="mt-0.5 block truncate text-[10px]"
                            style={{ color: '#8a7364' }}
                          >
                            Titular: {thread.titular_nome}
                          </span>
                        ) : null}
                        <span
                          className="mt-0.5 block truncate text-[12px]"
                          style={{ color: '#3d2c22' }}
                        >
                          {previewMensagem(thread)}
                        </span>
                      </span>
                      {unreadCount > 0 ? (
                        <span
                          className="mt-0.5 inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: '#0284c7', color: '#ffffff' }}
                          title={`${unreadCount} não lida${unreadCount === 1 ? '' : 's'}`}
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      ) : null}
                    </button>

                    {unreadCount === 0 ? (
                      <button
                        type="button"
                        disabled={isMarkingUnread}
                        onClick={(event) => {
                          event.stopPropagation()
                          markLeadChatUnread(thread.lead_id)
                        }}
                        className={cn(
                          'mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2',
                          'border border-[rgba(14,116,144,0.35)] bg-white/90 text-[10px] font-medium',
                          'hover:bg-sky-50 disabled:opacity-50',
                          'opacity-100 sm:opacity-80 sm:group-hover:opacity-100',
                        )}
                        style={{ color: '#0e7490' }}
                        title={`Marcar conversa de ${thread.lead_nome} como não lida`}
                        aria-label={`Marcar conversa de ${thread.lead_nome} como não lida`}
                      >
                        <MailOpen className="h-3.5 w-3.5" />
                        <span className="hidden min-[380px]:inline">Não lida</span>
                      </button>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : (
        <div
          className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{ backgroundColor: 'transparent' }}
        >
          <div
            className="flex shrink-0 items-center justify-end gap-2 px-3 py-1.5"
            style={{ borderBottom: '1px solid rgba(42, 24, 18, 0.1)' }}
          >
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
                'border border-[rgba(14,116,144,0.35)] bg-white/90 text-[11px] font-medium',
                'hover:bg-sky-50 disabled:opacity-50',
              )}
              style={{ color: '#0e7490' }}
              disabled={isMarkingUnread || activeLeadId == null}
              onClick={() => {
                if (activeLeadId == null) return
                markLeadChatUnread(activeLeadId)
              }}
              title="Marcar esta conversa como não lida"
              aria-label="Marcar esta conversa como não lida"
            >
              <MailOpen className="h-3.5 w-3.5" />
              Marcar não lida
            </button>
          </div>
          {loadingNotas ? (
            <p className="min-h-0 flex-1 overflow-y-auto px-3 py-8 text-center text-sm" style={{ color: '#5c4638' }}>
              Carregando conversa…
            </p>
          ) : (
            <ProjetoChatThread
              notas={notas}
              currentUserId={user?.id}
              currentUserRoles={userRoles}
              lastReadAt={activeLastRead}
              className="min-h-0 flex-1 px-3 pt-3"
              markUnreadPending={isMarkingUnread}
              onMarkUnread={(nota) => {
                if (activeLeadId == null) return
                markLeadChatUnread(activeLeadId, nota.criado_em)
              }}
            />
          )}
          <div className="shrink-0 p-3" style={{ borderTop: '1px solid rgba(42, 24, 18, 0.1)' }}>
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
