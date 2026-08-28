export const AMBIENTE_ZOOM_MIN = 0.4;
export const AMBIENTE_ZOOM_MAX = 2.8;
export const AMBIENTE_ZOOM_STEP = 0.12;
export const AMBIENTE_OVERLAY_BASE = 0.28;
export const AMBIENTE_OBJECT_BASE_W = 0.22;
export const AMBIENTE_OBJECT_BASE_H = 0.34;

export function clampAmbienteZoom(value: number): number {
  return Math.min(AMBIENTE_ZOOM_MAX, Math.max(AMBIENTE_ZOOM_MIN, value));
}

export function overlaySizeFromZoom(scale: number): { width: number; height: number } {
  const zoom = clampAmbienteZoom(scale);
  const size = Math.min(0.92, Math.max(0.08, AMBIENTE_OVERLAY_BASE * zoom));
  return { width: size, height: size };
}

export function objectSizeFromZoom(scale: number): { width: number; height: number } {
  const zoom = clampAmbienteZoom(scale);
  return {
    width: Math.min(0.72, Math.max(0.08, AMBIENTE_OBJECT_BASE_W * zoom)),
    height: Math.min(0.86, Math.max(0.1, AMBIENTE_OBJECT_BASE_H * zoom)),
  };
}

export function zoomFromOverlayWidth(width: number): number {
  return clampAmbienteZoom(width / AMBIENTE_OVERLAY_BASE);
}

export function zoomFromObjectWidth(width: number): number {
  return clampAmbienteZoom(width / AMBIENTE_OBJECT_BASE_W);
}

export function clampAmbienteObjectWidth(value: number): number {
  return Math.min(0.85, Math.max(0.06, value));
}

export function clampAmbienteObjectHeight(value: number): number {
  return Math.min(0.92, Math.max(0.08, value));
}
