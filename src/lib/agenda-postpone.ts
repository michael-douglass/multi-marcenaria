import {
  addDays,
  addMinutes,
  getHours,
  getMinutes,
  isSameDay,
  setHours,
  setMinutes,
  startOfDay,
  subDays,
} from 'date-fns';
import type { AgendaEvent } from '@/hooks/useAgendaGeral';

/** Passo fixo das setas de horário e do snap na grade. */
export const TIME_STEP_MINUTES = 15;

export function isAgendaEventPostponable(event: AgendaEvent): boolean {
  return event.status !== 'concluido' && event.status !== 'cancelado';
}

export function isPessoalRecorrente(event: AgendaEvent): boolean {
  if (event.type !== 'pessoal') return false;
  const data = event.originalData as { tipo_agendamento?: string };
  return data.tipo_agendamento === 'recorrente';
}

export function isAgendaPostponeDraftDirty(originalStart: Date, draftStart: Date): boolean {
  return originalStart.getTime() !== draftStart.getTime();
}

export function shiftAgendaDraftByDays(draftStart: Date, days: number): Date {
  return days >= 0 ? addDays(draftStart, days) : subDays(draftStart, Math.abs(days));
}

export function shiftAgendaDraftByMinutes(draftStart: Date, minutes: number): Date {
  return addMinutes(draftStart, minutes);
}

/**
 * Mantém a duração original. Lembrete não tem fim real; o card usa 1 h só para desenhar.
 */
export function buildPostponedAgendaRange(
  originalStart: Date,
  originalEnd: Date,
  draftStart: Date,
): { start: Date; end: Date } {
  const durationMs = Math.max(0, originalEnd.getTime() - originalStart.getTime());
  return {
    start: draftStart,
    end: new Date(draftStart.getTime() + durationMs),
  };
}

/** Modo de horário ao mover várias tarefas para a mesma data. */
export type BulkRescheduleTimeMode =
  | { mode: 'keep-time' }
  | { mode: 'set-time'; time: string };

export interface BulkReschedulePlan {
  event: AgendaEvent;
  start: Date;
  end: Date;
  skipped: boolean;
  skipReason?: string;
}

function parseHhMm(time: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return { hours, minutes };
}

function applyTimeToDate(date: Date, hours: number, minutes: number): Date {
  return setMinutes(setHours(startOfDay(date), hours), minutes);
}

/**
 * Calcula o novo intervalo de um evento para a data destino.
 * Tarefas pessoais recorrentes não mudam de dia (só horário no mesmo dia).
 */
export function planBulkRescheduleEvent(
  event: AgendaEvent,
  targetDate: Date,
  timeMode: BulkRescheduleTimeMode,
): BulkReschedulePlan {
  if (isPessoalRecorrente(event) && !isSameDay(event.start, targetDate)) {
    return {
      event,
      start: event.start,
      end: event.end,
      skipped: true,
      skipReason:
        'Tarefas recorrentes só podem ter o horário alterado no mesmo dia. Edite a tarefa para mudar a data.',
    };
  }

  let hours: number;
  let minutes: number;

  if (timeMode.mode === 'keep-time') {
    hours = getHours(event.start);
    minutes = getMinutes(event.start);
  } else {
    const parsed = parseHhMm(timeMode.time);
    if (!parsed) {
      return {
        event,
        start: event.start,
        end: event.end,
        skipped: true,
        skipReason: 'Horário inválido.',
      };
    }
    hours = parsed.hours;
    minutes = parsed.minutes;
  }

  const draftStart = applyTimeToDate(targetDate, hours, minutes);
  const range = buildPostponedAgendaRange(event.start, event.end, draftStart);
  return {
    event,
    start: range.start,
    end: range.end,
    skipped: false,
  };
}

/** Prévia: quantas serão movidas vs ignoradas (ex.: recorrentes em outro dia). */
export function summarizeBulkReschedulePlans(
  events: AgendaEvent[],
  targetDate: Date,
  timeMode: BulkRescheduleTimeMode,
): { movable: number; skipped: number; plans: BulkReschedulePlan[] } {
  const plans = events.map((event) => planBulkRescheduleEvent(event, targetDate, timeMode));
  const skipped = plans.filter((p) => p.skipped).length;
  return {
    plans,
    skipped,
    movable: plans.length - skipped,
  };
}
