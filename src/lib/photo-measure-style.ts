import type { WhiteboardPoint } from '@/lib/whiteboard-annotations';

/** Paleta inspirada em apps de medição em foto (PhotoMeasure). */
export const MEASURE_COLOR_PRESETS = [
  { id: 'orange', hex: '#FF6B2C', label: 'Laranja' },
  { id: 'magenta', hex: '#E91E8C', label: 'Magenta' },
  { id: 'coral', hex: '#FF3D5A', label: 'Coral' },
] as const;

export type MeasureVariant = 'linear' | 'arc';

export function distanceBetween(a: WhiteboardPoint, b: WhiteboardPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Formato brasileiro: 58,5 */
export function formatMeasureValue(px: number): string {
  if (px < 10) return px.toFixed(1).replace('.', ',');
  return String(Math.round(px));
}

export function midpoint(a: WhiteboardPoint, b: WhiteboardPoint): WhiteboardPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Ponto médio em curva quadrática Bézier. */
export function quadraticMidpoint(a: WhiteboardPoint, via: WhiteboardPoint, b: WhiteboardPoint): WhiteboardPoint {
  const t = 0.5;
  const mt = 1 - t;
  return {
    x: mt * mt * a.x + 2 * mt * t * via.x + t * t * b.x,
    y: mt * mt * a.y + 2 * mt * t * via.y + t * t * b.y,
  };
}

export function perpendicularOffset(
  a: WhiteboardPoint,
  b: WhiteboardPoint,
  distance: number,
): WhiteboardPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (-dy / len) * distance, y: (dx / len) * distance };
}

export function isNearlyHorizontal(a: WhiteboardPoint, b: WhiteboardPoint, thresholdDeg = 12): boolean {
  const angle = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  return angle < thresholdDeg || angle > 180 - thresholdDeg;
}

export function measureZoneRect(
  a: WhiteboardPoint,
  b: WhiteboardPoint,
  padding = 8,
): { x: number; y: number; w: number; h: number } | null {
  if (!isNearlyHorizontal(a, b)) return null;
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const h = Math.max(24, padding * 3);
  return { x: left, y: y + padding, w: right - left, h };
}

export function arcViaPoint(a: WhiteboardPoint, b: WhiteboardPoint, bulge = 0.35): WhiteboardPoint {
  const mid = midpoint(a, b);
  const off = perpendicularOffset(a, b, distanceBetween(a, b) * bulge);
  return { x: mid.x + off.x, y: mid.y + off.y };
}

export function measurePathD(
  a: WhiteboardPoint,
  b: WhiteboardPoint,
  via?: WhiteboardPoint | null,
): string {
  if (via) {
    return `M ${a.x} ${a.y} Q ${via.x} ${via.y} ${b.x} ${b.y}`;
  }
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

/** Comprimento aproximado de arco quadrático Bézier (amostragem uniforme em t). */
export function quadraticArcLength(
  a: WhiteboardPoint,
  via: WhiteboardPoint,
  b: WhiteboardPoint,
  segments = 24,
): number {
  let length = 0;
  let prev = a;
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    const mt = 1 - t;
    const pt = {
      x: mt * mt * a.x + 2 * mt * t * via.x + t * t * b.x,
      y: mt * mt * a.y + 2 * mt * t * via.y + t * t * b.y,
    };
    length += distanceBetween(prev, pt);
    prev = pt;
  }
  return length;
}

export function measureDistance(
  a: WhiteboardPoint,
  b: WhiteboardPoint,
  via?: WhiteboardPoint | null,
): number {
  if (via) return quadraticArcLength(a, via, b);
  return distanceBetween(a, b);
}

/**
 * Posição da etiqueta numérica — afastada do traço para não misturar com a linha.
 * Arco usa distância menor (já há curvatura); reta usa folga maior.
 */
export function measureLabelPosition(
  a: WhiteboardPoint,
  b: WhiteboardPoint,
  via?: WhiteboardPoint | null,
): { anchor: WhiteboardPoint; x: number; y: number } {
  const anchor = via ? quadraticMidpoint(a, via, b) : midpoint(a, b);
  const offsetDist = via ? 32 : 44;
  const offset = perpendicularOffset(a, b, offsetDist);
  return {
    anchor,
    x: anchor.x + offset.x,
    y: anchor.y + offset.y,
  };
}
