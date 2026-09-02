import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Radio } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useLeadProjetoChatBoard,
  useLeadProjetoMutations,
  useLeadProjetoNotas,
  type LeadProjetoChatThread,
} from '@/hooks/useLeadProjetos'
import { useAuth } from '@/contexts/AuthContext'
import { ProjetoNotasAura } from '@/components/projetos/ProjetoNotasAura'
import { ProjetosChatWaveform } from '@/components/projetos/ProjetosChatWaveform'
import { ProjetosChatSheetAura } from '@/components/projetos/ProjetosChatSheetAura'
import { ProjetoChatThread } from '@/components/projetos/ProjetoChatThread'
import { ProjetoChatComposer } from '@/components/projetos/ProjetoChatComposer'
import { useIsMobile } from '@/hooks/use-mobile'

interface ProjetosChatPreviewProps {
  onOpenLead: (leadId: number) => void
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

export function ProjetosChatPreview({ onOpenLead }: ProjetosChatPreviewProps) {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const { data: threads = [] } = useLeadProjetoChatBoard({ realtime: true })
  const { adicionarNota } = useLeadProjetoMutations()
  const [open, setOpen] = useState(false)
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null)
  const { data: notas = [], isLoading: loadingNotas } = useLeadProjetoNotas(open ? activeLeadId : null)

  const pending = useMemo(
    () => threads.filter((thread) => thread.last.autor_id !== user?.id).length,
    [threads, user?.id],
  )
  const waveformMode = pending > 0 ? 'urgent' : threads.length > 0 ? 'active' : 'idle'
  const active = threads.find((thread) => thread.lead_id === activeLeadId) ?? threads[0] ?? null

  const openSheet = (thread?: LeadProjetoChatThread) => {
    setActiveLeadId(thread?.lead_id ?? threads[0]?.lead_id ?? null)
    setOpen(true)
  }

  return (
    <>
      {isMobile ? (
        <button
          type="button"
          onClick={() => openSheet()}
          className={cn(
            'relative w-full overflow-hidden rounded-[1.4rem] p-[3px] text-left',
            'bg-gradient-to-br from-sky-400 via-[#120c09] to-gold',
          )}
          aria-label="Abrir rádio do ateliê"
        >
          <div className="relative flex items-center gap-3 rounded-[1.25rem] bg-[#fffcf8] px-3 py-2.5">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-400/30 bg-[#120c09]">
              <Radio className="relative h-4 w-4 text-sky-200" />
              {pending > 0 ? (
                <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-sky-400" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-display text-[10px] tracking-[0.28em] text-[#0e7490]">RÁDIO</span>
                <span className="rounded-full border border-[rgba(42,24,18,0.14)] px-1.5 py-0.5 text-[10px] text-[#8d5e22]">
                  {threads.length} {threads.length === 1 ? 'conversa' : 'conversas'}
                </span>
                {pending > 0 ? (
                  <span className="rounded-full border border-sky-400/40 bg-sky-950/50 px-1.5 py-0.5 text-[10px] text-sky-200">
                    {pending} a responder
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block truncate text-xs text-[#6b5244]">
                {threads[0]
                  ? `${threads[0].lead_nome} — ${previewMensagem(threads[0])}`
                  : 'Titular e projetista ainda não escreveram.'}
              </span>
            </span>
          </div>
        </button>
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
                <ul className="mt-2 max-h-[min(18.5rem,46vh)] space-y-1 overflow-y-auto touch-pan-y">
                  {threads.slice(0, 4).map((thread) => {
                    const needs = thread.last.autor_id !== user?.id
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
                            <span className="block line-clamp-2 text-[13px] font-medium leading-snug text-gold">
                              {thread.lead_nome}
                            </span>
                            <span className="mt-0.5 block line-clamp-2 text-[12px] leading-5 text-cream-secondary">
                              {previewMensagem(thread)}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                  {threads.length === 0 ? (
                    <li className="px-1 py-2 text-xs leading-5 text-cream-secondary">
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
        <SheetContent className="flex h-full w-full flex-col border-gold/20 bg-[#120c09] p-0 sm:max-w-3xl">
          <div className="relative overflow-hidden border-b border-gold/15">
            <ProjetosChatSheetAura pulse={waveformMode === 'urgent' ? 1.2 : 0.85} />
            <SheetHeader className="relative space-y-2 px-5 py-4 pr-12 text-left">
              <SheetTitle className="font-display text-xl tracking-wide text-gold">Rádio do ateliê</SheetTitle>
              <p className="text-sm leading-5 text-cream-secondary">
                Titular e projetista no mesmo fio.
              </p>
              <ProjetosChatWaveform mode={waveformMode} className="h-6" />
            </SheetHeader>
          </div>
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(12rem,34%)_minmax(0,1fr)] md:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] md:grid-rows-1">
            <ul className="space-y-1 overflow-y-auto border-b border-gold/10 p-3 md:border-b-0 md:border-r">
              {threads.map((thread) => {
                const selected = thread.lead_id === active?.lead_id
                const needs = thread.last.autor_id !== user?.id
                return (
                  <li key={thread.lead_id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left',
                        selected ? 'bg-gold/12 ring-1 ring-gold/25' : 'hover:bg-white/5',
                      )}
                      onClick={() => setActiveLeadId(thread.lead_id)}
                    >
                      {needs ? (
                        <span className="mt-2 h-2 w-2 shrink-0 animate-pulse rounded-full bg-sky-400" />
                      ) : (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-white/10" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              'line-clamp-2 text-[15px] font-medium leading-snug [overflow-wrap:anywhere]',
                              selected ? 'text-gold' : 'text-cream-secondary',
                            )}
                          >
                            {thread.lead_nome}
                          </span>
                          <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-cream-muted">
                            {previewHora(thread.last.criado_em)}
                          </span>
                        </span>
                        {thread.titular_nome ? (
                          <span className="mt-0.5 block truncate text-xs text-gold/85">
                            {thread.titular_nome}
                          </span>
                        ) : null}
                        <span className="mt-1 block line-clamp-2 text-[13px] leading-5 text-cream-secondary">
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
                  <div className="mb-3 flex items-start justify-between gap-3 border-b border-gold/10 pb-3">
                    <div className="min-w-0">
                      <p className="text-base font-medium leading-snug text-cream-secondary [overflow-wrap:anywhere]">
                        {active.lead_nome}
                      </p>
                      {active.titular_nome ? (
                        <p className="mt-0.5 text-sm text-gold/90">{active.titular_nome}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-gold/25 text-gold"
                      onClick={() => {
                        const leadId = active.lead_id
                        setOpen(false)
                        window.setTimeout(() => onOpenLead(leadId), 180)
                      }}
                    >
                      Abrir card
                    </Button>
                  </div>
                  {loadingNotas ? (
                    <p className="p-6 text-center text-sm text-cream-secondary">Abrindo o canal…</p>
                  ) : (
                    <ProjetoChatThread
                      notas={notas}
                      currentUserId={user?.id}
                      className="min-h-0 flex-1"
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
                <p className="p-6 text-center text-sm leading-6 text-cream-secondary">
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
