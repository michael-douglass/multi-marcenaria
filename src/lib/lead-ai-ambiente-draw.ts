import type { AmbienteDrawTool, AmbienteGeoKind, AmbienteGeoShape } from '@/lib/lead-ai-ambiente-types';

export const AMBIENTE_INK = '#f2d892';
export const AMBIENTE_INK_FILL = 'rgba(255, 246, 234, 0.16)';
export const DRAW_MIN_SIZE = 0.014;
export const PENCIL_MIN_DIST = 0.005;
export const HIT_SLOP = 0.018;

export function wrapShapeRotation(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

export function rotatePointAround(
  px: number,
  py: number,
  cx: number,
  cy: number,
  deg: number,
): { x: number; y: number } {
  if (!deg) return { x: px, y: py };
  const rad = (deg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export function unrotatedBounds(shape: AmbienteGeoShape): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (shape.kind === 'line') {
    const x2 = shape.x2 ?? shape.x;
    const y2 = shape.y2 ?? shape.y;
    return {
      x: Math.min(shape.x, x2),
      y: Math.min(shape.y, y2),
      width: Math.abs(x2 - shape.x),
      height: Math.abs(y2 - shape.y),
    };
  }
  if (shape.kind === 'pencil') {
    const points = shape.points ?? [];
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = points[0].x;
    let maxX = points[0].x;
    let minY = points[0].y;
    let maxY = points[0].y;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
}

export function shapeCenter(shape: AmbienteGeoShape): { x: number; y: number } {
  const box = unrotatedBounds(shape);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Paleta da lousa do ambiente — contraste em foto clara e no fundo escuro. */
export const AMBIENTE_INK_PRESETS = [
  { id: 'gold', hex: '#f2d892', label: 'Dourado' },
  { id: 'cream', hex: '#fff6ea', label: 'Creme' },
  { id: 'coral', hex: '#e85d4c', label: 'Coral' },
  { id: 'sky', hex: '#4aa3ff', label: 'Azul' },
  { id: 'lime', hex: '#7dce7a', label: 'Verde' },
  { id: 'ink', hex: '#1c100c', label: 'Escuro' },
] as const;

export function inkFillFromStroke(stroke: string, alpha = 0.18): string {
  const raw = stroke.trim().replace('#', '');
  const hex =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw;
  if (hex.length !== 6 || !/^[0-9a-fA-F]+$/.test(hex)) return AMBIENTE_INK_FILL;
  const n = Number.parseInt(hex, 16);
  if (!Number.isFinite(n)) return AMBIENTE_INK_FILL;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const AMBIENTE_DRAW_TOOL_ORDER: AmbienteDrawTool[] = [
  'select',
  'pencil',
  'line',
  'rect',
  'ellipse',
  'triangle',
];

export function isDrawCreateTool(tool: AmbienteDrawTool): boolean {
  return tool !== 'select';
}

export function cloneGeoShapes(shapes: AmbienteGeoShape[]): AmbienteGeoShape[] {
  return shapes.map((shape) => ({
    ...shape,
    points: shape.points?.map((point) => ({ ...point })),
  }));
}

export function boxFromDrag(
  start: { x: number; y: number },
  end: { x: number; y: number },
  constrainSquare: boolean,
): { x: number; y: number; width: number; height: number } {
  let dx = end.x - start.x;
  let dy = end.y - start.y;
  if (constrainSquare) {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    dx = (dx < 0 ? -1 : 1) * size;
    dy = (dy < 0 ? -1 : 1) * size;
  }
  return {
    x: dx < 0 ? start.x + dx : start.x,
    y: dy < 0 ? start.y + dy : start.y,
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

export function lineFromDrag(
  start: { x: number; y: number },
  end: { x: number; y: number },
  constrain45: boolean,
): { x: number; y: number; x2: number; y2: number } {
  if (!constrain45) {
    return { x: start.x, y: start.y, x2: end.x, y2: end.y };
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const snapped = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const length = Math.hypot(dx, dy);
  return {
    x: start.x,
    y: start.y,
    x2: start.x + Math.cos(snapped) * length,
    y2: start.y + Math.sin(snapped) * length,
  };
}

export function trianglePoints(shape: Pick<AmbienteGeoShape, 'x' | 'y' | 'width' | 'height'>): {
  x: number;
  y: number;
}[] {
  return [
    { x: shape.x + shape.width / 2, y: shape.y },
    { x: shape.x, y: shape.y + shape.height },
    { x: shape.x + shape.width, y: shape.y + shape.height },
  ];
}

export function shapeIsCommitable(shape: AmbienteGeoShape): boolean {
  if (shape.kind === 'line') {
    return Math.hypot((shape.x2 ?? shape.x) - shape.x, (shape.y2 ?? shape.y) - shape.y) > DRAW_MIN_SIZE;
  }
  if (shape.kind === 'pencil') {
    const points = shape.points ?? [];
    if (points.length < 2) return false;
    let length = 0;
    for (let i = 1; i < points.length; i += 1) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return length > DRAW_MIN_SIZE;
  }
  return shape.width > DRAW_MIN_SIZE && shape.height > DRAW_MIN_SIZE;
}

export function previewFromDrag(input: {
  id: string;
  kind: AmbienteGeoKind;
  start: { x: number; y: number };
  end: { x: number; y: number };
  shiftKey: boolean;
  fill: boolean;
  stroke?: string;
  points?: { x: number; y: number }[];
}): AmbienteGeoShape {
  const stroke = input.stroke || AMBIENTE_INK;
  if (input.kind === 'line') {
    const line = lineFromDrag(input.start, input.end, input.shiftKey);
    return {
      id: input.id,
      kind: 'line',
      x: line.x,
      y: line.y,
      width: 0,
      height: 0,
      x2: line.x2,
      y2: line.y2,
      rotation: 0,
      stroke,
      fill: false,
    };
  }
  if (input.kind === 'pencil') {
    return {
      id: input.id,
      kind: 'pencil',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      points: input.points ?? [input.start, input.end],
      rotation: 0,
      stroke,
      fill: false,
    };
  }
  const box = boxFromDrag(input.start, input.end, input.shiftKey);
  return {
    id: input.id,
    kind: input.kind,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    stroke,
    fill: input.fill,
  };
}

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-8) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pointInTriangle(
  px: number,
  py: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): boolean {
  const area = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(area) < 1e-8) return false;
  const s = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / area;
  const t = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / area;
  const u = 1 - s - t;
  return s >= 0 && t >= 0 && u >= 0;
}

export function hitTestShape(shape: AmbienteGeoShape, px: number, py: number): boolean {
  const rotation = shape.rotation ?? 0;
  if (rotation) {
    const center = shapeCenter(shape);
    const local = rotatePointAround(px, py, center.x, center.y, -rotation);
    px = local.x;
    py = local.y;
  }
  if (shape.kind === 'line') {
    return distToSegment(px, py, shape.x, shape.y, shape.x2 ?? shape.x, shape.y2 ?? shape.y) <= HIT_SLOP;
  }
  if (shape.kind === 'pencil') {
    const points = shape.points ?? [];
    for (let i = 1; i < points.length; i += 1) {
      if (distToSegment(px, py, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y) <= HIT_SLOP) {
        return true;
      }
    }
    return false;
  }
  if (shape.kind === 'ellipse') {
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    const rx = Math.max(shape.width / 2, 0.001);
    const ry = Math.max(shape.height / 2, 0.001);
    const nx = (px - cx) / rx;
    const ny = (py - cy) / ry;
    const inside = nx * nx + ny * ny <= 1;
    if (shape.fill) return inside || nx * nx + ny * ny <= (1 + HIT_SLOP / Math.min(rx, ry)) ** 2;
    const ring = Math.abs(Math.sqrt(nx * nx + ny * ny) - 1);
    return ring * Math.min(rx, ry) <= HIT_SLOP;
  }
  if (shape.kind === 'triangle') {
    const [a, b, c] = trianglePoints(shape);
    if (shape.fill && pointInTriangle(px, py, a, b, c)) return true;
    return (
      distToSegment(px, py, a.x, a.y, b.x, b.y) <= HIT_SLOP ||
      distToSegment(px, py, b.x, b.y, c.x, c.y) <= HIT_SLOP ||
      distToSegment(px, py, c.x, c.y, a.x, a.y) <= HIT_SLOP
    );
  }
  const inside =
    px >= shape.x - HIT_SLOP &&
    px <= shape.x + shape.width + HIT_SLOP &&
    py >= shape.y - HIT_SLOP &&
    py <= shape.y + shape.height + HIT_SLOP;
  if (shape.fill) return inside;
  const nearEdge =
    px >= shape.x - HIT_SLOP &&
    px <= shape.x + shape.width + HIT_SLOP &&
    py >= shape.y - HIT_SLOP &&
    py <= shape.y + shape.height + HIT_SLOP &&
    (Math.abs(px - shape.x) <= HIT_SLOP ||
      Math.abs(px - (shape.x + shape.width)) <= HIT_SLOP ||
      Math.abs(py - shape.y) <= HIT_SLOP ||
      Math.abs(py - (shape.y + shape.height)) <= HIT_SLOP);
  return nearEdge;
}

export function shapeBounds(shape: AmbienteGeoShape): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const raw = unrotatedBounds(shape);
  const rotation = shape.rotation ?? 0;
  if (!rotation) return raw;
  const center = { x: raw.x + raw.width / 2, y: raw.y + raw.height / 2 };
  const corners = [
    rotatePointAround(raw.x, raw.y, center.x, center.y, rotation),
    rotatePointAround(raw.x + raw.width, raw.y, center.x, center.y, rotation),
    rotatePointAround(raw.x + raw.width, raw.y + raw.height, center.x, center.y, rotation),
    rotatePointAround(raw.x, raw.y + raw.height, center.x, center.y, rotation),
  ];
  let minX = corners[0].x;
  let maxX = corners[0].x;
  let minY = corners[0].y;
  let maxY = corners[0].y;
  for (const corner of corners) {
    minX = Math.min(minX, corner.x);
    maxX = Math.max(maxX, corner.x);
    minY = Math.min(minY, corner.y);
    maxY = Math.max(maxY, corner.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function findTopShapeAt(shapes: AmbienteGeoShape[], px: number, py: number): AmbienteGeoShape | null {
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    if (hitTestShape(shapes[i], px, py)) return shapes[i];
  }
  return null;
}

export function translateShape(shape: AmbienteGeoShape, dx: number, dy: number): AmbienteGeoShape {
  if (shape.kind === 'pencil') {
    return {
      ...shape,
      points: (shape.points ?? []).map((point) => ({ x: point.x + dx, y: point.y + dy })),
    };
  }
  if (shape.kind === 'line') {
    return {
      ...shape,
      x: shape.x + dx,
      y: shape.y + dy,
      x2: (shape.x2 ?? shape.x) + dx,
      y2: (shape.y2 ?? shape.y) + dy,
    };
  }
  return { ...shape, x: shape.x + dx, y: shape.y + dy };
}

export function resizeBoxShape(
  shape: AmbienteGeoShape,
  orig: { x: number; y: number; width: number; height: number },
  factor: number,
): AmbienteGeoShape {
  if (shape.kind === 'line' || shape.kind === 'pencil') return shape;
  const nextFactor = Math.max(0.2, factor);
  const width = Math.max(DRAW_MIN_SIZE, orig.width * nextFactor);
  const height = Math.max(DRAW_MIN_SIZE, orig.height * nextFactor);
  const cx = orig.x + orig.width / 2;
  const cy = orig.y + orig.height / 2;
  return {
    ...shape,
    width,
    height,
    x: cx - width / 2,
    y: cy - height / 2,
  };
}

export function appendPencilPoint(
  points: { x: number; y: number }[],
  next: { x: number; y: number },
): { x: number; y: number }[] {
  const last = points[points.length - 1];
  if (last && Math.hypot(next.x - last.x, next.y - last.y) < PENCIL_MIN_DIST) return points;
  return [...points, next];
}

/** Desenha a forma no JPEG achatado enviado à IA. */
export function paintGeoShape(
  ctx: CanvasRenderingContext2D,
  shape: AmbienteGeoShape,
  worldW: number,
  worldH: number,
): void {
  const stroke = shape.stroke || AMBIENTE_INK;
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.fillStyle = inkFillFromStroke(stroke);
  ctx.lineWidth = Math.max(2.2, Math.min(worldW, worldH) * 0.0042);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = inkFillFromStroke(stroke, 0.35);
  ctx.shadowBlur = 6;
  const rotation = shape.rotation ?? 0;
  if (rotation) {
    const center = shapeCenter(shape);
    ctx.translate(center.x * worldW, center.y * worldH);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-center.x * worldW, -center.y * worldH);
  }

  if (shape.kind === 'line') {
    ctx.beginPath();
    ctx.moveTo(shape.x * worldW, shape.y * worldH);
    ctx.lineTo((shape.x2 ?? shape.x) * worldW, (shape.y2 ?? shape.y) * worldH);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (shape.kind === 'pencil') {
    const points = shape.points ?? [];
    if (points.length < 2) {
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x * worldW, points[0].y * worldH);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x * worldW, points[i].y * worldH);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  const x = shape.x * worldW;
  const y = shape.y * worldH;
  const w = shape.width * worldW;
  const h = shape.height * worldH;

  if (shape.kind === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
    if (shape.fill) ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (shape.kind === 'triangle') {
    const points = trianglePoints(shape);
    ctx.beginPath();
    ctx.moveTo(points[0].x * worldW, points[0].y * worldH);
    ctx.lineTo(points[1].x * worldW, points[1].y * worldH);
    ctx.lineTo(points[2].x * worldW, points[2].y * worldH);
    ctx.closePath();
    if (shape.fill) ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.rect(x, y, w, h);
  if (shape.fill) ctx.fill();
  ctx.stroke();
  ctx.restore();
}
