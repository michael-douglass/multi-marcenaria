import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  classifyProjetoStage,
  getWaitingProjetoStageId,
  MIN_CARACTERES_BUSCA_PROJETOS,
  normalizeProjetoStageName,
} from '@/lib/projetos-atelie'
import {
  useLeadProjetoMutations,
  useProjetoStages,
  useProjetosBuscaLeads,
  type LeadProjeto,
  type ProjetoStage,
} from '@/hooks/useLeadProjetos'

interface AdicionarLeadProjetoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetos: LeadProjeto[]
  onPuxado?: (leadId: number) => void
}

function defaultStageId(stages: ProjetoStage[]): string | null {
  const andamento = stages.find((stage) => {
    const n = normalizeProjetoStageName(stage.nome)
    return n.includes('andamento') || n.includes('em andamento')
  })
  if (andamento) return andamento.id
  return getWaitingProjetoStageId(stages)
}

export function AdicionarLeadProjetoDialog({
  open,
  onOpenChange,
  projetos,
  onPuxado,
}: AdicionarLeadProjetoDialogProps) {
  const { data: stages = [] } = useProjetoStages()
  const { puxarParaProjeto } = useLeadProjetoMutations()
  const [value, setValue] = useState('')
  const [debounced, setDebounced] = useState('')
  const [stageId, setStageId] = useState<string>('')
  const boardIds = useMemo(() => new Set(projetos.map((p) => p.lead_id)), [projetos])

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), 280)
    return () => window.clearTimeout(id)
  }, [value])

  useEffect(() => {
    if (!open) {
      setValue('')
      setDebounced('')
      return
    }
    const preferred = defaultStageId(stages)
    if (preferred) setStageId(preferred)
  }, [open, stages])

  const remoteEnabled = debounced.trim().length >= MIN_CARACTERES_BUSCA_PROJETOS
  const { data: remote = [], isFetching } = useProjetosBuscaLeads(remoteEnabled ? debounced : '')
  const selectedStage = stages.find((stage) => stage.id === stageId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          '!fixed !left-1/2 !top-1/2 !z-50 w-[calc(100vw-1.5rem)] max-w-lg',
          '!translate-x-[-50%] !translate-y-[-50%]',
          'max-h-[min(88dvh,720px)] overflow-hidden border-[#c9a35a]/35 bg-[#fff8ee] p-0',
          'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(242,216,146,0.35),transparent_50%),radial-gradient(ellipse_at_90%_20%,rgba(125,211,252,0.14),transparent_45%),linear-gradient(165deg,#fff8ee_0%,#f3ebe0_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(0deg,transparent,transparent_11px,#2a1812_12px)]"
          aria-hidden
        />

        <div className="relative z-10 flex max-h-[min(88dvh,720px)] flex-col px-5 pb-5 pt-5">
          <DialogHeader className="shrink-0 space-y-2 text-left">
            <p className="font-display text-[10px] tracking-[0.28em] text-[#8d5e22]">ATELIÊ</p>
            <DialogTitle className="font-display text-2xl text-[#2a1812]">
              Puxar lead
            </DialogTitle>
            <DialogDescription className="text-[#6b5244]">
              Busque um lead que já existe e escolha a coluna do ateliê.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 shrink-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8d5e22]">
              Coluna de destino
            </p>
            <div className="flex flex-wrap gap-1.5">
              {stages.map((stage) => {
                const kind = classifyProjetoStage(stage, stages)
                const active = stage.id === stageId
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setStageId(stage.id)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                      active && kind === 'waiting' && 'border-amber-500/50 bg-amber-100 text-amber-900',
                      active && kind === 'visita' && 'border-teal-500/50 bg-teal-50 text-teal-900',
                      active && kind === 'feito' && 'border-emerald-500/50 bg-emerald-50 text-emerald-900',
                      active && kind === 'other' && 'border-sky-500/50 bg-sky-50 text-sky-900',
                      !active && 'border-[#8d5e22]/20 bg-white/70 text-[#6b5244] hover:border-[#8d5e22]/40',
                    )}
                  >
                    {stage.nome}
                  </button>
                )
              })}
            </div>
            {selectedStage ? (
              <p className="text-[11px] text-[#6b5244]">
                Destino: <span className="font-semibold text-[#2a1812]">{selectedStage.nome}</span>
              </p>
            ) : null}
          </div>

          <div className="relative mt-4 shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d5e22]" />
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nome, telefone, empresa…"
              className="h-11 border-[#8d5e22]/25 bg-white/85 pl-10 text-[#2a1812] shadow-sm"
            />
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#8d5e22]/15 bg-white/80">
            {!remoteEnabled ? (
              <p className="px-4 py-8 text-center text-sm text-[#6b5244]">
                Digite pelo menos {MIN_CARACTERES_BUSCA_PROJETOS} letras para buscar.
              </p>
            ) : isFetching ? (
              <p className="px-4 py-8 text-center text-sm text-[#6b5244]">Buscando leads…</p>
            ) : remote.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#6b5244]">Nenhum lead encontrado.</p>
            ) : (
              <ul className="divide-y divide-[#8d5e22]/10">
                {remote.map((lead) => {
                  const onBoard = boardIds.has(lead.id)
                  return (
                    <li key={lead.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[#2a1812]">{lead.nome}</p>
                        <p className="truncate text-[11px] text-[#6b5244]">
                          {[lead.empresa, lead.telefone, lead.status].filter(Boolean).join(' · ') ||
                            `Lead #${lead.id}`}
                        </p>
                      </div>
                      {onBoard ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0 gap-1 border-[#8d5e22]/30 text-[#8d5e22]"
                          disabled={puxarParaProjeto.isPending || !stageId}
                          onClick={() => {
                            void puxarParaProjeto
                              .mutateAsync({ leadId: lead.id, stageId })
                              .then((result) => {
                                if (result.moved || !result.already) {
                                  onPuxado?.(lead.id)
                                  onOpenChange(false)
                                }
                              })
                          }}
                        >
                          Mover
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0 gap-1 bg-[#c9a35a] text-[#1a120e] hover:bg-[#b8924a]"
                          disabled={puxarParaProjeto.isPending || !stageId}
                          onClick={() => {
                            void puxarParaProjeto
                              .mutateAsync({ leadId: lead.id, stageId })
                              .then((result) => {
                                if (!result.already || result.moved) {
                                  onPuxado?.(lead.id)
                                  onOpenChange(false)
                                }
                              })
                          }}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Puxar
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <p className="mt-3 flex shrink-0 items-center gap-1.5 text-[11px] text-[#6b5244]">
            <Plus className="h-3 w-3 text-[#8d5e22]" />
            Dica: escolha “Projeto em andamento” para cair direto nessa coluna.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
