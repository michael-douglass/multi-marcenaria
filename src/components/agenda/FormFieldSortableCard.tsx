import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FormFieldSortableCardProps {
  fieldId: string;
  index: number;
  visible: boolean;
  onRemove: () => void;
  children: ReactNode;
}

export function FormFieldSortableCard({
  fieldId,
  index,
  visible,
  onRemove,
  children,
}: FormFieldSortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fieldId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border p-4 space-y-3',
        visible ? 'bg-background' : 'bg-muted/30 opacity-80',
        isDragging && 'z-10 opacity-90 shadow-lg ring-2 ring-amber-500/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <button
            type="button"
            className="touch-none mt-0.5 shrink-0 rounded p-1 text-muted-foreground/60 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
            aria-label={`Arrastar pergunta ${index + 1}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted-foreground">
              Pergunta {index + 1}
            </span>
            <p className="text-[11px] text-muted-foreground/80">Arraste para mudar a ordem</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remover pergunta ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {children}
    </div>
  );
}
