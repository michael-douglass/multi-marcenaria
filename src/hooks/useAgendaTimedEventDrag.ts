import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgendaEvent } from '@/hooks/useAgendaGeral';
import {
  AGENDA_DRAG_THRESHOLD_PX,
  getDragPreviewFromPointer,
} from '@/lib/agenda-calendar-drag';

export interface AgendaEventDragState {
  event: AgendaEvent;
  targetDay: Date;
  hourHeight: number;
  durationMs: number;
  previewTopPx: number;
  previewStart: Date;
  /** Arraste passou do limiar mínimo — card segue o ponteiro. */
  isActive: boolean;
}

interface PendingDrag {
  event: AgendaEvent;
  targetDay: Date;
  hourHeight: number;
  durationMs: number;
  grabOffsetY: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
}

interface UseAgendaTimedEventDragOptions {
  canDrag: boolean;
  onEventDrop?: (event: AgendaEvent, newStart: Date, newEnd: Date) => void;
  onEditEvent?: (event: AgendaEvent) => void;
  getGridElement: (day: Date) => HTMLElement | null;
  resolveTargetDay?: (clientX: number, clientY: number, fallbackDay: Date) => Date;
  /** Alturas por hora (grade expandida no painel). */
  getHourHeights?: (day: Date) => number[] | undefined;
}

export function useAgendaTimedEventDrag({
  canDrag,
  onEventDrop,
  onEditEvent,
  getGridElement,
  resolveTargetDay,
  getHourHeights,
}: UseAgendaTimedEventDragOptions) {
  const [dragState, setDragState] = useState<AgendaEventDragState | null>(null);
  const pendingRef = useRef<PendingDrag | null>(null);
  const dragInteractionRef = useRef(false);

  const resolveDay = useCallback(
    (clientX: number, clientY: number, fallbackDay: Date) =>
      resolveTargetDay?.(clientX, clientY, fallbackDay) ?? fallbackDay,
    [resolveTargetDay],
  );

  const handlePointerDown = useCallback(
    (
      event: AgendaEvent,
      e: React.PointerEvent<HTMLElement>,
      targetDay: Date,
      hourHeight: number,
    ) => {
      if (!canDrag || e.button !== 0) return;

      const rect = e.currentTarget.getBoundingClientRect();
      pendingRef.current = {
        event,
        targetDay,
        hourHeight,
        durationMs: event.end.getTime() - event.start.getTime(),
        grabOffsetY: e.clientY - rect.top,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [canDrag],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const pending = pendingRef.current;
      if (!pending || e.pointerId !== pending.pointerId) return;

      const dx = e.clientX - pending.startClientX;
      const dy = e.clientY - pending.startClientY;
      const passedThreshold = Math.hypot(dx, dy) >= AGENDA_DRAG_THRESHOLD_PX;

      if (!passedThreshold && !dragState) return;

      const targetDay = resolveDay(e.clientX, e.clientY, pending.targetDay);
      const gridElement = getGridElement(targetDay);
      if (!gridElement) return;

      const { previewTopPx, previewStart } = getDragPreviewFromPointer(
        e.clientY,
        gridElement,
        pending.grabOffsetY,
        pending.hourHeight,
        targetDay,
        getHourHeights?.(targetDay),
      );

      setDragState({
        event: pending.event,
        targetDay,
        hourHeight: pending.hourHeight,
        durationMs: pending.durationMs,
        previewTopPx,
        previewStart,
        isActive: true,
      });
    },
    [dragState, getGridElement, getHourHeights, resolveDay],
  );

  const finishDrag = useCallback(
    (clientX: number, clientY: number) => {
      const pending = pendingRef.current;
      if (!pending) return;

      const dx = clientX - pending.startClientX;
      const dy = clientY - pending.startClientY;
      const didDrag = Math.hypot(dx, dy) >= AGENDA_DRAG_THRESHOLD_PX;

      pendingRef.current = null;
      setDragState(null);

      if (didDrag && onEventDrop) {
        dragInteractionRef.current = true;
        const targetDay = resolveDay(clientX, clientY, pending.targetDay);
        const gridElement = getGridElement(targetDay);
        if (gridElement) {
          const { previewStart } = getDragPreviewFromPointer(
            clientY,
            gridElement,
            pending.grabOffsetY,
            pending.hourHeight,
            targetDay,
            getHourHeights?.(targetDay),
          );
          const newEnd = new Date(previewStart.getTime() + pending.durationMs);
          onEventDrop(pending.event, previewStart, newEnd);
        }
        window.setTimeout(() => {
          dragInteractionRef.current = false;
        }, 0);
      }
      // Toque sem arraste: o chip prende o balão. Edição é no título do balão.
    },
    [getGridElement, getHourHeights, onEventDrop, resolveDay],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const pending = pendingRef.current;
      if (!pending || e.pointerId !== pending.pointerId) return;
      finishDrag(e.clientX, e.clientY);
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
    [finishDrag],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const pending = pendingRef.current;
      if (!pending || e.pointerId !== pending.pointerId) return;
      pendingRef.current = null;
      setDragState(null);
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
    [],
  );

  useEffect(() => {
    if (!dragState?.isActive) return;
    document.body.classList.add('select-none', 'cursor-grabbing');
    return () => {
      document.body.classList.remove('select-none', 'cursor-grabbing');
    };
  }, [dragState?.isActive]);

  const handleEditClick = useCallback(
    (event: AgendaEvent) => {
      if (dragInteractionRef.current || dragState?.isActive) return;
      onEditEvent?.(event);
    },
    [dragState?.isActive, onEditEvent],
  );

  const isDraggingEvent = useCallback(
    (eventId: string) => dragState?.isActive && dragState.event.id === eventId,
    [dragState],
  );

  const activeTargetDayKey = dragState?.isActive ? dragState.targetDay.toISOString() : null;

  return {
    dragState,
    activeTargetDayKey,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleEditClick,
    isDraggingEvent,
  };
}
