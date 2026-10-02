import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MailOpen, Radio } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useLeadProjetoChatBoard,
  useLeadProjetoMutations,
  useLeadProjetoNotas,
  type LeadProjetoChatThread,
} from '@/hooks/useLeadProjetos'
import { useProjetoChatUnread } from '@/hooks/useProjetoChatUnread'
import { useAuth } from '@/contexts/AuthContext'
import { ProjetoNotasAura } from '@/components/projetos/ProjetoNotasAura'
import { ProjetosChatWaveform } from '@/components/projetos/ProjetosChatWaveform'
import { ProjetosChatSheetAura } from '@/components/projetos/ProjetosChatSheetAura'
import { ProjetoChatThread } from '@/components/projetos/ProjetoChatThread'
import { ProjetoChatComposer } from '@/components/projetos/ProjetoChatComposer'
import { useIsMobile } from '@/hooks/use-mobile'

interface ProjetosChatPreviewProps {
  onOpenLead: (leadId: number) => void
  /**
   * Dock horizontal no cabeçalho: usa a largura livre, altura baixa.
   * No celular continua como botão-resumo.
   */
  compact?: boolean
}

function previewMensagem(thread: LeadProjetoChatThread): string {
  const msg = thread.last.mensagem.trim()
  if (!msg || msg === '📷 Imagem') return thread.last.imagem_url ? 'Imagem' : 'Sem texto'
  return msg
}

function previewHora(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return format(date, 'HH:mm')
  }
  return format(date, 'dd/MM', { locale: ptBR })
}

