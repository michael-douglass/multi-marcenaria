/**
 * Galaxy Tab S9 Ultra e similares: tela larga (>1024px) mas toque.
 * Não dá para usar só max-width — senão o markup continua “piscando”.
 */
export const TOUCH_UI_MQ = '(hover: none) and (pointer: coarse)';
/** Celular clássico + tablet estreito. */
export const COMPACT_WIDTH_MQ = '(max-width: 1024px)';
/** Qualquer UI de toque ou viewport compacta. */
export const TOUCH_OR_COMPACT_MQ = `${COMPACT_WIDTH_MQ}, ${TOUCH_UI_MQ}`;

export function matchesMediaQuery(query: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(query).matches;
}

export function isTouchUiViewport(): boolean {
  return matchesMediaQuery(TOUCH_UI_MQ);
}

export function isCompactWidthViewport(): boolean {
  return matchesMediaQuery(COMPACT_WIDTH_MQ);
}

/** Tablet/celular: animações e WebGL devem ficar desligados. */
export function isTouchOrCompactViewport(): boolean {
  return matchesMediaQuery(TOUCH_OR_COMPACT_MQ);
}
