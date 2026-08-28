import { useEffect } from 'react';

/**
 * Impede o scroll do modal/página enquanto o dedo está na lousa.
 * Usa listeners nativos (passive: false) — necessário no celular.
 * @param viewportEl — elemento DOM atual (callback ref); muda ao abrir tela cheia.
 */
export function useWhiteboardTouchLock(viewportEl: HTMLDivElement | null) {
  useEffect(() => {
    const el = viewportEl;
    if (!el) return;

    let touchOnBoard = false;

    const onTouchStart = () => {
      touchOnBoard = true;
    };

    const onTouchEnd = () => {
      touchOnBoard = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchOnBoard && e.touches.length < 2) return;
      if (e.cancelable) e.preventDefault();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [viewportEl]);
}
