import { useCallback, useEffect, useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';

interface FloatingHorizontalScrollbarProps {
  targetRef: RefObject<HTMLElement>;
  /** Dependências externas que invalidam o cálculo (ex.: número de colunas, leads) */
  deps?: unknown[];
  className?: string;
}

/**
 * Barra de rolagem horizontal flutuante e sintética (polegar desenhado manualmente).
 * Espelha e controla o scroll horizontal do elemento alvo (`targetRef`) sem depender
 * de scrollbar nativo, garantindo resposta instantânea mesmo com muitas colunas.
 */
export function FloatingHorizontalScrollbar({
  targetRef,
  deps = [],
  className,
}: FloatingHorizontalScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    trackWidth: number;
    maxScroll: number;
    ratio: number;
  } | null>(null);

  const [metrics, setMetrics] = useState({
    visible: false,
    width: 0,
    left: 0,
    thumbWidth: 0,
    thumbLeft: 0,
  });

  const computeMetrics = useCallback(() => {
    const el = targetRef.current;
    const track = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const trackWidth = track?.clientWidth ?? rect.width;
    const overflow = el.scrollWidth - el.clientWidth;
    const visible = overflow > 4;
    if (!visible) {
      setMetrics((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    const ratio = el.clientWidth / el.scrollWidth;
    const thumbWidth = Math.max(40, Math.round(trackWidth * ratio));
    const maxThumbLeft = trackWidth - thumbWidth;
    const thumbLeft = overflow > 0 ? Math.round((el.scrollLeft / overflow) * maxThumbLeft) : 0;
    setMetrics({
      visible: true,
      width: rect.width,
      left: rect.left,
      thumbWidth,
      thumbLeft,
    });
  }, [targetRef]);

  const scheduleCompute = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      computeMetrics();
    });
  }, [computeMetrics]);

  useEffect(() => {
    computeMetrics();
    const target = targetRef.current;
    if (!target) return;

    const onTargetScroll = () => scheduleCompute();
    target.addEventListener('scroll', onTargetScroll, { passive: true });

    const ro = new ResizeObserver(() => scheduleCompute());
    ro.observe(target);

    const onWindow = () => scheduleCompute();
    window.addEventListener('resize', onWindow);
    window.addEventListener('scroll', onWindow, { passive: true });

    return () => {
      target.removeEventListener('scroll', onTargetScroll);
      ro.disconnect();
      window.removeEventListener('resize', onWindow);
      window.removeEventListener('scroll', onWindow);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRef, computeMetrics, scheduleCompute, ...deps]);

  const handleThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = targetRef.current;
    const track = trackRef.current;
    if (!target || !track) return;
    event.preventDefault();
    const trackWidth = track.clientWidth;
    const maxScroll = target.scrollWidth - target.clientWidth;
    const maxThumbLeft = trackWidth - metrics.thumbWidth;
    const ratio = maxThumbLeft > 0 ? maxScroll / maxThumbLeft : 0;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: target.scrollLeft,
      trackWidth,
      maxScroll,
      ratio,
    };
    (event.target as HTMLDivElement).setPointerCapture(event.pointerId);
  };

  const handleThumbPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    const target = targetRef.current;
    if (!drag || !target || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    const next = Math.max(0, Math.min(drag.maxScroll, drag.startScrollLeft + delta * drag.ratio));
    target.scrollLeft = next;
  };

  const handleThumbPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    (event.target as HTMLDivElement).releasePointerCapture(event.pointerId);
    dragStateRef.current = null;
  };

  const handleTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = targetRef.current;
    const track = trackRef.current;
    if (!target || !track) return;
    // Ignora clique no próprio polegar (ele tem seu próprio handler)
    if ((event.target as HTMLElement).dataset.thumb === 'true') return;
    const rect = track.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const maxScroll = target.scrollWidth - target.clientWidth;
    const maxThumbLeft = rect.width - metrics.thumbWidth;
    if (maxThumbLeft <= 0) return;
    const targetThumbLeft = Math.max(0, Math.min(maxThumbLeft, clickX - metrics.thumbWidth / 2));
    target.scrollLeft = (targetThumbLeft / maxThumbLeft) * maxScroll;
  };

  if (!metrics.visible) return null;

  return (
    <div
      className={cn('fixed bottom-3 z-50 pointer-events-none', className)}
      style={{ left: metrics.left, width: metrics.width }}
      aria-hidden
    >
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        className="pointer-events-auto relative mx-auto h-3 w-full rounded-full bg-background/80 shadow-md ring-1 ring-border backdrop-blur cursor-pointer"
      >
        <div
          data-thumb="true"
          onPointerDown={handleThumbPointerDown}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={handleThumbPointerUp}
          onPointerCancel={handleThumbPointerUp}
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-muted-foreground/60 hover:bg-muted-foreground/80 active:bg-muted-foreground transition-colors cursor-grab active:cursor-grabbing touch-none"
          style={{ width: metrics.thumbWidth, left: metrics.thumbLeft }}
        />
      </div>
    </div>
  );
}
