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
import { MIN_CARACTERES_BUSCA_PRODUCAO } from '@/lib/projetos-producao'
import {
  useObraProducaoMutations,
  useProducaoBuscaLeads,
  type ObraProducao,
} from '@/hooks/useObraProducao'

interface AdicionarLeadProducaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cards: ObraProducao[]
  onPuxado?: (leadId: number) => void
}

export function AdicionarLeadProducaoDialog({
  open,
  onOpenChange,
  cards,
  onPuxado,
}: AdicionarLeadProducaoDialogProps) {
  const [value, setValue] = useState('')
  const [debounced, setDebounced] = useState('')
  const { puxarLead } = useObraProducaoMutations()
  const boardIds = useMemo(() => new Set(cards.map((c) => c.lead_id)), [cards])

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), 280)
    return () => window.clearTimeout(id)
  }, [value])

  useEffect(() => {
    if (!open) {
      setValue('')
      setDebounced('')
    }
  }, [open])

  const remoteEnabled = debounced.trim().length >= MIN_CARACTERES_BUSCA_PRODUCAO
  const { data: remote = [], isFetching } = useProducaoBuscaLeads(remoteEnabled ? debounced : '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          '!fixed !left-1/2 !top-1/2 !z-50 w-[calc(100vw-1.5rem)] max-w-lg',
          '!translate-x-[-50%] !translate-y-[-50%]',
          'max-h-[min(85dvh,640px)] overflow-hidden border-[#2a3a36]/12 bg-[#fffcf7] p-0',
          'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        )}
      >
        {/* Fundo claro (sem WebGL — evita esticar o dialog) */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(45,140,120,0.12),transparent_55%),linear-gradient(165deg,#fffcf7_0%,#f0f7f4_100%)]"
          aria-hidden
        />

        <div className="relative z-10 flex max-h-[min(85dvh,640px)] flex-col px-5 pb-5 pt-5">
          <DialogHeader className="shrink-0 space-y-2 text-left">
            <DialogTitle className="font-display text-2xl text-[#1c2824]">
              Adicionar lead
            </DialogTitle>
            <DialogDescription className="text-[#5a6b66]">
              Busque em todos os leads do sistema e puxe para{' '}
              <span className="font-medium text-[#a67c2d]">Projetos de produção pendentes</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-4 shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2d8c78]" />
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nome, telefone, empresa…"
              className="h-11 border-[#2a3a36]/15 bg-white/85 pl-10 text-[#24302c] shadow-sm"
            />
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#2a3a36]/10 bg-white/75">
            {!remoteEnabled ? (
              <p className="px-4 py-8 text-center text-sm text-[#6b7c76]">
                Digite pelo menos {MIN_CARACTERES_BUSCA_PRODUCAO} letras para buscar.
              </p>
            ) : isFetching ? (
              <p className="px-4 py-8 text-center text-sm text-[#6b7c76]">Buscando leads…</p>
            ) : remote.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#6b7c76]">Nenhum lead encontrado.</p>
            ) : (
              <ul className="divide-y divide-[#2a3a36]/8">
                {remote.map((lead) => {
                  const onBoard = boardIds.has(lead.id)
                  return (
                    <li key={lead.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[#1c2824]">{lead.nome}</p>
                        <p className="truncate text-[11px] text-[#6b7c76]">
                          {[lead.empresa, lead.telefone, lead.status].filter(Boolean).join(' · ') ||
                            `Lead #${lead.id}`}
                        </p>
                      </div>
                      {onBoard ? (
                        <span className="shrink-0 rounded-full bg-[#e8f6f1] px-2 py-0.5 text-[10px] font-medium text-[#1f5f52]">
                          Já no quadro
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0 gap-1 bg-[#2d8c78] text-white hover:bg-[#247a68]"
                          disabled={puxarLead.isPending}
                          onClick={() => {
                            void puxarLead.mutateAsync(lead.id).then((result) => {
                              if (!result.already) {
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

          <p className="mt-3 flex shrink-0 items-center gap-1.5 text-[11px] text-[#6b7c76]">
            <Plus className="h-3 w-3 text-[#2d8c78]" />
            O card entra na fila pendente. A Agenda de Obras não muda.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
