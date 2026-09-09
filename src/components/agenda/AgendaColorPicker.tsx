import { Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  AGENDA_COLOR_PRESETS,
  AGENDA_TYPE_DEFAULT_HEX,
  agendaColorContrastText,
  normalizeAgendaColor,
} from '@/lib/agenda-event-colors';
import type { AgendaEvent } from '@/hooks/useAgendaGeral';

interface AgendaColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
  /** Sugere a cor padrão do tipo (reunião / lead / pessoal). */
  eventType?: AgendaEvent['type'];
  className?: string;
  label?: string;
  hint?: string;
}

/**
 * Seletor visual de cor para itens da agenda.
 * “Padrão” = usa a cor do tipo; qualquer swatch grava hex no item.
 */
export function AgendaColorPicker({
  value,
  onChange,
  eventType = 'tarefa',
  className,
  label = 'Cor na agenda',
  hint = 'Escolha uma cor para achar este item mais fácil no calendário.',
}: AgendaColorPickerProps) {
  const selected = normalizeAgendaColor(value);
  const typeDefault = AGENDA_TYPE_DEFAULT_HEX[eventType];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground leading-snug">{hint}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Cor padrão do tipo"
          aria-pressed={selected === null}
          className={cn(
            'relative h-8 min-w-[4.5rem] rounded-md border px-2 text-[11px] font-semibold tracking-wide transition',
            'border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted',
            selected === null &&
              'ring-2 ring-[#f2d892] ring-offset-2 ring-offset-background text-foreground',
          )}
        >
          Padrão
        </button>

        {AGENDA_COLOR_PRESETS.map((hex) => {
          const isActive = selected === hex.toLowerCase();
          const checkColor = agendaColorContrastText(hex);
          return (
            <button
              key={hex}
              type="button"
              onClick={() => onChange(hex)}
              title={hex}
              aria-label={`Cor ${hex}`}
              aria-pressed={isActive}
              className={cn(
                'relative h-8 w-8 shrink-0 rounded-md border border-black/10 shadow-sm transition',
                'hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d892] focus-visible:ring-offset-2',
                isActive && 'ring-2 ring-[#f2d892] ring-offset-2 ring-offset-background scale-105',
              )}
              style={{ backgroundColor: hex }}
            >
              {isActive ? (
                <Check className="absolute inset-0 m-auto h-3.5 w-3.5" style={{ color: checkColor }} />
              ) : null}
            </button>
          );
        })}

        <label
          className={cn(
            'relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-border',
            'bg-[conic-gradient(from_180deg,#f2d892,#fb923c,#ef4444,#a855f7,#3b82f6,#10b981,#f2d892)]',
            'hover:scale-105 focus-within:ring-2 focus-within:ring-[#f2d892] focus-within:ring-offset-2',
          )}
          title="Cor personalizada"
        >
          <span className="sr-only">Cor personalizada</span>
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={selected ?? typeDefault}
            onChange={(e) => onChange(normalizeAgendaColor(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
