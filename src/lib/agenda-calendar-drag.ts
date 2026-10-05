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
export function getMinutesFromGridOffset(
  offsetY: number,
  hourHeight: number,
  hourHeights?: number[],
): number {
  if (!hourHeights || hourHeights.length < 24) {
    const rawMinutes = (offsetY / hourHeight) * 60;
    return clampGridMinutes(snapToInterval(rawMinutes));
  }
  let y = 0;
  for (let hour = 0; hour < 24; hour += 1) {
    const band = hourHeights[hour] ?? hourHeight;
    if (offsetY <= y + band || hour === 23) {
      const frac = band > 0 ? Math.max(0, Math.min(1, (offsetY - y) / band)) : 0;
      return clampGridMinutes(snapToInterval(hour * 60 + frac * 60));
    }
    y += band;
  }
  return clampGridMinutes(24 * 60 - SNAP_MINUTES);
}

/** Posição Y em pixels a partir dos minutos desde meia-noite. */
export function getTopPxFromMinutes(
  minutes: number,
  hourHeight: number,
  hourHeights?: number[],
): number {
  if (!hourHeights || hourHeights.length < 24) {
    return (minutes / 60) * hourHeight;
  }
  const hour = Math.min(23, Math.max(0, Math.floor(minutes / 60)));
  const mins = minutes - hour * 60;
  let top = 0;
  for (let i = 0; i < hour; i += 1) {
    top += hourHeights[i] ?? hourHeight;
  }
  top += (mins / 60) * (hourHeights[hour] ?? hourHeight);
  return top;
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
  hourHeights?: number[],
): Date {
  const minutes = getMinutesFromGridOffset(offsetY, hourHeight, hourHeights);
  return getDateTimeFromMinutesOnDay(minutes, targetDay);
}

/** Calcula preview de reagendamento a partir do ponteiro na grade. */
export function getDragPreviewFromPointer(
  clientY: number,
  gridElement: HTMLElement,
  grabOffsetY: number,
  hourHeight: number,
  targetDay: Date,
  hourHeights?: number[],
) {
  const gridRect = gridElement.getBoundingClientRect();
  const offsetY = clientY - gridRect.top - grabOffsetY;
  const minutes = getMinutesFromGridOffset(offsetY, hourHeight, hourHeights);
  return {
    previewTopPx: getTopPxFromMinutes(minutes, hourHeight, hourHeights),
    previewStart: getDateTimeFromMinutesOnDay(minutes, targetDay),
    minutes,
  };
}
