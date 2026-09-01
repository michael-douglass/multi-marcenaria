import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  TIME_STEP_MINUTES,
  buildPostponedAgendaRange,
  isAgendaPostponeDraftDirty,
  isPessoalRecorrente,
  shiftAgendaDraftByDays,
  shiftAgendaDraftByMinutes,
} from '@/lib/agenda-postpone';
import type { AgendaEvent } from '@/hooks/useAgendaGeral';

interface AgendaEventPostponeControlsProps {
  event: AgendaEvent;
  draftStart: Date;
  onDraftStartChange: (next: Date) => void;
  compact?: boolean;
  isSaving?: boolean;
  onConfirm: (newStart: Date, newEnd: Date) => void;
}

interface StepperRowProps {
  label: string;
  ariaLabel: string;
  prevAriaLabel: string;
  nextAriaLabel: string;
  compact?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onPrev: () => void;
  onNext: () => void;
}

function StepperRow({
  label,
  ariaLabel,
  prevAriaLabel,
  nextAriaLabel,
  compact = false,
  disabled = false,
  disabledReason,
  onPrev,
  onNext,
}: StepperRowProps) {
  const btnClass = compact ? 'h-6 w-6' : 'h-7 w-7';
  const iconClass = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';

  const buttons = (
    <div className="flex items-center gap-1" data-agenda-postpone="">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={btnClass}
        disabled={disabled}
        aria-label={prevAriaLabel}
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
      >
        <ChevronLeft className={iconClass} />
      </Button>
      <span
        className={cn(
          'min-w-0 flex-1 text-center font-medium tabular-nums',
          compact ? 'text-[10px]' : 'text-xs',
        )}
        aria-label={ariaLabel}
      >
        {label}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={btnClass}
        disabled={disabled}
        aria-label={nextAriaLabel}
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
      >
        <ChevronRight className={iconClass} />
      </Button>
    </div>
  );

  if (!disabled || !disabledReason) return buttons;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-full">{buttons}</div>
      </TooltipTrigger>
      <TooltipContent className="z-[210] max-w-[14rem] text-[10px]">{disabledReason}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Rascunho local de novo dia/hora. Só grava no botão Adiar.
 */
export function AgendaEventPostponeControls({
  event,
  draftStart,
  onDraftStartChange,
  compact = false,
  isSaving = false,
  onConfirm,
}: AgendaEventPostponeControlsProps) {
  const recurring = isPessoalRecorrente(event);
  const dirty = isAgendaPostponeDraftDirty(event.start, draftStart);
  const dayChanged = !isSameDay(event.start, draftStart);

  const dayLabel = compact
    ? format(draftStart, 'dd/MM')
    : format(draftStart, 'EEE dd/MM', { locale: ptBR });

  const timeLabel = format(draftStart, 'HH:mm');
  const dayAria = `Dia ${format(draftStart, 'dd/MM/yyyy')}`;
  const timeAria = `Horário ${timeLabel}`;

  const handleConfirm = () => {
    if (!dirty || isSaving) return;
    const { start, end } = buildPostponedAgendaRange(event.start, event.end, draftStart);
    onConfirm(start, end);
  };

  return (
    <div
      className={cn('space-y-1.5', compact ? 'pt-0.5' : 'pt-1')}
      data-agenda-postpone=""
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className={cn('font-medium text-foreground/80', compact ? 'text-[10px]' : 'text-xs')}>
        Adiar tarefa
      </p>

      <StepperRow
        label={dayLabel}
        ariaLabel={dayAria}
        prevAriaLabel={`Dia anterior · ${dayAria}`}
        nextAriaLabel={`Próximo dia · ${dayAria}`}
        compact={compact}
        disabled={recurring}
        disabledReason={
          recurring
            ? 'Tarefas recorrentes só podem mudar o horário no mesmo dia'
            : undefined
        }
        onPrev={() => onDraftStartChange(shiftAgendaDraftByDays(draftStart, -1))}
        onNext={() => onDraftStartChange(shiftAgendaDraftByDays(draftStart, 1))}
      />

      {dayChanged && !recurring && (
        <p className={cn('text-muted-foreground/80 capitalize', compact ? 'text-[9px]' : 'text-[10px]')}>
          {format(draftStart, "EEEE, dd/MM", { locale: ptBR })}
        </p>
      )}

      <StepperRow
        label={timeLabel}
        ariaLabel={timeAria}
        prevAriaLabel={`15 minutos antes · ${timeAria}`}
        nextAriaLabel={`15 minutos depois · ${timeAria}`}
        compact={compact}
        onPrev={() => onDraftStartChange(shiftAgendaDraftByMinutes(draftStart, -TIME_STEP_MINUTES))}
        onNext={() => onDraftStartChange(shiftAgendaDraftByMinutes(draftStart, TIME_STEP_MINUTES))}
      />

      <Button
        type="button"
        size="sm"
        disabled={!dirty || isSaving}
        className={cn('w-full gap-1', compact ? 'h-6 text-[10px]' : 'h-7 text-xs')}
        onClick={(e) => {
          e.stopPropagation();
          handleConfirm();
        }}
      >
        {isSaving ? (
          <>
            <Loader2 className={cn('animate-spin', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            Adiando…
          </>
        ) : (
          'Adiar'
        )}
      </Button>
    </div>
  );
}
