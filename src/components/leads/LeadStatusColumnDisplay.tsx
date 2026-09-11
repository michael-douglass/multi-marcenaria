import { Columns3, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeadStatusDisplayInfo } from '@/lib/pipeline-status-options';

interface LeadStatusColumnDisplayProps {
  info: LeadStatusDisplayInfo;
  className?: string;
  /** Compacto no select trigger; completo na leitura do card. */
  compact?: boolean;
}

/**
 * Mostra a coluna do lead com a página/funil em evidência —
 * evita confundir só o texto da coluna (ex.: “Fechamentos…”) sem contexto.
 */
export function LeadStatusColumnDisplay({
  info,
  className,
  compact = false,
}: LeadStatusColumnDisplayProps) {
  const hasPage = Boolean(info.pageLabel);

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-start gap-2.5',
        compact ? 'gap-2' : 'gap-2.5',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex shrink-0 items-center justify-center rounded-md border',
          'border-gold-border-subtle/35 bg-gradient-to-br from-gold/20 via-mahogany-elevated/40 to-mahogany-muted/30',
          'text-gold shadow-inner shadow-black/10',
          compact ? 'h-7 w-7' : 'h-8 w-8',
        )}
      >
        {hasPage ? (
          <LayoutGrid className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        ) : (
          <Columns3 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        )}
      </span>

      <div className="min-w-0 flex-1 space-y-0.5">
        {hasPage && (
          <p
            className={cn(
              'truncate font-semibold uppercase tracking-[0.12em] text-gold/85',
              compact ? 'text-[9px] leading-tight' : 'text-[10px] leading-tight',
            )}
            title={info.pageLabel ?? undefined}
          >
            {info.pageLabel}
          </p>
        )}
        <p
          className={cn(
            'min-w-0 break-words font-medium leading-snug text-cream-secondary [overflow-wrap:anywhere]',
            compact ? 'text-sm' : 'text-[15px]',
          )}
          title={info.columnLabel}
        >
          {info.columnLabel}
        </p>
      </div>
    </div>
  );
}

interface LeadStatusColumnOptionRowProps {
  columnLabel: string;
  /** Índice 1-based na página (ordem do sistema). */
  step?: number;
  className?: string;
}

/** Linha de opção no dropdown: número da ordem + nome da coluna. */
export function LeadStatusColumnOptionRow({
  columnLabel,
  step,
  className,
}: LeadStatusColumnOptionRowProps) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2 text-[#fff6ea]', className)}>
      {typeof step === 'number' && step > 0 && (
        <span
          aria-hidden
          className={cn(
            'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1',
            'border border-[#f2d892]/35 bg-mahogany-muted/50',
            'font-mono text-[10px] font-semibold tabular-nums text-[#f2d892]',
          )}
        >
          {step}
        </span>
      )}
      <span className="min-w-0 truncate font-medium text-[#fff6ea]">{columnLabel}</span>
    </span>
  );
}
