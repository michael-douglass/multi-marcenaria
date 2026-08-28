import type { CSSProperties } from 'react';

/** Estilo inline só com delay — opacidade fica no CSS via `[data-reveal]` / `[data-revealed]`. */
export function estiloRevealSlide(delay = 0, previewMode = false): CSSProperties {
  if (previewMode) return { opacity: 1, transform: 'none' };
  return { '--reveal-delay': `${delay}ms` } as CSSProperties;
}

export function marcarElementoRevelado(el: HTMLElement) {
  el.setAttribute('data-revealed', 'true');
}
