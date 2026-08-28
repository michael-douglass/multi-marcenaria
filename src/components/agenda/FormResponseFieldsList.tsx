import { cn } from '@/lib/utils';
import type { FormResponseDisplayItem } from '@/lib/agenda-form-field-utils';

interface FormResponseFieldsListProps {
  items: FormResponseDisplayItem[];
  className?: string;
  emptyMessage?: string;
  /** Quando o rótulo já está fora do componente (ex.: lead modal unificado). */
  hideLabels?: boolean;
}

export function FormResponseFieldsList({
  items,
  className,
  emptyMessage = 'Nenhuma resposta do formulário para esta reunião.',
  hideLabels = false,
}: FormResponseFieldsListProps) {
  if (items.length === 0) {
    if (!emptyMessage) return null;
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            'rounded-md border border-border/50 bg-background/60 px-3 py-2.5',
            !hideLabels && 'space-y-1',
          )}
        >
          {!hideLabels && (
            <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
          )}
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{item.formattedValue}</p>
        </div>
      ))}
    </div>
  );
}
