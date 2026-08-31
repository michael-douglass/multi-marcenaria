import { Calculator, ChevronRight, Trash2 } from 'lucide-react';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import type { MarkupLeadResumo } from '@/lib/markup-types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MarkupCardPreviewProps {
  resumo?: MarkupLeadResumo | null;
  compact?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  /** Exclui este markup (ícone de lixeira). */
  onDelete?: (e: React.MouseEvent) => void;
  /** Só exibe valores — sem abrir calculadora nem exclusão. */
  readOnly?: boolean;
  className?: string;
}

export function MarkupCardPreview({
  resumo,
  compact = false,
  onClick,
  onDelete,
  readOnly = false,
  className,
}: MarkupCardPreviewProps) {
  if (!resumo || resumo.preco_final <= 0) return null;

  const isInteractive = !readOnly && !!onClick;

  return (
    <div
      className={cn(
        'lead-markup-chip w-full rounded-md border pointer-events-auto',
        isInteractive && 'transition-colors',
        compact ? 'px-2 py-1.5' : 'px-3 py-2',
        className,
      )}
    >
      <div className="flex items-start gap-1">
        {isInteractive ? (
          <button
            type="button"
            onClick={onClick}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 text-left"
          >
            <MarkupPreviewBody resumo={resumo} compact={compact} showChevron />
          </button>
        ) : (
          <div className="min-w-0 flex-1">
            <MarkupPreviewBody resumo={resumo} compact={compact} showChevron={false} />
          </div>
        )}
        {!readOnly && onDelete && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              'lead-markup-chip__icon shrink-0 hover:text-destructive hover:bg-destructive/15',
              compact ? 'h-6 w-6' : 'h-7 w-7',
            )}
            aria-label="Excluir markup"
            title="Excluir markup"
            onClick={onDelete}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Trash2 className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </Button>
        )}
      </div>
    </div>
  );
}

function MarkupPreviewBody({
  resumo,
  compact,
  showChevron,
}: {
  resumo: MarkupLeadResumo;
  compact: boolean;
  showChevron: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Calculator className="lead-markup-chip__icon h-3 w-3 shrink-0" />
          <span
            className={cn(
              'lead-markup-chip__label font-semibold tracking-wide truncate',
              compact ? 'text-[10px]' : 'text-xs',
            )}
          >
            Markup
          </span>
        </div>
        {showChevron && <ChevronRight className="lead-markup-chip__icon h-3 w-3 shrink-0 opacity-80" />}
      </div>
      <div
        className={cn(
          'lead-markup-chip__value font-semibold mt-0.5',
          compact ? 'text-[11px]' : 'text-sm',
        )}
      >
        {formatarMoedaMarkup(resumo.preco_final)}
      </div>
      {!compact && resumo.titulo && (
        <div className="lead-markup-chip__hint truncate mt-0.5 text-[10px]">{resumo.titulo}</div>
      )}
    </>
  );
}
