import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { KANBAN_COLUMN_SHELL_CLASS } from '@/lib/kanban-column-layout';
import { kanbanStageSkin } from '@/lib/kanban-stage-skin';

interface KanbanColumnProps {
  title: string
  count: number
  status: string
  droppableId?: string
  items: Array<string | number>
  children: React.ReactNode
  /** Cor semântica opcional para colunas customizadas (ex.: 'primary', 'success'...) */
  colorToken?: string | null
  /** Índice da coluna no quadro — garante paleta distinta lado a lado. */
  columnIndex?: number
  /** Singular do contador no cabeçalho (ex.: lead, projeto). */
  countNoun?: string
}

export function KanbanColumn({
  title,
  count,
  status,
  droppableId,
  items,
  children,
  colorToken,
  columnIndex = 0,
  countNoun = 'lead',
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId ?? status,
  });
  const skin = kanbanStageSkin(status, colorToken, columnIndex)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        KANBAN_COLUMN_SHELL_CLASS,
        skin.column,
        isOver && 'scale-[1.01] ring-1 ring-gold/30',
      )}
    >
      <span
        className={cn('pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full', skin.rail)}
        aria-hidden
      />
      <div
        className={cn(
          'shrink-0 px-2.5 py-2.5 sm:px-3 sm:py-3 border-b rounded-t-2xl',
          skin.header,
        )}
      >
        <h3 className="font-semibold text-[11px] sm:text-xs leading-snug line-clamp-2 tracking-tight">
          {title}
        </h3>
        <p className="text-[10px] opacity-75 mt-0.5 tabular-nums">
          {count} {count === 1 ? countNoun : `${countNoun}s`}
        </p>
      </div>
      <div className="flex-1 min-h-0 w-full min-w-0 p-2 sm:p-2.5 overflow-y-auto overflow-x-hidden touch-pan-y">
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 sm:gap-2.5 w-full min-w-0">{children}</div>
        </SortableContext>
      </div>
    </div>
  );
}
