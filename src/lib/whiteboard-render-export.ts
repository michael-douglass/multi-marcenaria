import type { LeadWhiteboardDrawing, LeadWhiteboardImage } from '@/hooks/useLeadWhiteboard';
import {
  decodeAnnotationDrawing,
  filterDrawingsByImage,
  getDrawingPathData,
  polylineToPath,
  lineToPath,
  rectCorners,
  type DecodedWhiteboardAnnotation,
  type WhiteboardAnnotationPayload,
} from '@/lib/whiteboard-annotations';
import { measureLabelPosition } from '@/lib/photo-measure-style';
import { loadImageForRender } from '@/lib/render-image-normalize';
import { furnitureFrame } from '@/lib/furniture-modules';

const MAX_RENDER_EDGE_PX = 2048;
const JPEG_QUALITY = 0.92;
const WORLD_MIN_W = 640;
const WORLD_MIN_H = 480;

function computePhotoWorldSize(image: LeadWhiteboardImage) {
  return {
    width: Math.max(Number(image.width) || WORLD_MIN_W, 200),
    height: Math.max(Number(image.height) || WORLD_MIN_H, 150),
  };
}

function scaleToMaxEdge(width: number, height: number, maxEdge: number) {
  const largest = Math.max(width, height);
  if (largest <= maxEdge) return { width, height, scale: 1 };
  const ratio = maxEdge / largest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scale: ratio,
  };
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  worldW: number,
  worldH: number,
): void {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (nw <= 0 || nh <= 0) return;

  const scale = Math.min(worldW / nw, worldH / nh);
  const dw = nw * scale;
  const dh = nh * scale;
  const dx = (worldW - dw) / 2;
  const dy = (worldH - dh) / 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, worldW, worldH);
  ctx.drawImage(img, dx, dy, dw, dh);
}

function strokeSvgPath(
  ctx: CanvasRenderingContext2D,
  pathData: string,
  color: string,
  strokeWidth: number,
): void {
  if (!pathData.trim()) return;
  try {
    const path = new Path2D(pathData);
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
  } catch {
    // path SVG inválido — ignora traço
  }
}

function drawPolylinePayload(
  ctx: CanvasRenderingContext2D,
  payload: Extract<WhiteboardAnnotationPayload, { kind: 'polyline' }>,
  color: string,
  strokeWidth: number,
): void {
  strokeSvgPath(ctx, polylineToPath(payload.points), color, strokeWidth);
}

function drawLinePayload(
  ctx: CanvasRenderingContext2D,
  payload: Extract<WhiteboardAnnotationPayload, { kind: 'line' }>,
  color: string,
  strokeWidth: number,
): void {
  strokeSvgPath(ctx, lineToPath(payload.a, payload.b), color, strokeWidth);
}

