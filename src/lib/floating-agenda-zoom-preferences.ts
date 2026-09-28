/**
 * Zoom do painel flutuante da Agenda Geral.
 * Independente do zoom do Kanban — aqui o painel pode ir até 200%.
 */
export const FLOATING_AGENDA_ZOOM_DEFAULT = 100;
export const FLOATING_AGENDA_ZOOM_MIN = 80;
export const FLOATING_AGENDA_ZOOM_MAX = 200;
export const FLOATING_AGENDA_ZOOM_STEP = 10;

export function clampFloatingAgendaZoom(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return FLOATING_AGENDA_ZOOM_DEFAULT;
  const stepped = Math.round(n / FLOATING_AGENDA_ZOOM_STEP) * FLOATING_AGENDA_ZOOM_STEP;
  return Math.min(FLOATING_AGENDA_ZOOM_MAX, Math.max(FLOATING_AGENDA_ZOOM_MIN, stepped));
}

export function floatingAgendaZoomToScale(percent: number): number {
  return clampFloatingAgendaZoom(percent) / 100;
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
