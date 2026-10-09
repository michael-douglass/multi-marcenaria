import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CheckCircle2, Hammer, Hourglass, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KANBAN_COLUMN_WIDTH_CLASS } from '@/lib/kanban-column-layout'
import {
  classifyProducaoStage,
  columnKindLabelProducao,
  emptyStateForProducaoKind,
} from '@/lib/projetos-producao'
import { resolveProducaoStageCor } from '@/lib/producao-stage-cores'
import type { ProducaoStage } from '@/hooks/useObraProducao'

interface ProducaoKanbanColumnProps {
  stage: ProducaoStage
  stages: ProducaoStage[]
  items: string[]
  count: number
  children: React.ReactNode
}

export function ProducaoKanbanColumn({
  stage,
  stages,
  items,
  count,
  children,
}: ProducaoKanbanColumnProps) {
  const kind = classifyProducaoStage(stage, stages)
  const cor = resolveProducaoStageCor(stage.cor, kind)
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const Icon =
    kind === 'pendente' ? Hourglass : kind === 'iniciado' ? Hammer : kind === 'feito' ? CheckCircle2 : Layers

  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.nome}, ${count} ${count === 1 ? 'projeto' : 'projetos'}`}
      className={cn(
        'relative z-10 flex h-auto min-h-[min(72vh,calc(100svh-14rem))] flex-none flex-col snap-start overflow-hidden rounded-2xl border backdrop-blur-[2px]',
        KANBAN_COLUMN_WIDTH_CLASS,
        cor.shell,
        isOver && 'ring-2 ring-[#2d8c78]/35',
      )}
    >
      <div className={cn('h-1 w-full', cor.accent)} aria-hidden />
      <header className="flex shrink-0 items-start gap-2 border-b border-[#2a3a36]/08 px-2.5 py-2.5 sm:px-3">
        <Icon className={cn('mt-0.5 h-4 w-4', cor.icon)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] tracking-[0.22em] text-[#6b7c76]">
            {columnKindLabelProducao(kind)}
          </p>
          <h3 className="line-clamp-2 text-[11px] font-semibold leading-snug text-[#24302c] sm:text-xs">
            {stage.nome}
          </h3>
          <p className="mt-0.5 text-[10px] tabular-nums text-[#2d8c78]">{count}</p>
        </div>
      </header>
      <div className="p-2 sm:p-2.5">
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 sm:gap-2.5">
            {count === 0 ? (
              <p className="px-1 py-8 text-center text-[11px] leading-relaxed text-[#6b7c76]">
                {emptyStateForProducaoKind(kind)}
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
