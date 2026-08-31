import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CheckCircle2, Compass, Hourglass, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KANBAN_COLUMN_WIDTH_CLASS } from '@/lib/kanban-column-layout'
import {
  classifyProjetoStage,
  columnKindLabel,
  emptyStateForKind,
  type ProjetoStageKind,
} from '@/lib/projetos-atelie'
import type { ProjetoStage } from '@/hooks/useLeadProjetos'
import { ProjetoVisitaColumnAura } from '@/components/projetos/ProjetoVisitaColumnAura'

interface ProjetoKanbanColumnProps {
  stage: ProjetoStage
  stages: ProjetoStage[]
  items: string[]
  count: number
  children: React.ReactNode
}

const kindShell: Record<ProjetoStageKind, string> = {
  waiting:
    'border-amber-300/70 bg-[#1c120c] shadow-[0_16px_36px_rgba(42,24,18,0.28)]',
  visita:
    'border-teal-300/70 bg-[#121614] shadow-[0_16px_36px_rgba(42,24,18,0.28)] [background-image:repeating-linear-gradient(135deg,rgba(94,234,212,0.08)_0_1px,transparent_1px_7px)]',
  feito:
    'border-emerald-300/70 bg-[#12160f] shadow-[0_16px_36px_rgba(42,24,18,0.28)]',
  other:
    'border-[#f2d892]/55 bg-[#1c120c] shadow-[0_16px_36px_rgba(42,24,18,0.28)]',
}

export function ProjetoKanbanColumn({
  stage,
  stages,
  items,
  count,
  children,
}: ProjetoKanbanColumnProps) {
  const kind = classifyProjetoStage(stage, stages)
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const Icon =
    kind === 'waiting' ? Hourglass : kind === 'visita' ? Compass : kind === 'feito' ? CheckCircle2 : Layers

  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.nome}, ${count} ${count === 1 ? 'projeto' : 'projetos'}`}
      className={cn(
        'kanban-dark-island relative z-10 flex h-full min-h-[12rem] flex-none flex-col snap-start rounded-2xl border',
        KANBAN_COLUMN_WIDTH_CLASS,
        kindShell[kind],
        isOver && 'ring-1 ring-sky-400/40',
      )}
    >
      <header className="flex shrink-0 items-start gap-2 border-b border-[#f2d892]/25 px-2.5 py-2.5 sm:px-3">
        {kind === 'visita' ? (
          <ProjetoVisitaColumnAura />
        ) : (
          <Icon
            className={cn(
              'mt-0.5 h-4 w-4',
              kind === 'waiting' && 'text-amber-300',
              kind === 'feito' && 'text-emerald-300',
              kind === 'other' && 'text-gold',
            )}
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] tracking-[0.2em] text-[#f6ead8]">
            {columnKindLabel(kind)}
          </p>
          <h3 className="line-clamp-2 text-[11px] font-semibold leading-snug text-[#fff8ee] sm:text-xs">
            {stage.nome}
          </h3>
          <p className="mt-0.5 text-[10px] tabular-nums text-[#f2d892]">{count}</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-2.5">
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 sm:gap-2.5">
            {count === 0 ? (
              <p className="px-1 py-6 text-center text-[11px] leading-relaxed text-[#f6ead8]">
                {emptyStateForKind(kind)}
              </p>
            ) : (
              children
            )}
          </div>
        </SortableContext>
      </div>
    </section>
  )
}
