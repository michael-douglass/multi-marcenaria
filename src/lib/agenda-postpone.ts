import { addDays, addMinutes, subDays } from 'date-fns';
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
