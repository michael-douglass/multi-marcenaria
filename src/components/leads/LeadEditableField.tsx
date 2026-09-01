import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
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
  'rounded-lg border border-[color:var(--lead-line)] bg-[color:var(--lead-inset)] shadow-inner shadow-black/20';

function isEmptyDisplay(value: ReactNode): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '' || value === '—';
  return false;
}

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
  const editorRef = useRef<HTMLDivElement>(null);
  const showEditControl = isNewLead || isEditing;
  const showPencil = !isNewLead && canEdit && canView;
  const emptyValue = isEmptyDisplay(displayValue);

  useEffect(() => {
    if (!isEditing || isNewLead) return;
    const root = editorRef.current;
    if (!root) return;
    const focusable = root.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]',
    );
    focusable?.focus({ preventScroll: true });
  }, [isEditing, isNewLead]);

  const openEdit = () => {
    if (!canEdit || isEditing) return;
    onToggleEdit(fieldId);
  };

  const onReadKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openEdit();
  };

  return (
    <div className={cn('group/field space-y-1.5 min-w-0 max-w-full', className)}>
      <div className="flex items-center justify-between gap-2 min-h-7">
        {htmlFor ? (
          <Label
            htmlFor={htmlFor}
            className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--lead-cream)] leading-tight"
          >
            {label}
          </Label>
        ) : (
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--lead-cream)] leading-none">
            {label}
          </span>
        )}
        {showPencil && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 shrink-0 text-[color:var(--lead-muted)] transition-colors',
              'opacity-90 group-hover/field:opacity-100 hover:text-[color:var(--lead-gold)] hover:bg-[color:var(--lead-gold)]/10',
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
        <div ref={editorRef}>{children}</div>
      ) : (
        <div className="flex items-start gap-2 min-w-0 w-full">
          <div
            role={canEdit ? 'button' : undefined}
            tabIndex={canEdit ? 0 : undefined}
            onClick={openEdit}
            onKeyDown={onReadKeyDown}
            title={canEdit ? 'Clique para editar' : undefined}
            aria-label={canEdit ? 'Clique para editar este campo' : undefined}
            className={cn(
              'flex-1 min-w-0 transition-colors',
              readShellClass,
              canEdit &&
                'cursor-text hover:border-gold/45 hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
              multilineView
                ? 'px-3 py-2.5 overflow-auto resize-y text-sm text-cream-secondary'
                : 'min-h-10 flex items-center px-3 py-2',
            )}
            style={
              multilineView
                ? {
                    height: viewHeight,
                    minHeight: viewMinHeight,
                    maxHeight: viewMaxHeight,
                  }
                : undefined
            }
          >
            <div
              className={cn(
                'w-full min-w-0 break-words',
                multilineView
                  ? 'whitespace-pre-wrap leading-relaxed'
                  : '[overflow-wrap:anywhere] text-sm text-cream-secondary',
                emptyValue && canEdit && 'text-[color:var(--lead-muted)] italic',
              )}
            >
              {emptyValue && canEdit ? 'Clique para preencher' : displayValue}
            </div>
          </div>
          {viewActions}
        </div>
      )}
    </div>
  );
}
