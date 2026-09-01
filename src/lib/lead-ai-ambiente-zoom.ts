import type {
  AmbienteFurnitureObject,
  AmbienteGeoShape,
  AmbienteImageOverlay,
  AmbienteLabelMarker,
} from '@/lib/lead-ai-ambiente-types';

export const AMBIENTE_ZOOM_MIN = 0.25;
export const AMBIENTE_ZOOM_MAX = 8;
export const AMBIENTE_ZOOM_STEP = 0.2;
export const AMBIENTE_OVERLAY_BASE = 0.28;
export const AMBIENTE_OVERLAY_MAX_SPAN = 2.4;
export const AMBIENTE_OBJECT_BASE_W = 0.22;
export const AMBIENTE_OBJECT_BASE_H = 0.34;
export const AMBIENTE_OBJECT_MAX_SPAN = 2.2;

export function clampAmbienteZoom(value: number): number {
  return Math.min(AMBIENTE_ZOOM_MAX, Math.max(AMBIENTE_ZOOM_MIN, value));
}

/** Giro transversal da foto do móvel (0–359). */
export function wrapPhotoYaw(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

/** Inclinação da foto — volta completa no eixo horizontal (0–359). */
export function wrapPhotoPitch(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

export function clampPhotoPitch(deg: number): number {
  return wrapPhotoPitch(deg);
}

/**
 * Tamanho da foto na lousa. Pode passar de 100% para aproximar de verdade.
 */
export function overlaySizeFromZoom(
  scale: number,
  imageAspect = 1,
  sceneAspect = 1,
): { width: number; height: number } {
  const zoom = clampAmbienteZoom(scale);
  const longest = Math.min(AMBIENTE_OVERLAY_MAX_SPAN, Math.max(0.06, AMBIENTE_OVERLAY_BASE * zoom));
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
    width: Math.min(AMBIENTE_OBJECT_MAX_SPAN, Math.max(0.06, AMBIENTE_OBJECT_BASE_W * zoom)),
    height: Math.min(AMBIENTE_OBJECT_MAX_SPAN, Math.max(0.08, AMBIENTE_OBJECT_BASE_H * zoom)),
  };
}

export function zoomFromObjectWidth(width: number): number {
  return clampAmbienteZoom(width / AMBIENTE_OBJECT_BASE_W);
}

export function clampAmbienteObjectWidth(value: number): number {
  return Math.min(AMBIENTE_OBJECT_MAX_SPAN, Math.max(0.06, value));
}

export function clampAmbienteObjectHeight(value: number): number {
  return Math.min(AMBIENTE_OBJECT_MAX_SPAN, Math.max(0.08, value));
}

/** Retângulo da foto do cômodo dentro da lousa (0–1). */
export interface AmbienteNormPlane {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function planeFromContainFit(nw: number, nh: number): AmbienteNormPlane {
  return {
    left: (1 - nw) / 2,
    top: (1 - nh) / 2,
    width: Math.max(0.08, nw),
    height: Math.max(0.08, nh),
  };
}

/**
 * Caixa object-contain: a foto cabe inteira, sem esticar.
 * Igual ao CSS `object-contain` da lousa.
 */
export function containedRectInBox(
  boxW: number,
  boxH: number,
  contentW: number,
  contentH: number,
): { dx: number; dy: number; dw: number; dh: number } {
  const srcW = Math.max(1, contentW);
  const srcH = Math.max(1, contentH);
  const fit = Math.min(boxW / srcW, boxH / srcH);
  const dw = srcW * fit;
  const dh = srcH * fit;
  return {
    dx: (boxW - dw) / 2,
    dy: (boxH - dh) / 2,
    dw,
    dh,
  };
}

export function isUsableAmbienteViewport(width: number, height: number): boolean {
  return width >= 48 && height >= 48;
}

export function planesDiffer(a: AmbienteNormPlane, b: AmbienteNormPlane, eps = 0.01): boolean {
  return (
    Math.abs(a.left - b.left) > eps ||
    Math.abs(a.top - b.top) > eps ||
    Math.abs(a.width - b.width) > eps ||
    Math.abs(a.height - b.height) > eps
  );
}

function remapAlong(
  value: number,
  fromStart: number,
  fromSize: number,
  toStart: number,
  toSize: number,
): number {
  const t = fromSize === 0 ? 0 : (value - fromStart) / fromSize;
  return toStart + t * toSize;
}

function remapSpan(size: number, fromSize: number, toSize: number): number {
  return fromSize === 0 ? size : (size / fromSize) * toSize;
}

/** Mantém móveis e fotos colados no cômodo quando a lousa muda de tamanho. */
export function remapSceneToPlane(
  scene: {
    overlays: AmbienteImageOverlay[];
    objects: AmbienteFurnitureObject[];
    markers: AmbienteLabelMarker[];
    shapes: AmbienteGeoShape[];
  },
  from: AmbienteNormPlane,
  to: AmbienteNormPlane,
): typeof scene {
  const rx = (x: number) => remapAlong(x, from.left, from.width, to.left, to.width);
  const ry = (y: number) => remapAlong(y, from.top, from.height, to.top, to.height);
  const rw = (w: number) => remapSpan(w, from.width, to.width);
  const rh = (h: number) => remapSpan(h, from.height, to.height);
  return {
    overlays: scene.overlays.map((item) => ({
      ...item,
      x: rx(item.x),
      y: ry(item.y),
      width: rw(item.width),
      height: rh(item.height),
    })),
    objects: scene.objects.map((item) => ({
      ...item,
      x: rx(item.x),
      y: ry(item.y),
      width: rw(item.width),
      height: rh(item.height),
    })),
    markers: scene.markers.map((item) => ({
      ...item,
      x: rx(item.x),
      y: ry(item.y),
    })),
    shapes: scene.shapes.map((item) => ({
      ...item,
      x: rx(item.x),
      y: ry(item.y),
      width: rw(item.width),
      height: rh(item.height),
      x2: item.x2 == null ? item.x2 : rx(item.x2),
      y2: item.y2 == null ? item.y2 : ry(item.y2),
      points: item.points?.map((point) => ({ x: rx(point.x), y: ry(point.y) })),
    })),
  };
}
