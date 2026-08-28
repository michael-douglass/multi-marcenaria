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
        'w-full rounded-md border border-emerald-500/30 bg-emerald-500/10 pointer-events-auto',
        isInteractive && 'hover:bg-emerald-500/20 transition-colors',
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
              'shrink-0 text-emerald-200/70 hover:text-destructive hover:bg-destructive/10',
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
          <Calculator className="h-3 w-3 shrink-0 text-emerald-400" />
          <span
            className={cn(
              'font-medium text-emerald-100 truncate',
              compact ? 'text-[10px]' : 'text-xs',
            )}
          >
            Markup
          </span>
        </div>
        {showChevron && <ChevronRight className="h-3 w-3 shrink-0 text-emerald-400/70" />}
      </div>
      <div
        className={cn(
          'font-semibold text-emerald-50 mt-0.5',
          compact ? 'text-[11px]' : 'text-sm',
        )}
      >
        {formatarMoedaMarkup(resumo.preco_final)}
      </div>
      {!compact && resumo.titulo && (
        <div className="text-[10px] text-emerald-200/70 truncate mt-0.5">{resumo.titulo}</div>
      )}
    </>
  );
}