export function ProjetosChatPreview({ onOpenLead, compact = false }: ProjetosChatPreviewProps) {
  const { user, userRoles } = useAuth()
  const isMobile = useIsMobile()
  const { data: threads = [] } = useLeadProjetoChatBoard({ realtime: true })
  const { adicionarNota } = useLeadProjetoMutations()
  const {
    unreadLeadIds,
    lastReadByLead,
    markLeadChatRead,
    markLeadChatUnread,
    isMarkingUnread,
  } = useProjetoChatUnread({ realtime: true })
  const [open, setOpen] = useState(false)
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null)
  const { data: notas = [], isLoading: loadingNotas } = useLeadProjetoNotas(open ? activeLeadId : null)

  useEffect(() => {
    if (!open || activeLeadId == null) return
    markLeadChatRead(activeLeadId)
  }, [activeLeadId, markLeadChatRead, open])

  const pending = unreadLeadIds.size
  const waveformMode = pending > 0 ? 'urgent' : threads.length > 0 ? 'active' : 'idle'
  const active = threads.find((thread) => thread.lead_id === activeLeadId) ?? threads[0] ?? null
  const showMobileStrip = isMobile
  const showDock = compact && !isMobile
  const activeLastRead = activeLeadId != null ? lastReadByLead[activeLeadId] ?? null : null

  const openSheet = (thread?: LeadProjetoChatThread) => {
    setActiveLeadId(thread?.lead_id ?? threads[0]?.lead_id ?? null)
    setOpen(true)
  }

  return (
    <>
      {showMobileStrip ? (
        <button
          type="button"
          onClick={() => openSheet()}
          className="relative w-full min-w-0 overflow-hidden rounded-xl bg-gradient-to-br from-sky-400/60 via-[#120c09] to-gold/60 p-[2px] text-left"
          aria-label="Abrir rádio do ateliê"
        >
          <div className="relative flex items-center gap-2.5 rounded-[0.65rem] bg-[#fffcf8] px-2.5 py-1.5">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-400/30 bg-[#120c09]">
              <Radio className="relative h-3.5 w-3.5 text-sky-200" />
              {pending > 0 ? (
                <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-sky-400" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-display text-[9px] tracking-[0.28em] text-[#0e7490]">RÁDIO</span>
                <span className="rounded-full border border-[rgba(42,24,18,0.14)] px-1.5 py-0.5 text-[10px] text-[#8d5e22]">
                  {threads.length} {threads.length === 1 ? 'conversa' : 'conversas'}
                </span>
                {pending > 0 ? (
                  <span className="rounded-full border border-sky-400/40 bg-sky-950/50 px-1.5 py-0.5 text-[10px] text-sky-200">
                    {pending} a responder
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-[#6b5244]">
                {threads[0]
                  ? `${threads[0].lead_nome} — ${previewMensagem(threads[0])}`
                  : 'Titular e projetista ainda não escreveram.'}
              </span>
            </span>
          </div>
        </button>
      ) : showDock ? (
        <article
          className={cn(
            'projetos-radio-dock relative min-w-0 overflow-hidden rounded-xl p-[2px]',
            'bg-gradient-to-br from-sky-400/55 via-[#120c09] to-gold/55',
          )}
        >
          <div
            className="relative flex min-h-[4.75rem] flex-col justify-between gap-1.5 rounded-[0.65rem] bg-[#fffcf8] px-2.5 py-2"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 80% 120% at 0% 50%, rgba(14,116,144,0.07), transparent 55%), radial-gradient(ellipse 60% 100% at 100% 0%, rgba(242,216,146,0.1), transparent 50%)',
            }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-400/35 bg-[#120c09]"
                onClick={() => openSheet()}
                aria-label="Abrir rádio do ateliê"
              >
                <ProjetoNotasAura className="absolute inset-0 h-8 w-8 opacity-80" />
                <Radio className="relative h-3.5 w-3.5 text-sky-100" />
                {pending > 0 ? (
                  <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-[#fffcf8]" />
                ) : null}
              </button>

              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <p className="font-display text-[9px] tracking-[0.28em] text-[#0e7490]">RÁDIO</p>
                <span className="rounded-full border border-[rgba(42,24,18,0.12)] px-1.5 py-0.5 text-[10px] text-[#8d5e22]">
                  {threads.length} {threads.length === 1 ? 'conversa' : 'conversas'}
                </span>
                {pending > 0 ? (
                  <span className="animate-pulse rounded-full border border-sky-400/45 bg-sky-950/55 px-1.5 py-0.5 text-[10px] text-sky-100">
                    {pending} a responder
                  </span>
                ) : null}
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 border-sky-700/25 px-2 text-[11px] text-sky-900 hover:bg-sky-50"
                onClick={() => openSheet()}
              >
                Abrir chat
              </Button>
            </div>

            <div className="flex min-w-0 items-stretch gap-2">
              <ul
                className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label="Conversas recentes do rádio"
              >
                {threads.length === 0 ? (
                  <li className="flex min-h-[2.35rem] flex-1 items-center rounded-lg border border-dashed border-[rgba(42,24,18,0.14)] px-3 text-[11px] text-[#8a7060]">
                    Ainda sem mensagens — quando alguém escrever, aparece aqui.
                  </li>
                ) : (
                  threads.slice(0, 12).map((thread) => {
                    const needs = unreadLeadIds.has(thread.lead_id)
                    return (
                      <li key={thread.lead_id} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => openSheet(thread)}
                          className={cn(
                            'group flex h-full min-h-[2.35rem] w-[min(11.5rem,42vw)] flex-col justify-center rounded-lg border px-2 py-1.5 text-left transition-colors',
                            needs
                              ? 'border-sky-400/45 bg-sky-950/[0.06] hover:bg-sky-950/10'
                              : 'border-[rgba(42,24,18,0.1)] bg-white/55 hover:border-[#8d5e22]/35 hover:bg-[#fff8ee]',
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            {needs ? (
                              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-sky-500" />
                            ) : null}
                            <span className="truncate text-[11px] font-semibold text-[#2a1812]">
                              {thread.lead_nome}
                            </span>
                            <span className="ml-auto shrink-0 text-[9px] tabular-nums text-[#8a7060]">
                              {previewHora(thread.last.criado_em)}
                            </span>
                          </span>
                          <span className="mt-0.5 truncate text-[10px] leading-tight text-[#6b5244]">
                            {previewMensagem(thread)}
                          </span>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
              <div className="hidden w-16 shrink-0 self-center sm:block">
                <ProjetosChatWaveform mode={waveformMode} className="h-6" />
              </div>
            </div>
          </div>
        </article>
      ) : (
        <article
          className={cn(
            'relative min-w-0 overflow-hidden rounded-[1.7rem] p-[3px] md:max-w-[24rem]',
            'bg-gradient-to-br from-sky-400 via-[#120c09] to-gold',
            'transition-transform duration-700 hover:-translate-y-0.5',
          )}
        >
          <div
            className="relative rounded-[1.55rem] bg-[#fffcf8] px-3 py-3"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(125,211,252,0.05) 0 1px, transparent 1px 12px), repeating-linear-gradient(90deg, rgba(242,216,146,0.05) 0 1px, transparent 1px 12px)',
            }}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-sky-400/30"
                onClick={() => openSheet()}
                aria-label="Abrir rádio do ateliê"
              >
                <ProjetoNotasAura className="absolute inset-0 h-11 w-11" />
                <Radio className="relative h-4 w-4 text-sky-100" />
                {pending > 0 ? (
                  <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-sky-400" />
                ) : null}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-display text-[10px] tracking-[0.28em] text-[#0e7490]">RÁDIO</p>
                  <span className="rounded-full border border-[rgba(42,24,18,0.14)] px-1.5 py-0.5 text-[10px] text-[#8d5e22]">
                    {threads.length} {threads.length === 1 ? 'conversa' : 'conversas'}
                  </span>
                  {pending > 0 ? (
                    <span className="animate-pulse rounded-full border border-sky-400/40 bg-sky-950/50 px-1.5 py-0.5 text-[10px] text-sky-200">
                      {pending} a responder
                    </span>
                  ) : null}
                </div>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto touch-pan-y">
                  {threads.slice(0, 4).map((thread) => {
                    const needs = unreadLeadIds.has(thread.lead_id)
                    return (
                      <li key={thread.lead_id}>
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-[rgba(42,24,18,0.04)]"
                          onClick={() => openSheet(thread)}
                        >
                          {needs ? (
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-sky-400" />
                          ) : (
                            <span className="mt-2 h-1.5 w-1.5 shrink-0" />
                          )}
                          <span className="min-w-0">
                            <span className="block line-clamp-2 text-[13px] font-medium leading-snug text-[#8d5e22]">
                              {thread.lead_nome}
                            </span>
                            <span className="mt-0.5 block line-clamp-2 text-[12px] leading-5 text-[#6b5244]">
                              {previewMensagem(thread)}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                  {threads.length === 0 ? (
                    <li className="px-1 py-2 text-xs leading-5 text-[#6b5244]">
                      Titular e projetista ainda não escreveram.
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
            <div className="mt-2 h-7">
              <ProjetosChatWaveform mode={waveformMode} />
            </div>
          </div>
        </article>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex h-full w-full flex-col border-[#8d5e22]/20 bg-[#f8f4ee] p-0 sm:max-w-3xl">
          <div className="relative overflow-hidden border-b border-[rgba(42,24,18,0.1)]">
            <ProjetosChatSheetAura pulse={waveformMode === 'urgent' ? 1.2 : 0.85} />
            <SheetHeader className="relative space-y-2 px-5 py-4 pr-12 text-left">
              <SheetTitle className="font-display text-xl tracking-wide text-[#8d5e22]">Rádio do ateliê</SheetTitle>
              <p className="text-sm leading-5 text-[#6b5244]">
                Cada um vê só o que foi enviado para ele. Administradores veem tudo.
              </p>
              <ProjetosChatWaveform mode={waveformMode} className="h-6" />
            </SheetHeader>
          </div>
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(12rem,34%)_minmax(0,1fr)] md:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] md:grid-rows-1">
            <ul className="space-y-1 overflow-y-auto border-b border-[rgba(42,24,18,0.08)] p-3 md:border-b-0 md:border-r">
              {threads.map((thread) => {
                const selected = thread.lead_id === active?.lead_id
                const needs = unreadLeadIds.has(thread.lead_id)
                return (
                  <li key={thread.lead_id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left',
                        selected ? 'bg-[#8d5e22]/10 ring-1 ring-[#8d5e22]/25' : 'hover:bg-[#2a1812]/5',
                      )}
                      onClick={() => setActiveLeadId(thread.lead_id)}
                    >
                      {needs ? (
                        <span className="mt-2 h-2 w-2 shrink-0 animate-pulse rounded-full bg-sky-400" />
                      ) : (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#2a1812]/10" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              'line-clamp-2 text-[15px] font-medium leading-snug [overflow-wrap:anywhere]',
                              selected ? 'text-[#8d5e22]' : 'text-[#2a1812]',
                            )}
                          >
                            {thread.lead_nome}
                          </span>
                          <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-[#8a7060]">
                            {previewHora(thread.last.criado_em)}
                          </span>
                        </span>
                        {thread.titular_nome ? (
                          <span className="mt-0.5 block truncate text-xs text-[#8d5e22]/85">
                            {thread.titular_nome}
                          </span>
                        ) : null}
                        <span className="mt-1 block line-clamp-2 text-[13px] leading-5 text-[#6b5244]">
                          {previewMensagem(thread)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="flex min-h-0 flex-col p-4">
              {active ? (
                <>
                  <div className="mb-3 flex items-start justify-between gap-3 border-b border-[rgba(42,24,18,0.08)] pb-3">
                    <div className="min-w-0">
                      <p className="text-base font-medium leading-snug text-[#2a1812] [overflow-wrap:anywhere]">
                        {active.lead_nome}
                      </p>
                      {active.titular_nome ? (
                        <p className="mt-0.5 text-sm text-[#8d5e22]/90">{active.titular_nome}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 px-2 text-[11px] text-[#8a7060] hover:text-[#8d5e22]"
                        disabled={isMarkingUnread}
                        onClick={() => markLeadChatUnread(active.lead_id)}
                      >
                        <MailOpen className="h-3.5 w-3.5" />
                        Não lida
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-[#8d5e22]/25 text-[#8d5e22]"
                        onClick={() => {
                          const leadId = active.lead_id
                          setOpen(false)
                          window.setTimeout(() => onOpenLead(leadId), 180)
                        }}
                      >
                        Abrir card
                      </Button>
                    </div>
                  </div>
                  {loadingNotas ? (
                    <p className="p-6 text-center text-sm text-[#6b5244]">Abrindo o canal…</p>
                  ) : (
                    <ProjetoChatThread
                      notas={notas}
                      currentUserId={user?.id}
                      currentUserRoles={userRoles}
                      lastReadAt={activeLastRead}
                      className="min-h-0 flex-1"
                      markUnreadPending={isMarkingUnread}
                      onMarkUnread={(nota) =>
                        markLeadChatUnread(active.lead_id, nota.criado_em)
                      }
                    />
                  )}
                  <div className="mt-3">
                    <ProjetoChatComposer
                      compact
                      disabled={adicionarNota.isPending}
                      onSend={({ mensagem, file }) =>
                        adicionarNota.mutate({ leadId: active.lead_id, mensagem, file })
                      }
                    />
                  </div>
                </>
              ) : (
                <p className="p-6 text-center text-sm leading-6 text-[#6b5244]">
                  Titular e projetista ainda não escreveram. Quando alguém mandar, o aviso acende no card.
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
