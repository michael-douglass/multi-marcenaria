import { snapshotRealisticFurniture } from '@/lib/lead-ai-ambiente-realistic-mesh';
import { furnitureFrame, getFurnitureModuleMeta } from '@/lib/furniture-modules';
import { GARBO_WOOD_TEXTURE_URL, furnitureViewIsFlat } from '@/lib/furniture-catalog-banks';
import { paintGeoShape } from '@/lib/lead-ai-ambiente-draw';
import { loadImageForRender } from '@/lib/render-image-normalize';
import type {
  AmbienteBackground,
  AmbienteFurnitureObject,
  AmbienteGeoShape,
  AmbienteImageOverlay,
  AmbienteLabelMarker,
} from '@/lib/lead-ai-ambiente-types';

const MAX_EDGE_PX = 1024;
const JPEG_QUALITY = 0.84;
const WORLD_MIN_W = 960;
const WORLD_MIN_H = 640;

export interface AmbienteExportInput {
  background: AmbienteBackground | null;
  overlays: AmbienteImageOverlay[];
  objects: AmbienteFurnitureObject[];
  markers: AmbienteLabelMarker[];
  shapes?: AmbienteGeoShape[];
}

function scaleToMaxEdge(width: number, height: number, maxEdge: number) {
  const largest = Math.max(width, height);
  if (largest <= maxEdge) return { width, height };
  const ratio = maxEdge / largest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function drawWarmPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#3a241c');
  gradient.addColorStop(0.45, '#2a1812');
  gradient.addColorStop(1, '#1a100c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(242, 216, 146, 0.08)';
  ctx.fillRect(0, 0, width, height * 0.18);
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  worldW: number,
  worldH: number,
  scale = 1,
  offsetX = 0.5,
  offsetY = 0.5,
  rotation = 0,
  flipH = false,
  flipV = false,
) {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (nw <= 0 || nh <= 0) return;
  const fit = Math.min(worldW / nw, worldH / nh);
  const zoom = Math.max(0.05, scale);
  const dw = nw * fit * zoom;
  const dh = nh * fit * zoom;
  const dx = (worldW - dw) * offsetX;
  const dy = (worldH - dh) * offsetY;
  ctx.save();
  ctx.translate(dx + dw / 2, dy + dh / 2);
  ctx.rotate(((rotation || 0) * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  object: AmbienteFurnitureObject,
  worldW: number,
  worldH: number,
  woodImg: HTMLImageElement | null,
) {
  const cx = object.x * worldW;
  const cy = object.y * worldH;
  const w = Math.max(40, object.width * worldW);
  const h = Math.max(48, object.height * worldH);
  const color = object.colorHex || '#f2d892';
  const isRealistic = object.viewMode === 'realista';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((object.rotation ?? 0) * Math.PI) / 180);
  const yawRad = ((object.yaw ?? 0) * Math.PI) / 180;
  const pitchRad = ((object.pitch ?? 0) * Math.PI) / 180;
  ctx.scale(Math.max(0.28, Math.cos(yawRad)), Math.max(0.55, Math.cos(pitchRad)));
  const a = { x: 0, y: -h / 2 };
  const b = { x: 0, y: h / 2 };
  const frame = furnitureFrame(
    a,
    b,
    object.moduleType,
    undefined,
    w,
    true,
    furnitureViewIsFlat(object.viewMode),
  );

  for (let i = 0; i < frame.fillFaces.length; i++) {
    const face = frame.fillFaces[i];
    if (face.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(face[0].x, face[0].y);
    for (let j = 1; j < face.length; j++) ctx.lineTo(face[j].x, face[j].y);
    ctx.closePath();
    if (isRealistic && woodImg) {
      ctx.save();
      ctx.clip();
      let minX = face[0].x;
      let minY = face[0].y;
      let maxX = face[0].x;
      let maxY = face[0].y;
      for (const pt of face) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
      ctx.globalAlpha = i === 2 ? 0.95 : 0.78;
      ctx.drawImage(woodImg, minX, minY, Math.max(4, maxX - minX), Math.max(4, maxY - minY));
      ctx.restore();
    } else {
      ctx.fillStyle = color;
      ctx.globalAlpha = i === 2 ? 0.08 : i === 0 ? 0.16 : 0.11;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [p0, p1] of frame.lines) {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  ctx.restore();

  const meta = getFurnitureModuleMeta(object.moduleType);
  ctx.font = '600 13px "Segoe UI", sans-serif';
  ctx.fillStyle = '#fff6ea';
  ctx.textAlign = 'center';
  ctx.fillText(object.label || meta.label, cx, cy - h / 2 - 8);
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  marker: AmbienteLabelMarker,
  worldW: number,
  worldH: number,
) {
  const x = marker.x * worldW;
  const y = marker.y * worldH;
  ctx.font = '600 14px "Segoe UI", sans-serif';
  const textW = Math.min(worldW * 0.4, ctx.measureText(marker.nome).width + 24);
  const textH = 28;
  ctx.fillStyle = 'rgba(42, 24, 18, 0.78)';
  ctx.strokeStyle = 'rgba(242, 216, 146, 0.7)';
  ctx.lineWidth = 1.5;
  const left = x - textW / 2;
  const top = y - textH / 2;
  ctx.beginPath();
  ctx.rect(left, top, textW, textH);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2d892';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(marker.nome, x, y, textW - 12);
}

/** Achata a montagem do ambiente em JPEG para a IA renderizar. */
export async function exportAmbienteCompositionToJpeg(
  input: AmbienteExportInput,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const bgW = input.background?.naturalWidth || WORLD_MIN_W;
  const bgH = input.background?.naturalHeight || WORLD_MIN_H;
  const world = scaleToMaxEdge(Math.max(bgW, WORLD_MIN_W), Math.max(bgH, WORLD_MIN_H), MAX_EDGE_PX);

  const canvas = document.createElement('canvas');
  canvas.width = world.width;
  canvas.height = world.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível montar a composição do ambiente');

  if (input.background) {
    ctx.fillStyle = '#1a100c';
    ctx.fillRect(0, 0, world.width, world.height);
    const img = await loadImageForRender(input.background.url);
    drawContainedImage(
      ctx,
      img,
      world.width,
      world.height,
      input.background.scale ?? 1,
      input.background.offsetX ?? 0.5,
      input.background.offsetY ?? 0.5,
      input.background.rotation ?? 0,
      Boolean(input.background.flipH),
      Boolean(input.background.flipV),
    );
  } else {
    drawWarmPlaceholder(ctx, world.width, world.height);
  }

  const overlays = [...input.overlays].sort((a, b) => a.zIndex - b.zIndex);
  for (const overlay of overlays) {
    try {
      const img = await loadImageForRender(overlay.url);
      const dx = overlay.x * world.width;
      const dy = overlay.y * world.height;
      const dw = Math.max(24, overlay.width * world.width);
      const dh = Math.max(24, overlay.height * world.height);
      ctx.save();
      ctx.translate(dx + dw / 2, dy + dh / 2);
      ctx.rotate((overlay.rotation * Math.PI) / 180);
      ctx.scale(overlay.flipH ? -1 : 1, overlay.flipV ? -1 : 1);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    } catch {
      // overlay inválido — segue a composição
    }
  }

  for (const shape of input.shapes ?? []) {
    paintGeoShape(ctx, shape, world.width, world.height);
  }

  let woodImg: HTMLImageElement | null = null;
  if (input.objects.some((item) => item.viewMode === 'realista')) {
    try {
      woodImg = await loadImageForRender(GARBO_WOOD_TEXTURE_URL);
    } catch {
      woodImg = null;
    }
  }

  for (const object of input.objects) {
    if (object.viewMode === 'realista') {
      try {
        const snap = await snapshotRealisticFurniture(object.moduleType, 360, {
          yaw: object.yaw ?? 0,
          pitch: object.pitch ?? 0,
        }, object.colorHex);
        const cx = object.x * world.width;
        const cy = object.y * world.height;
        const w = Math.max(40, object.width * world.width);
        const h = Math.max(48, object.height * world.height);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(((object.rotation ?? 0) * Math.PI) / 180);
        ctx.drawImage(snap, -w / 2, -h / 2, w, h);
        ctx.restore();
        continue;
      } catch {
        // cai no desenho técnico se o WebGL falhar
      }
    }
    drawFurniture(ctx, object, world.width, world.height, woodImg);
  }
  for (const marker of input.markers) {
    drawMarker(ctx, marker, world.width, world.height);
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
    width: world.width,
    height: world.height,
  };
}

const MAX_FURNITURE_REFS = 4;
const MAX_FURNITURE_REF_EDGE = 768;
const FURNITURE_REF_QUALITY = 0.82;

/** Recortes JPEG das fotos de móvel posicionadas na lousa — referência fiel para a IA. */
export async function exportAmbienteFurnitureReferences(
  overlays: AmbienteImageOverlay[],
  maxCount = MAX_FURNITURE_REFS,
): Promise<Array<{ label: string; dataUrl: string }>> {
  const result: Array<{ label: string; dataUrl: string }> = [];

  for (const overlay of overlays.slice(0, maxCount)) {
    try {
      const img = await loadImageForRender(overlay.url);
      const nw = img.naturalWidth || img.width || 1;
      const nh = img.naturalHeight || img.height || 1;
      const sized = scaleToMaxEdge(nw, nh, MAX_FURNITURE_REF_EDGE);
      const canvas = document.createElement('canvas');
      canvas.width = sized.width;
      canvas.height = sized.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sized.width, sized.height);
      ctx.drawImage(img, 0, 0, sized.width, sized.height);
      result.push({
        label: overlay.label || 'Móvel do projeto',
        dataUrl: canvas.toDataURL('image/jpeg', FURNITURE_REF_QUALITY),
      });
    } catch {
      // overlay inválido — a composição achatada ainda carrega a peça
    }
  }

  return result;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a foto'));
    reader.readAsDataURL(file);
  });
}

export async function fileToImagePreview(file: File): Promise<AmbienteBackground> {
  const url = await fileToDataUrl(file);
  const img = await loadImageForRender(url);
  return {
    url,
    label: file.name || 'Foto do ambiente',
    naturalWidth: img.naturalWidth || WORLD_MIN_W,
    naturalHeight: img.naturalHeight || WORLD_MIN_H,
    scale: 1,
    offsetX: 0.5,
    offsetY: 0.5,
    rotation: 0,
    flipH: false,
    flipV: false,
  };
}

function loadImageForDisplay(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem'));
    img.src = src;
  });
}

/** Preview imediato para a lousa — não depende de CORS/fetch. */
export function previewFromImageUrl(url: string, label: string): AmbienteBackground {
  return {
    url,
    label,
    naturalWidth: WORLD_MIN_W,
    naturalHeight: WORLD_MIN_H,
    scale: 1,
    offsetX: 0.5,
    offsetY: 0.5,
    rotation: 0,
    flipH: false,
    flipV: false,
  };
}

export async function urlToImagePreview(url: string, label: string): Promise<AmbienteBackground> {
  const fallback = previewFromImageUrl(url, label);
  try {
    const img = await loadImageForDisplay(url);
    return {
      ...fallback,
      naturalWidth: img.naturalWidth || WORLD_MIN_W,
      naturalHeight: img.naturalHeight || WORLD_MIN_H,
    };
  } catch {
    return fallback;
  }
}
