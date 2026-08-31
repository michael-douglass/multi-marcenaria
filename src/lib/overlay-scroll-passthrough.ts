import { isOrcamentoVisualizarOpen } from '@/lib/dialog-outside-guard';

const NESTED_SCROLL_GUARD =
  '[data-orcamento-visualizar-nested], [data-radix-select-content], [data-radix-dropdown-menu-content], [data-radix-popover-content], [role="listbox"]';

function apresentacaoScroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-orcamento-apresentacao]');
}

function isNestedScrollTarget(target: EventTarget | null): boolean {
  const el =
    target instanceof HTMLElement
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  return Boolean(el?.closest(NESTED_SCROLL_GUARD));
}

/** Rola a lista de slides na hora — sem animação, senão a roda do mouse “não anda”. */
export function scrollOrcamentoVisualizarBy(deltaY: number, _target?: EventTarget | null) {
  const scroller = apresentacaoScroller();
  if (!scroller || !deltaY) return;
  const previous = scroller.style.scrollBehavior;
  scroller.style.scrollBehavior = 'auto';
  scroller.scrollTop += deltaY;
  scroller.style.scrollBehavior = previous;
}

/**
 * O card do lead (Dialog) trava a roda do mouse no restante da página.
 * A apresentação abre por cima, fora desse card — este listener pega o gesto
 * e move a lista de slides.
 */
export function bindOrcamentoVisualizarScrollPassthrough(): () => void {
  if (typeof window === 'undefined') return () => {};

  let lastTouchY = 0;

  const onWheel = (event: WheelEvent) => {
    if (!isOrcamentoVisualizarOpen()) return;
    if (isNestedScrollTarget(event.target)) return;
    if (!apresentacaoScroller()) return;
    event.preventDefault();
    event.stopPropagation();
    scrollOrcamentoVisualizarBy(event.deltaY);
  };

  const onTouchStart = (event: TouchEvent) => {
    if (!isOrcamentoVisualizarOpen()) return;
    lastTouchY = event.touches[0]?.clientY ?? 0;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (!isOrcamentoVisualizarOpen()) return;
    if (isNestedScrollTarget(event.target)) return;
    if (!apresentacaoScroller()) return;
    const y = event.touches[0]?.clientY ?? lastTouchY;
    const dy = lastTouchY - y;
    lastTouchY = y;
    event.preventDefault();
    event.stopPropagation();
    scrollOrcamentoVisualizarBy(dy);
  };

  const captureBlock: AddEventListenerOptions = { capture: true, passive: false };
  const capturePassive: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener('wheel', onWheel, captureBlock);
  window.addEventListener('touchstart', onTouchStart, capturePassive);
  window.addEventListener('touchmove', onTouchMove, captureBlock);

  return () => {
    window.removeEventListener('wheel', onWheel, captureBlock);
    window.removeEventListener('touchstart', onTouchStart, capturePassive);
    window.removeEventListener('touchmove', onTouchMove, captureBlock);
  };
}