function drawRectPayload(
  ctx: CanvasRenderingContext2D,
  payload: Extract<WhiteboardAnnotationPayload, { kind: 'rect' }>,
  color: string,
  strokeWidth: number,
): void {
  const corners = rectCorners(payload.x, payload.y, payload.w, payload.h, payload.rotation);
  if (corners.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.stroke();
}

function drawEllipsePayload(
  ctx: CanvasRenderingContext2D,
  payload: Extract<WhiteboardAnnotationPayload, { kind: 'ellipse' }>,
  color: string,
  strokeWidth: number,
): void {
  ctx.save();
  ctx.translate(payload.cx, payload.cy);
  ctx.rotate((payload.rotation * Math.PI) / 180);
  ctx.beginPath();
  ctx.ellipse(0, 0, payload.rx, payload.ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.stroke();
  ctx.restore();
}

function drawTextPayload(
  ctx: CanvasRenderingContext2D,
  ann: DecodedWhiteboardAnnotation,
  payload: Extract<WhiteboardAnnotationPayload, { kind: 'text' }>,
): void {
  const lines = payload.text.split('\n');
  ctx.save();
  ctx.translate(payload.x + payload.w / 2, payload.y + payload.h / 2);
  ctx.rotate((payload.rotation * Math.PI) / 180);

  // Fundo suave da caixa (como na lousa)
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const hw = payload.w / 2;
  const hh = payload.h / 2;
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(-hw, -hh, payload.w, payload.h, 6);
  } else {
    ctx.rect(-hw, -hh, payload.w, payload.h);
  }
  ctx.fill();
  ctx.stroke();

  const fill = ann.cor || '#111111';
  ctx.font = `${payload.fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lineHeight = payload.fontSize * 1.25;
  const startY = -payload.h / 2 + 4;
  const startX = -payload.w / 2 + 6;
  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    // Sombra / halo para destacar a escrita
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, payload.fontSize * 0.08);
    ctx.lineJoin = 'round';
    ctx.strokeText(line, startX, y);
    ctx.fillStyle = fill;
    ctx.fillText(line, startX, y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  });
  ctx.restore();
}

function drawMeasurePayload(
  ctx: CanvasRenderingContext2D,
  payload: Extract<WhiteboardAnnotationPayload, { kind: 'measure' }>,
  color: string,
  strokeWidth: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(payload.a.x, payload.a.y);
  if (payload.via) {
    ctx.quadraticCurveTo(payload.via.x, payload.via.y, payload.b.x, payload.b.y);
  } else {
    ctx.lineTo(payload.b.x, payload.b.y);
  }
  ctx.stroke();

  // Pontos A/B
  for (const pt of [payload.a, payload.b]) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (payload.label?.trim()) {
    const { x: mx, y: my } = measureLabelPosition(payload.a, payload.b, payload.via);
    const label = payload.label;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(label);
    const padX = 12;
    const boxW = Math.max(52, metrics.width + padX * 2);
    const boxH = 28;

    // Placa opaca (igual à lousa)
    ctx.fillStyle = 'rgba(8, 6, 4, 0.97)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(mx - boxW / 2, my - boxH / 2, boxW, boxH, 8);
    } else {
      ctx.rect(mx - boxW / 2, my - boxH / 2, boxW, boxH);
    }
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Faixa colorida no topo
    ctx.fillStyle = color;
    ctx.fillRect(mx - boxW / 2 + 2, my - boxH / 2 + 2, boxW - 4, 4);

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(label, mx, my + 2);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
}

function drawFurnitureModulePayload(
  ctx: CanvasRenderingContext2D,
  payload: Extract<WhiteboardAnnotationPayload, { kind: 'furniture_module' }>,
  color: string,
  strokeWidth: number,
): void {
  const strokeColor = payload.colorHex ?? color;
  const frame = furnitureFrame(
    payload.a,
    payload.b,
    payload.moduleType,
    payload.heightOverride,
    payload.widthOverride,
    payload.topDown === true,
  );
  const hidden = new Set(payload.hiddenLineIndices ?? []);

  // Faces 3D leves (como na lousa)
  for (let i = 0; i < frame.fillFaces.length; i++) {
    const face = frame.fillFaces[i];
    if (face.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(face[0].x, face[0].y);
    for (let j = 1; j < face.length; j++) {
      ctx.lineTo(face[j].x, face[j].y);
    }
    ctx.closePath();
    ctx.fillStyle = strokeColor;
    ctx.globalAlpha = i === 2 ? 0.06 : i === 0 ? 0.12 : 0.09;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < frame.lines.length; i++) {
    if (hidden.has(i)) continue;
    const [p0, p1] = frame.lines[i];
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
}

/** Expõe o desenho de anotações para testes / reuso. */
export function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: DecodedWhiteboardAnnotation,
): void {
  const strokeWidth = Math.max(1, Number(ann.stroke_width) || 2);
  const color = ann.cor || '#e85d04';

  switch (ann.payload.kind) {
    case 'polyline':
      drawPolylinePayload(ctx, ann.payload, color, strokeWidth);
      break;
    case 'line':
      drawLinePayload(ctx, ann.payload, color, strokeWidth);
      break;
    case 'rect':
      drawRectPayload(ctx, ann.payload, color, strokeWidth);
      break;
    case 'ellipse':
      drawEllipsePayload(ctx, ann.payload, color, strokeWidth);
      break;
    case 'text':
      drawTextPayload(ctx, ann, ann.payload);
      break;
    case 'measure':
      drawMeasurePayload(ctx, ann.payload, color, strokeWidth);
      break;
    case 'furniture_module':
      drawFurnitureModulePayload(ctx, ann.payload, color, strokeWidth);
      break;
    default:
      break;
  }
}

/**
 * Conta quantos itens serão pintados no JPEG (útil para validar o salvamento).
 */
export function countWhiteboardExportItems(input: {
  image: LeadWhiteboardImage;
  drawings: LeadWhiteboardDrawing[];
  legacyFallbackImageId?: string | null;
}): { freehand: number; annotations: number; furniture: number; total: number } {
  const imageDrawings = filterDrawingsByImage(
    input.drawings,
    input.image.id,
    input.legacyFallbackImageId,
  );
  let freehand = 0;
  let annotations = 0;
  let furniture = 0;
  for (const drawing of imageDrawings) {
    const ann = decodeAnnotationDrawing(drawing);
    if (!ann) {
      freehand += 1;
      continue;
    }
    annotations += 1;
    if (ann.payload.kind === 'furniture_module') furniture += 1;
  }
  return { freehand, annotations, furniture, total: freehand + annotations };
}

/**
 * Exporta foto da lousa + traços/anotações vinculados como JPEG para a API de renderização.
 */
export async function exportWhiteboardImageForRender(input: {
  image: LeadWhiteboardImage;
  drawings: LeadWhiteboardDrawing[];
  legacyFallbackImageId?: string | null;
}): Promise<string> {
  const { image, drawings, legacyFallbackImageId } = input;
  const img = await loadImageForRender(image.file_url);
  const world = computePhotoWorldSize(image);
  const { width, height } = scaleToMaxEdge(world.width, world.height, MAX_RENDER_EDGE_PX);
  const scale = width / world.width;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível exportar a lousa');

  ctx.scale(scale, scale);
  drawImageContain(ctx, img, world.width, world.height);

  const imageDrawings = filterDrawingsByImage(drawings, image.id, legacyFallbackImageId);

  for (const drawing of imageDrawings) {
    const ann = decodeAnnotationDrawing(drawing);
    if (ann) {
      drawAnnotation(ctx, ann);
      continue;
    }
    strokeSvgPath(
      ctx,
      getDrawingPathData(drawing.path_data),
      drawing.cor || '#e85d04',
      Math.max(1, Number(drawing.stroke_width) || 3),
    );
  }

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
