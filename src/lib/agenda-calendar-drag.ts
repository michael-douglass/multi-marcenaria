import { setHours, setMinutes, startOfDay } from 'date-fns';

export const AGENDA_DRAG_EVENT_KEY = 'application/x-agenda-event-id';
export const SNAP_MINUTES = 15;
export const AGENDA_DRAG_THRESHOLD_PX = 5;

export function snapToInterval(minutes: number, interval = SNAP_MINUTES): number {
  return Math.round(minutes / interval) * interval;
}

export function clampGridMinutes(minutes: number): number {
  return Math.max(0, Math.min(24 * 60 - SNAP_MINUTES, minutes));
}

/** Minutos desde meia-noite a partir da posição Y na grade (com snap de 15 min). */
export function getMinutesFromGridOffset(offsetY: number, hourHeight: number): number {
  const rawMinutes = (offsetY / hourHeight) * 60;
  return clampGridMinutes(snapToInterval(rawMinutes));
}

/** Posição Y em pixels a partir dos minutos desde meia-noite. */
export function getTopPxFromMinutes(minutes: number, hourHeight: number): number {
  return (minutes / 60) * hourHeight;
}

export function getDateTimeFromMinutesOnDay(minutes: number, targetDay: Date): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return setMinutes(setHours(startOfDay(targetDay), hours), mins);
}

/** Converte posição Y na grade do calendário em data/hora no dia alvo. */
export function getDateTimeFromGridDrop(
  offsetY: number,
  hourHeight: number,
  targetDay: Date,
): Date {
  const minutes = getMinutesFromGridOffset(offsetY, hourHeight);
  return getDateTimeFromMinutesOnDay(minutes, targetDay);
}

/** Calcula preview de reagendamento a partir do ponteiro na grade. */
export function getDragPreviewFromPointer(
  clientY: number,
  gridElement: HTMLElement,
  grabOffsetY: number,
  hourHeight: number,
  targetDay: Date,
) {
  const gridRect = gridElement.getBoundingClientRect();
  const offsetY = clientY - gridRect.top - grabOffsetY;
  const minutes = getMinutesFromGridOffset(offsetY, hourHeight);
  return {
    previewTopPx: getTopPxFromMinutes(minutes, hourHeight),
    previewStart: getDateTimeFromMinutesOnDay(minutes, targetDay),
    minutes,
  };
}
