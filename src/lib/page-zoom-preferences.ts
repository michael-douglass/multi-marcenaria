/** Zoom da tela do Kanban (Pipeline e páginas criadas), em percentual. */
export const PAGE_ZOOM_DEFAULT = 100;
export const PAGE_ZOOM_MIN = 80;
export const PAGE_ZOOM_MAX = 140;
export const PAGE_ZOOM_STEP = 10;

export function clampPageZoom(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return PAGE_ZOOM_DEFAULT;
  const stepped = Math.round(n / PAGE_ZOOM_STEP) * PAGE_ZOOM_STEP;
  return Math.min(PAGE_ZOOM_MAX, Math.max(PAGE_ZOOM_MIN, stepped));
}

export function pageZoomToScale(percent: number): number {
  return clampPageZoom(percent) / 100;
}
