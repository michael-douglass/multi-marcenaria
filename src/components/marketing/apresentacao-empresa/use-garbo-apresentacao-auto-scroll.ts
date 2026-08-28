import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  GARBO_APRESENTACAO_NAV,
  type GarboApresentacaoNavItem,
} from './garbo-apresentacao-content';

/** Tempo de leitura por seção antes de avançar (ms). */
const AUTO_SCROLL_INTERVAL_MS = 9000;

interface UseGarboApresentacaoAutoScrollOptions {
  containerRef: RefObject<HTMLElement | null>;
  /** Pausa forçada (ex.: formulário aberto). */
  pausedExternally?: boolean;
  enabled?: boolean;
  /** Seções percorridas na rolagem automática. */
  items?: readonly GarboApresentacaoNavItem[];
}

/**
 * Rolagem automática seção a seção — só para uso interno da apresentação.
 * Respeita prefers-reduced-motion e pausa ao interagir com o scroll.
 */
export function useGarboApresentacaoAutoScroll({
  containerRef,
  pausedExternally = false,
  enabled = true,
  items = GARBO_APRESENTACAO_NAV,
}: UseGarboApresentacaoAutoScrollOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const indexRef = useRef(0);
  const userPausedRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPrefersReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const root = containerRef.current;
      if (!root) return;
      const item = itemsRef.current[index];
      if (!item) return;
      const el = root.querySelector<HTMLElement>(`#${item.id}`);
      if (!el) return;
      const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
      root.scrollTo({
        top,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    },
    [containerRef, prefersReducedMotion],
  );

  const syncIndexFromScroll = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    let bestIndex = 0;
    let bestRatio = -1;

    itemsRef.current.forEach((item, i) => {
      const el = root.querySelector<HTMLElement>(`#${item.id}`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, rootRect.top);
      const visibleBottom = Math.min(rect.bottom, rootRect.bottom);
      const visible = Math.max(0, visibleBottom - visibleTop);
      const ratio = visible / Math.max(1, rect.height);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestIndex = i;
      }
    });

    indexRef.current = bestIndex;
  }, [containerRef]);

  const stop = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (prefersReducedMotion) return;
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        userPausedRef.current = false;
        syncIndexFromScroll();
      }
      return next;
    });
  }, [prefersReducedMotion, syncIndexFromScroll]);

  useEffect(() => {
    if (!enabled || !isPlaying || pausedExternally || prefersReducedMotion) return;

    const tick = () => {
      if (userPausedRef.current) return;
      const len = Math.max(1, itemsRef.current.length);
      const next = (indexRef.current + 1) % len;
      indexRef.current = next;
      scrollToIndex(next);
    };

    const id = window.setInterval(tick, AUTO_SCROLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, isPlaying, pausedExternally, prefersReducedMotion, scrollToIndex]);

  useEffect(() => {
    if (!enabled || !isPlaying) return;
    const root = containerRef.current;
    if (!root) return;

    const pauseFromUser = () => {
      userPausedRef.current = true;
      setIsPlaying(false);
    };

    root.addEventListener('wheel', pauseFromUser, { passive: true });
    root.addEventListener('touchstart', pauseFromUser, { passive: true });
    root.addEventListener('pointerdown', pauseFromUser);

    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowUp' ||
        e.key === 'PageDown' ||
        e.key === 'PageUp' ||
        e.key === 'Home' ||
        e.key === 'End' ||
        e.key === ' '
      ) {
        pauseFromUser();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      root.removeEventListener('wheel', pauseFromUser);
      root.removeEventListener('touchstart', pauseFromUser);
      root.removeEventListener('pointerdown', pauseFromUser);
      window.removeEventListener('keydown', onKey);
    };
  }, [containerRef, enabled, isPlaying]);

  useEffect(() => {
    if (prefersReducedMotion && isPlaying) {
      setIsPlaying(false);
    }
  }, [prefersReducedMotion, isPlaying]);

  return {
    isPlaying,
    toggle,
    stop,
    canAutoScroll: enabled && !prefersReducedMotion,
  };
}
