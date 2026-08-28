import { memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { MktConfigColuna } from '@/hooks/useMarketingGastos';

export interface SpreadsheetViewRowProps {
  dateStr: string;
  dayOfMonth: string;
  weekdayShort: string;
  isToday: boolean;
  columns: MktConfigColuna[];
  /** Valores já formatados para células não editáveis (fórmula, auto, etc.) */
  readOnlyByColId: Record<string, string>;
  /** Rascunho local só desta linha (datas editadas ainda não salvas) */
  rowDraft: Record<string, string> | undefined;
  lancamentosByKey: Map<string, number | null>;
  onCellChange: (colunaId: string, dateStr: string, value: string) => void;
}

function SpreadsheetViewRowComponent({
  dateStr,
  dayOfMonth,
  weekdayShort,
  isToday,
  columns,
  readOnlyByColId,
  rowDraft,
  lancamentosByKey,
  onCellChange,
}: SpreadsheetViewRowProps) {
  const handleChange = useCallback(
    (colunaId: string, value: string) => {
      onCellChange(colunaId, dateStr, value);
    },
    [dateStr, onCellChange]
  );

  return (
    <tr
      className={cn(
        'hover:bg-muted/50 transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_2.75rem]',
        isToday && 'bg-primary/5'
      )}
    >
      <td className="border-b border-r px-4 py-2 text-sm font-medium">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs',
              isToday && 'bg-primary text-primary-foreground'
            )}
          >
            {dayOfMonth}
          </span>
          <span className="text-muted-foreground">{weekdayShort}</span>
        </div>
      </td>
      {columns.map((coluna) => {
        const isEditable = coluna.editavel && !coluna.formula && !coluna.is_system_data;
        const mapKey = `${coluna.id}|${dateStr}`;
        const saved = lancamentosByKey.get(mapKey) ?? null;

        return (
          <td
            key={coluna.id}
            className={cn(
              'border-b border-r px-2 py-1',
              !isEditable && 'bg-muted/30'
            )}
          >
            {isEditable ? (
              <Input
                type="text"
                value={
                  rowDraft?.[coluna.id] !== undefined
                    ? rowDraft[coluna.id]
                    : saved !== null
                      ? String(saved)
                      : ''
                }
                onChange={(e) => handleChange(coluna.id, e.target.value)}
                className={cn(
                  'h-8 text-right text-sm',
                  rowDraft?.[coluna.id] !== undefined && 'border-primary'
                )}
                placeholder="-"
              />
            ) : (
              <div className="px-2 py-1 text-right text-sm text-muted-foreground">
                {readOnlyByColId[coluna.id] ?? '-'}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function propsAreEqual(prev: SpreadsheetViewRowProps, next: SpreadsheetViewRowProps): boolean {
  if (
    prev.dateStr !== next.dateStr ||
    prev.dayOfMonth !== next.dayOfMonth ||
    prev.weekdayShort !== next.weekdayShort ||
    prev.isToday !== next.isToday ||
    prev.columns !== next.columns ||
    prev.readOnlyByColId !== next.readOnlyByColId ||
    prev.rowDraft !== next.rowDraft ||
    prev.lancamentosByKey !== next.lancamentosByKey
  ) {
    return false;
  }
  return prev.onCellChange === next.onCellChange;
}

export const SpreadsheetViewRow = memo(SpreadsheetViewRowComponent, propsAreEqual);
