/** Teclas que passam a rolar o corpo do card do lead. */
const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const INPUT_TYPES_WITHOUT_CARET = new Set([
  'button',
  'checkbox',
  'radio',
  'submit',
  'reset',
  'file',
  'hidden',
  'color',
  'range',
]);

/**
 * Quanto o card deve descer/subir a cada toque na seta.
 * Usa uma fatia da altura visível para o movimento parecer natural.
 */
export function getLeadModalArrowScrollDelta(
  key: string,
  clientHeight: number,
): number | null {
  if (!ARROW_KEYS.has(key)) return null;

  const step = Math.min(200, Math.max(72, Math.round(clientHeight * 0.18)));

  if (key === 'ArrowUp' || key === 'ArrowLeft') return -step;
  if (key === 'ArrowDown' || key === 'ArrowRight') return step;
  return null;
}

function isTypingTarget(el: HTMLElement): boolean {
  if (el.isContentEditable) return true;

  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;

  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type || 'text';
    return !INPUT_TYPES_WITHOUT_CARET.has(type);
  }

  return false;
}

function hasOpenDropdown(): boolean {
  return Boolean(
    document.querySelector(
      '[role="alertdialog"][data-state="open"], [data-radix-select-content][data-state="open"], [data-radix-menu-content][data-state="open"], [data-radix-dropdown-menu-content][data-state="open"], [data-radix-popover-content][data-state="open"], [cmdk-root]',
    ),
  );
}

/**
 * True quando as setas devem mover a rolagem do card.
 * Só abre mão se a pessoa estiver digitando ou com um menu aberto.
 */
export function shouldLeadModalHandleArrowScroll(
  event: KeyboardEvent,
  scrollEl: HTMLElement | null,
): boolean {
  if (!scrollEl) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (!ARROW_KEYS.has(event.key)) return false;

  const target = event.target;
  if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement) {
    if (isTypingTarget(target)) return false;
    if (target.getAttribute('aria-expanded') === 'true') return false;
  }

  if (hasOpenDropdown()) return false;

  return true;
}
