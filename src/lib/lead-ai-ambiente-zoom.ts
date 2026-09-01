export const AMBIENTE_ZOOM_MIN = 0.4;
export const AMBIENTE_ZOOM_MAX = 2.8;
export const AMBIENTE_ZOOM_STEP = 0.12;
export const AMBIENTE_OVERLAY_BASE = 0.28;
export const AMBIENTE_OBJECT_BASE_W = 0.22;
export const AMBIENTE_OBJECT_BASE_H = 0.34;

export function clampAmbienteZoom(value: number): number {
  return Math.min(AMBIENTE_ZOOM_MAX, Math.max(AMBIENTE_ZOOM_MIN, value));
}

/**
 * Tamanho da foto na lousa (0–1).
 * `imageAspect` = largura/altura da imagem.
 * `sceneAspect` = largura/altura da área da lousa — sem isso a foto parece achatada.
 */
export function overlaySizeFromZoom(
  scale: number,
  imageAspect = 1,
  sceneAspect = 1,
): { width: number; height: number } {
  const zoom = clampAmbienteZoom(scale);
  const longest = Math.min(0.92, Math.max(0.08, AMBIENTE_OVERLAY_BASE * zoom));
  const img = Number.isFinite(imageAspect) && imageAspect > 0.08 && imageAspect < 12 ? imageAspect : 1;
  const scene = Number.isFinite(sceneAspect) && sceneAspect > 0.25 && sceneAspect < 5 ? sceneAspect : 1;
  const normalized = img / scene;
  if (normalized >= 1) {
    return { width: longest, height: longest / normalized };
  }
  return { width: longest * normalized, height: longest };
}

export function zoomFromOverlayWidth(width: number, height = width): number {
  return clampAmbienteZoom(Math.max(width, height) / AMBIENTE_OVERLAY_BASE);
}

export function objectSizeFromZoom(scale: number): { width: number; height: number } {
  const zoom = clampAmbienteZoom(scale);
  return {
    width: Math.min(0.72, Math.max(0.08, AMBIENTE_OBJECT_BASE_W * zoom)),
    height: Math.min(0.86, Math.max(0.1, AMBIENTE_OBJECT_BASE_H * zoom)),
  };
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
