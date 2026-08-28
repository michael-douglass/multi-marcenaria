import { useRef } from 'react'
import { Calendar, Calculator, DollarSign, GripVertical } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, fmtCur, fmtDate } from '@/lib/utils'
import type { CrmLeadCard } from '@/lib/crm-pipeline'
import { MarkupCardPreview } from '@/components/crm/MarkupCardPreview'
import type { MarkupLeadResumo } from '@/lib/markup-types'

const originColors: Record<string, string> = {
  Formulário: 'bg-primary text-primary-foreground',
  WhatsApp: 'bg-success text-success-foreground',
  'Redes Sociais': 'bg-warning text-warning-foreground',
  Indicação: 'bg-accent text-accent-foreground',
  'Pontua Garbo': 'bg-gold/20 text-gold border border-gold/35',
  Outros: 'bg-muted text-muted-foreground',
}

interface PipelineLeadCardProps {
  lead: CrmLeadCard
  dragging?: boolean
  markupResumo?: MarkupLeadResumo | null
  canOpenMarkup?: boolean
  onOpen: (lead: CrmLeadCard) => void
  onOpenMarkup?: (lead: CrmLeadCard) => void
  onDragStart: (leadId: number) => void
  onDragEnd: () => void
}

export function PipelineLeadCard({
  lead,
  dragging,
  markupResumo,
  canOpenMarkup = false,
  onOpen,
  onOpenMarkup,
  onDragStart,
  onDragEnd,
}: PipelineLeadCardProps) {
  const origem = lead.origem || 'Outros'
  const valor = Number(lead.valorOrcamento || lead.valorNegocio)
  const draggedRef = useRef(false)
  const temPreco = Boolean(markupResumo && markupResumo.preco_final > 0)
  const mostrarMarkup = temPreco || (canOpenMarkup && onOpenMarkup)

  return (
    <div className="w-full min-w-0">
      <Card
        onClick={() => {
          if (draggedRef.current) {
            draggedRef.current = false
            return
          }
          onOpen(lead)
        }}
        className={cn(
          'w-full min-w-0 cursor-pointer overflow-hidden bg-card transition-all hover:shadow-md',
          dragging && 'z-50 scale-[1.03] rotate-1 opacity-95 shadow-xl ring-2 ring-primary/30',
        )}
      >
        {lead.vendedorNome && (
          <div className="border-b border-border/60 bg-mahogany-muted/50 px-2.5 py-1 text-[10px] font-medium text-gold">
            {lead.vendedorNome}
          </div>
        )}
        <div className="space-y-1.5 p-2.5">
          <div className="flex items-start justify-between gap-1.5">
            <button
              type="button"
              draggable
              aria-label="Arrastar card"
              className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 hover:bg-muted/40 hover:text-muted-foreground active:cursor-grabbing"
              onClick={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              onDragStart={e => {
                draggedRef.current = true
                e.stopPropagation()
                e.dataTransfer.setData('text/plain', String(lead.id))
                e.dataTransfer.effectAllowed = 'move'
                onDragStart(lead.id)
              }}
              onDragEnd={() => {
                onDragEnd()
                window.setTimeout(() => {
                  draggedRef.current = false
                }, 0)
              }}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-foreground">{lead.nome}</p>
            {lead.darAtencao && (
              <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
                Atenção
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span
              className={cn(
                'inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold',
                originColors[origem] ?? originColors.Outros,
              )}
            >
              {origem}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {fmtDate(lead.dataChegada)}
            </span>
          </div>
          {lead.telefone && (
            <p className="truncate text-[11px] text-cream-muted">{lead.telefone}</p>
          )}
          {valor > 0 && (
            <p className="flex items-center gap-1 text-[12px] font-semibold tabular-nums text-success">
              <DollarSign className="h-3 w-3" />
              {fmtCur(valor)}
            </p>
          )}
          {mostrarMarkup && (
            <div className="relative z-10 min-w-0">
              {temPreco ? (
                <MarkupCardPreview
                  resumo={markupResumo}
                  compact
                  readOnly={!canOpenMarkup}
                  onClick={
                    canOpenMarkup && onOpenMarkup
                      ? e => {
                          e.preventDefault()
                          e.stopPropagation()
                          onOpenMarkup(lead)
                        }
                      : undefined
                  }
                />
              ) : canOpenMarkup && onOpenMarkup ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-full border-emerald-500/30 text-[10px] text-emerald-200"
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    onOpenMarkup(lead)
                  }}
                  onPointerDown={e => e.stopPropagation()}
                >
                  <Calculator className="h-3 w-3" />
                  Markup
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
