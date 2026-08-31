import { isOrcamentoVisualizarOpen } from '@/lib/dialog-outside-guard';

function nearestVerticalScroller(target: EventTarget | null, fallback: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null =
    target instanceof HTMLElement
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  while (node && node !== document.documentElement) {
    const overflowY = window.getComputedStyle(node).overflowY;
    const canScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    if (canScroll && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }

  return fallback;
}

export function scrollOrcamentoVisualizarBy(deltaY: number, target?: EventTarget | null) {
  const fallback = document.querySelector<HTMLElement>('[data-orcamento-apresentacao]');
  const scroller = nearestVerticalScroller(target ?? null, fallback);
  if (!scroller) return;
  scroller.scrollTop += deltaY;
}

/**
 * O card do lead (Dialog modal) bloqueia a roda do mouse no documento.
 * A visualização dos slides vive fora desse card, então o gesto nunca chega
 * até a lista. Este listener no `window`/`document` (fase de captura) pega o
 * gesto antes e aplica a rolagem na apresentação.
 */
export function bindOrcamentoVisualizarScrollPassthrough(): () => void {
  if (typeof window === 'undefined') return () => {};

  let lastTouchY = 0;

  const onWheel = (event: WheelEvent) => {
    if (!isOrcamentoVisualizarOpen()) return;
    event.stopPropagation();
    event.preventDefault();
    scrollOrcamentoVisualizarBy(event.deltaY, event.target);
  };

  const onTouchStart = (event: TouchEvent) => {
    if (!isOrcamentoVisualizarOpen()) return;
    lastTouchY = event.touches[0]?.clientY ?? 0;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (!isOrcamentoVisualizarOpen()) return;
    const y = event.touches[0]?.clientY ?? lastTouchY;
    const dy = lastTouchY - y;
    lastTouchY = y;
    event.stopPropagation();
    event.preventDefault();
    scrollOrcamentoVisualizarBy(dy, event.target);
  };

  const captureBlock: AddEventListenerOptions = { capture: true, passive: false };
  const capturePassive: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener('wheel', onWheel, captureBlock);
  document.addEventListener('wheel', onWheel, captureBlock);
  window.addEventListener('touchstart', onTouchStart, capturePassive);
  window.addEventListener('touchmove', onTouchMove, captureBlock);
  document.addEventListener('touchmove', onTouchMove, captureBlock);

  return () => {
    window.removeEventListener('wheel', onWheel, captureBlock);
    document.removeEventListener('wheel', onWheel, captureBlock);
    window.removeEventListener('touchstart', onTouchStart, capturePassive);
    window.removeEventListener('touchmove', onTouchMove, captureBlock);
    document.removeEventListener('touchmove', onTouchMove, captureBlock);
  };
}
