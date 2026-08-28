import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface ViewportState {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 6;

function clampScale(s: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

interface UseWhiteboardViewportOptions {
  viewportRef: RefObject<HTMLDivElement | null>;
  /** Elemento montado no DOM (atualiza ao trocar inline ↔ tela cheia). */
  viewportEl: HTMLDivElement | null;
  contentWidth: number;
  contentHeight: number;
  /** Limita o zoom ao ajustar a foto (ex.: 1 no celular evita ampliar ao abrir). */
  maxFitScale?: number;
}

export function useWhiteboardViewport({
  viewportRef,
  viewportEl,
  contentWidth,
  contentHeight,
  maxFitScale,
}: UseWhiteboardViewportOptions) {
  const [view, setView] = useState<ViewportState>({ scale: 1, x: 0, y: 0 });
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const pinchRef = useRef<{
    dist: number;
    scale: number;
    midX: number;
    midY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - view.x) / view.scale,
        y: (clientY - rect.top - view.y) / view.scale,
      };
    },
    [view.scale, view.x, view.y, viewportRef],
  );

  const fitContent = useCallback(
    (padding = 32) => {
      const el = viewportRef.current;
      if (!el) return;
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (vw <= 0 || vh <= 0) return;

      let scale = clampScale(
        Math.min((vw - padding * 2) / contentWidth, (vh - padding * 2) / contentHeight),
      );
      if (maxFitScale !== undefined) {
        scale = Math.min(scale, maxFitScale);
      }
      setView({
        scale,
        x: (vw - contentWidth * scale) / 2,
        y: (vh - contentHeight * scale) / 2,
      });
    },
    [contentWidth, contentHeight, viewportRef, maxFitScale],
  );

  const zoomBy = useCallback(
    (factor: number, centerClientX?: number, centerClientY?: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = centerClientX ?? rect.left + rect.width / 2;
      const cy = centerClientY ?? rect.top + rect.height / 2;

      setView((prev) => {
        const nextScale = clampScale(prev.scale * factor);
        const wx = (cx - rect.left - prev.x) / prev.scale;
        const wy = (cy - rect.top - prev.y) / prev.scale;
        return {
          scale: nextScale,
          x: cx - rect.left - wx * nextScale,
          y: cy - rect.top - wy * nextScale,
        };
      });
    },
    [viewportRef],
  );

  const startPan = useCallback((clientX: number, clientY: number) => {
    setView((prev) => {
      panRef.current = {
        startX: clientX,
        startY: clientY,
        origX: prev.x,
        origY: prev.y,
      };
      return prev;
    });
  }, []);

  const movePan = useCallback((clientX: number, clientY: number) => {
    const pan = panRef.current;
    if (!pan) return;
    setView((prev) => ({
      ...prev,
      x: pan.origX + (clientX - pan.startX),
      y: pan.origY + (clientY - pan.startY),
    }));
  }, []);

  const endPan = useCallback(() => {
    panRef.current = null;
    pinchRef.current = null;
  }, []);

  const handlePinch = useCallback(
    (
      touches: ArrayLike<{ clientX: number; clientY: number }>,
      rect: DOMRect,
    ) => {
      if (touches.length < 2) {
        pinchRef.current = null;
        return false;
      }
      const t0 = touches[0];
      const t1 = touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      if (dist < 8) return Boolean(pinchRef.current);
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;

      if (!pinchRef.current) {
        setView((prev) => {
          pinchRef.current = {
            dist,
            scale: prev.scale,
            midX,
            midY,
            origX: prev.x,
            origY: prev.y,
          };
          return prev;
        });
        return true;
      }

      const pinch = pinchRef.current;
      const nextScale = clampScale(pinch.scale * (dist / pinch.dist));
      // Âncora no ponto médio inicial do gesto (zoom estável sob os dedos).
      const wx = (pinch.midX - rect.left - pinch.origX) / pinch.scale;
      const wy = (pinch.midY - rect.top - pinch.origY) / pinch.scale;
      // Deslocamento do meio dos dedos = pan durante a pinça.
      const dx = midX - pinch.midX;
      const dy = midY - pinch.midY;

      setView({
        scale: nextScale,
        x: pinch.midX - rect.left - wx * nextScale + dx,
        y: pinch.midY - rect.top - wy * nextScale + dy,
      });
      return true;
    },
    [],
  );

  useEffect(() => {
    const el = viewportEl ?? viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomBy(factor, e.clientX, e.clientY);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewportEl, viewportRef, zoomBy]);

  return {
    view,
    setView,
    screenToWorld,
    fitContent,
    zoomBy,
    zoomIn: () => zoomBy(1.2),
    zoomOut: () => zoomBy(1 / 1.2),
    startPan,
    movePan,
    endPan,
    handlePinch,
    panRef,
    pinchRef,
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
  };
}
