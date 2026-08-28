import type { ReactNode } from 'react';
import { Pencil, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LeadEditableFieldProps {
  fieldId: string;
  label: ReactNode;
  htmlFor?: string;
  /** Lead novo: campos abertos; lead existente: começa fechado */
  isNewLead: boolean;
  canView: boolean;
  canEdit: boolean;
  isEditing: boolean;
  onToggleEdit: (fieldId: string) => void;
  displayValue: ReactNode;
  maskedView?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Conteúdo extra ao lado do valor (ex.: copiar telefone) */
  viewActions?: ReactNode;
  /** Área de leitura maior, com altura fixa, scroll e resize vertical */
  multilineView?: boolean;
  viewHeight?: number;
  viewMinHeight?: number;
  viewMaxHeight?: number;
}

const readShellClass =
  'rounded-lg border border-gold-border-subtle/20 bg-mahogany-muted/25 shadow-inner shadow-black/5';

export function LeadEditableField({
  fieldId,
  label,
  htmlFor,
  isNewLead,
  canView,
  canEdit,
  isEditing,
  onToggleEdit,
  displayValue,
  maskedView,
  children,
  className,
  viewActions,
  multilineView = false,
  viewHeight = 160,
  viewMinHeight = 120,
  viewMaxHeight = 320,
}: LeadEditableFieldProps) {
  const showEditControl = isNewLead || isEditing;
  const showPencil = !isNewLead && canEdit && canView;

  return (
    <div className={cn('group/field space-y-1.5 min-w-0 max-w-full', className)}>
      <div className="flex items-center justify-between gap-2 min-h-7">
        {htmlFor ? (
          <Label
            htmlFor={htmlFor}
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream-muted leading-tight"
          >
            {label}
          </Label>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream-muted leading-none">
            {label}
          </span>
        )}
        {showPencil && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 shrink-0 text-cream-faint transition-colors',
              'opacity-70 group-hover/field:opacity-100 hover:text-gold hover:bg-gold/10',
            )}
            onClick={() => onToggleEdit(fieldId)}
            title={isEditing ? 'Fechar edição' : 'Editar campo'}
            aria-label={isEditing ? 'Fechar edição do campo' : 'Editar campo'}
          >
            {isEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>

      {!canView ? (
        maskedView ?? (
          <div className={cn('min-h-10 flex items-center px-3 overflow-hidden', readShellClass)}>
            <span className="text-sm text-cream-faint">•••</span>
          </div>
        )
      ) : showEditControl ? (
        children
      ) : multilineView ? (
        <div className="flex items-start gap-2 min-w-0 w-full">
          <div
            className={cn(
              'flex-1 min-w-0 px-3 py-2.5 overflow-auto resize-y text-sm text-cream-secondary',
              readShellClass,
            )}
            style={{
              height: viewHeight,
              minHeight: viewMinHeight,
              maxHeight: viewMaxHeight,
            }}
          >
            <div className="w-full min-w-0 whitespace-pre-wrap break-words leading-relaxed">
              {displayValue}
            </div>
          </div>
          {viewActions}
        </div>
      ) : (
        <div className="flex items-start gap-2 min-w-0 w-full">
          <div
            className={cn(
              'min-h-10 flex-1 flex items-center px-3 py-2 min-w-0 transition-colors',
              readShellClass,
              'group-hover/field:border-gold-border-subtle/35',
            )}
          >
            <div className="text-sm w-full min-w-0 break-words [overflow-wrap:anywhere] text-foreground/95">
              {displayValue}
            </div>
          </div>
          {viewActions}
        </div>
      )}
    </div>
  );
}
