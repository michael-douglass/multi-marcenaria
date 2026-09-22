import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DateInput } from '@/components/ui/DateInput';
import { TimeInput24h } from '@/components/ui/time-input-24h';
import { getNearestHoraSlot } from '@/lib/horarios-24h';
import {
  summarizeBulkReschedulePlans,
  type BulkRescheduleTimeMode,
} from '@/lib/agenda-postpone';
import type {
  AgendaEvent,
  BulkRescheduleOptions,
} from '@/hooks/useAgendaGeral';

type TimeChoice = 'keep-time' | 'set-time';

interface AgendaBulkMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: AgendaEvent[];
  initialDate?: Date;
  isSubmitting?: boolean;
  floatingLayer?: boolean;
  onConfirm: (targetDate: Date, options: BulkRescheduleOptions) => Promise<void> | void;
}

export function AgendaBulkMoveDialog({
  open,
  onOpenChange,
  events,
  initialDate,
  isSubmitting = false,
  floatingLayer,
  onConfirm,
}: AgendaBulkMoveDialogProps) {
  const [targetDateIso, setTargetDateIso] = useState(
    () => format(initialDate ?? new Date(), 'yyyy-MM-dd'),
  );
  const [timeChoice, setTimeChoice] = useState<TimeChoice>('keep-time');
  const [specificTime, setSpecificTime] = useState(() => getNearestHoraSlot(new Date()));

  useEffect(() => {
    if (!open) return;
    setTargetDateIso(format(initialDate ?? new Date(), 'yyyy-MM-dd'));
    setTimeChoice('keep-time');
    setSpecificTime(getNearestHoraSlot(new Date()));
  }, [open, initialDate]);

  const targetDate = useMemo(() => {
    try {
      return parseISO(targetDateIso);
    } catch {
      return new Date();
    }
  }, [targetDateIso]);

  const timeMode: BulkRescheduleTimeMode =
    timeChoice === 'keep-time'
      ? { mode: 'keep-time' }
      : { mode: 'set-time', time: specificTime };

  const summary = useMemo(
    () => summarizeBulkReschedulePlans(events, targetDate, timeMode),
    [events, targetDate, timeMode],
  );

  const canSubmit =
    !!targetDateIso &&
    events.length > 0 &&
    summary.movable > 0 &&
    (timeChoice === 'keep-time' || !!specificTime) &&
    !isSubmitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    const options: BulkRescheduleOptions =
      timeChoice === 'keep-time'
        ? { keepTime: true }
        : { keepTime: false, time: specificTime };
    await onConfirm(targetDate, options);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        nested={!floatingLayer}
        floatingLayer={floatingLayer}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Mover tarefas selecionadas</DialogTitle>
          <DialogDescription>
            Escolha a nova data e se cada tarefa mantém o horário dela ou se todas vão para o
            mesmo horário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="bulk-move-date">Data de destino</Label>
            <DateInput
              id="bulk-move-date"
              value={targetDateIso}
              onChange={(iso) => {
                if (iso) setTargetDateIso(iso);
              }}
            />
          </div>

          <div className="space-y-3">
            <Label>Horário</Label>
            <RadioGroup
              value={timeChoice}
              onValueChange={(value) => setTimeChoice(value as TimeChoice)}
              className="gap-3"
            >
              <div className="flex items-start gap-2">
                <RadioGroupItem value="keep-time" id="bulk-keep-time" className="mt-0.5" />
                <Label htmlFor="bulk-keep-time" className="font-normal leading-snug cursor-pointer">
                  Manter o horário atual de cada uma
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="set-time" id="bulk-set-time" className="mt-0.5" />
                <Label htmlFor="bulk-set-time" className="font-normal leading-snug cursor-pointer">
                  Definir um horário para todas
                </Label>
              </div>
            </RadioGroup>

            {timeChoice === 'set-time' && (
              <div className="pl-6">
                <TimeInput24h value={specificTime} onChange={setSpecificTime} />
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {summary.movable > 0
              ? `${summary.movable} ${summary.movable === 1 ? 'tarefa será movida' : 'tarefas serão movidas'}`
              : 'Nenhuma tarefa pode ser movida com esses critérios'}
            {summary.skipped > 0 &&
              ` · ${summary.skipped} ${summary.skipped === 1 ? 'será ignorada' : 'serão ignoradas'} (recorrente em outro dia)`}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canSubmit} className="gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Movendo...
              </>
            ) : (
              `Mover ${summary.movable}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
