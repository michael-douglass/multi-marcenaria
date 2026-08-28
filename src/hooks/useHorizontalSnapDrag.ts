import { useCallback, useRef, useState, type PointerEvent, type RefObject } from 'react';

const MIN_DRAG_PX = 6;

export type SnapSide = 'left' | 'right';

interface UseHorizontalSnapDragOptions {
  side: SnapSide;
  onSideChange: (side: SnapSide) => void;
  panelRef: RefObject<HTMLElement | null>;
}

export function useHorizontalSnapDrag({ side, onSideChange, panelRef }: UseHorizontalSnapDragOptions) {
  const dragStartRef = useRef<{ startX: number; pointerId: number } | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const endDrag = useCallback(
    (clientX?: number) => {
      const state = dragStartRef.current;
      if (!state) return;

      const moved = clientX !== undefined ? Math.abs(clientX - state.startX) : 0;
      dragStartRef.current = null;
      setIsDragging(false);

      const panel = panelRef.current;
      if (panel && moved >= MIN_DRAG_PX) {
        const rect = panel.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const newSide: SnapSide = centerX < window.innerWidth / 2 ? 'left' : 'right';
        if (newSide !== side) {
          onSideChange(newSide);
        }
      }

      setDragOffsetX(0);
    },
    [onSideChange, panelRef, side],
  );

  const handlePointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    if (e.button !== 0) return;

    dragStartRef.current = { startX: e.clientX, pointerId: e.pointerId };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const state = dragStartRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    setDragOffsetX(e.clientX - state.startX);
  }, []);

  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const state = dragStartRef.current;
      if (!state || state.pointerId !== e.pointerId) return;
      endDrag(e.clientX);
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
    [endDrag],
  );

  const handlePointerCancel = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const state = dragStartRef.current;
      if (!state || state.pointerId !== e.pointerId) return;
      endDrag();
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
    [endDrag],
  );

  return {
    dragOffsetX,
    isDragging,
    dragHandleProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      style: { touchAction: 'none' as const },
    },
  };
}
