export type PageZoomKey =
  | 'agenda_obras'
  | 'acompanhamento_obras'
  | 'calendario_obras'
  | 'chegada_materiais'
  | 'calendario_chegada_materiais'
  | 'metricas_obras'

export const PAGE_ZOOM_MIN = 50
export const PAGE_ZOOM_MAX = 200
export const PAGE_ZOOM_STEP = 10
export const PAGE_ZOOM_DEFAULT = 100

export function clampPageZoom(value: number): number {
  return Math.min(PAGE_ZOOM_MAX, Math.max(PAGE_ZOOM_MIN, Math.round(value)))
}
