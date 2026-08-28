import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { OrcamentoSlideBloco } from '@/lib/orcamento-slide-types';
import { BLOCO_LABELS } from '@/lib/orcamento-slide-types';

interface BlocoSortableItemProps {
  bloco: OrcamentoSlideBloco;
  index: number;
  expandido: boolean;
  onToggleExpand: () => void;
  onToggleAtivo: (ativo: boolean) => void;
  onRemove: () => void;
  removendo?: boolean;
  children?: ReactNode;
}

export function BlocoSortableItem({
  bloco,
  index,
  expandido,
  onToggleExpand,
  onToggleAtivo,
  onRemove,
  removendo,
  children,
}: BlocoSortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bloco.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-xl border border-border/60 bg-card overflow-hidden',
        isDragging && 'z-10 opacity-90 shadow-lg ring-2 ring-amber-500/30',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="touch-none shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
          aria-label={`Arrastar bloco ${BLOCO_LABELS[bloco.tipo]}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex-1 text-left min-w-0"
          onClick={onToggleExpand}
        >
          <p className="text-sm font-medium">{BLOCO_LABELS[bloco.tipo]}</p>
          <p className="text-xs text-muted-foreground">
            Ordem: {index + 1} · arraste pelo ícone ou clique para editar
          </p>
        </button>
        <Switch
          checked={bloco.ativo}
          onCheckedChange={onToggleAtivo}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          disabled={removendo}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {expandido && children}
    </div>
  );
}
