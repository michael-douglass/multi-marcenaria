import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { KANBAN_COLUMN_SHELL_CLASS, KANBAN_COLUMN_WIDTH_CLASS } from '@/lib/kanban-column-layout';

interface KanbanColumnProps {
  title: string;
  count: number;
  status: string;
  droppableId?: string;
  items: Array<string | number>;
  children: React.ReactNode;
  /** Cor semântica opcional para colunas customizadas (ex.: 'primary', 'success'...) */
  colorToken?: string | null;
  /** Singular do contador no cabeçalho (ex.: lead, projeto). */
  countNoun?: string;
}

const statusColors: Record<string, string> = {
  'Novo Lead': 'bg-primary/10 text-primary border-primary/40',
  'Aula Experimental Marcada': 'bg-warning/10 text-warning border-warning/40',
  'Não Entraram para Aula Experimental': 'bg-destructive/10 text-destructive border-destructive/40',
  'Aula Realizada': 'bg-success/10 text-success border-success/40',
  'Venda Realizada (Matriculado)': 'bg-success/10 text-success border-success/40',
  'Venda Perdida (Não Matriculado)': 'bg-muted/10 text-muted-foreground border-muted/40',
  'Clientes Já Cadastrados': 'bg-secondary/10 text-secondary border-secondary/40',
};

const tokenColors: Record<string, string> = {
  primary: 'bg-primary/10 text-primary border-primary/40',
  success: 'bg-success/10 text-success border-success/40',
  warning: 'bg-warning/10 text-warning border-warning/40',
  destructive: 'bg-destructive/10 text-destructive border-destructive/40',
  secondary: 'bg-secondary/10 text-secondary border-secondary/40',
  muted: 'bg-muted/10 text-muted-foreground border-muted/40',
};

export function KanbanColumn({
  title,
  count,
  status,
  droppableId,
  items,
  children,
  colorToken,
  countNoun = 'lead',
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId ?? status,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        KANBAN_COLUMN_SHELL_CLASS,
        isOver && 'border-primary/60 bg-primary/[0.03] shadow-md ring-1 ring-primary/20',
      )}
    >
      <div
        className={cn(
          'shrink-0 px-2.5 py-2.5 sm:px-3 sm:py-3 border-b rounded-t-xl',
          statusColors[status] ??
            (colorToken && tokenColors[colorToken]) ??
            'bg-muted/25 text-foreground border-border/60',
        )}
      >
        <h3 className="font-semibold text-[11px] sm:text-xs leading-snug line-clamp-2 tracking-tight">
          {title}
        </h3>
        <p className="text-[10px] opacity-75 mt-0.5 tabular-nums">
          {count} {count === 1 ? countNoun : `${countNoun}s`}
        </p>
      </div>
      <div className="flex-1 min-h-0 w-full min-w-0 p-2 sm:p-2.5 overflow-y-auto overflow-x-hidden">
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 sm:gap-2.5 w-full min-w-0">{children}</div>
        </SortableContext>
      </div>
    </div>
  );
}
