import {
  PAGE_ZOOM_DEFAULT,
  PAGE_ZOOM_MAX,
  PAGE_ZOOM_MIN,
  PAGE_ZOOM_STEP,
  clampPageZoom,
  pageZoomToScale,
} from '@/lib/page-zoom-preferences';

/** Mesmos limites do zoom do Kanban — comportamento familiar para o usuário. */
export const FLOATING_AGENDA_ZOOM_DEFAULT = PAGE_ZOOM_DEFAULT;
export const FLOATING_AGENDA_ZOOM_MIN = PAGE_ZOOM_MIN;
export const FLOATING_AGENDA_ZOOM_MAX = PAGE_ZOOM_MAX;
export const FLOATING_AGENDA_ZOOM_STEP = PAGE_ZOOM_STEP;

export const clampFloatingAgendaZoom = clampPageZoom;

export function floatingAgendaZoomToScale(percent: number): number {
  return pageZoomToScale(percent);
}

export const FLOATING_AGENDA_BASE_WIDTH_PX = 320;
export const FLOATING_AGENDA_BASE_WIDTH_SM_PX = 340;

/** Largura do painel conforme zoom salvo (base 320/340px). */
export function floatingAgendaPanelWidthPx(zoomPercent: number, viewportWidth: number): number {
  const base =
    viewportWidth >= 640 ? FLOATING_AGENDA_BASE_WIDTH_SM_PX : FLOATING_AGENDA_BASE_WIDTH_PX;
  const maxWidth =
    viewportWidth >= 640 ? viewportWidth * 0.92 : Math.max(viewportWidth - 16, base);
  const scaled = Math.round(base * floatingAgendaZoomToScale(zoomPercent));
  return Math.min(scaled, maxWidth);
}
