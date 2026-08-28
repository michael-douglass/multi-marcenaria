export const CONTRATO_PREVIEW_ZOOM_DEFAULT = 100;
export const CONTRATO_PREVIEW_ZOOM_MIN = 50;
export const CONTRATO_PREVIEW_ZOOM_MAX = 200;
export const CONTRATO_PREVIEW_ZOOM_STEP = 10;

export function clampContratoPreviewZoom(value: number): number {
  const stepped = Math.round(value / CONTRATO_PREVIEW_ZOOM_STEP) * CONTRATO_PREVIEW_ZOOM_STEP;
  return Math.min(
    CONTRATO_PREVIEW_ZOOM_MAX,
    Math.max(CONTRATO_PREVIEW_ZOOM_MIN, stepped),
  );
}

export function contratoPreviewZoomToScale(percent: number): number {
  return clampContratoPreviewZoom(percent) / 100;
}
