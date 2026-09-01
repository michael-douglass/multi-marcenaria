import { snapshotRealisticFurniture } from '@/lib/lead-ai-ambiente-realistic-mesh';
import { furnitureFrame, getFurnitureModuleMeta } from '@/lib/furniture-modules';
import { GARBO_WOOD_TEXTURE_URL, furnitureViewIsFlat } from '@/lib/furniture-catalog-banks';
import { paintGeoShape } from '@/lib/lead-ai-ambiente-draw';
import { containRotatedPlane } from '@/lib/lead-image-studio';
import { loadImageForRender } from '@/lib/render-image-normalize';
import { containedRectInBox, isUsableAmbienteViewport } from '@/lib/lead-ai-ambiente-zoom';
import type {
  AmbienteBackground,
  AmbienteFurnitureObject,
  AmbienteGeoShape,
  AmbienteImageOverlay,
  AmbienteLabelMarker,
} from '@/lib/lead-ai-ambiente-types';

const MAX_EDGE_PX = 1536;
const MAX_CANVAS_PX = 4096;
const JPEG_QUALITY = 0.92;
const WORLD_MIN_W = 960;
const WORLD_MIN_H = 640;

export interface AmbienteExportViewport {
  width: number;
  height: number;
}

export interface AmbienteExportInput {
  background: AmbienteBackground | null;
  overlays: AmbienteImageOverlay[];
  objects: AmbienteFurnitureObject[];
  markers: AmbienteLabelMarker[];
  shapes?: AmbienteGeoShape[];
  /** Tamanho da lousa na tela — sem isso a foto encaixa errado na hora de enviar. */
  viewport?: AmbienteExportViewport;
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

function applyPhotoOrbit(
  ctx: CanvasRenderingContext2D,
  rotation: number,
  yaw = 0,
  pitch = 0,
  flipH = false,
  flipV = false,
) {
  ctx.rotate((rotation * Math.PI) / 180);
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const sx = Math.max(0.12, Math.abs(Math.cos(yawRad))) * (Math.cos(yawRad) < 0 ? -1 : 1) * (flipH ? -1 : 1);
  const sy = Math.max(0.16, Math.abs(Math.cos(pitchRad))) * (Math.cos(pitchRad) < 0 ? -1 : 1) * (flipV ? -1 : 1);
  ctx.transform(sx, Math.sin(pitchRad) * 0.16, Math.sin(yawRad) * 0.22, sy, 0, 0);
}

function backgroundElementSize(
  worldW: number,
  worldH: number,
  fit: { nw: number; nh: number },
) {
  return {
    elemW: fit.nw * worldW,
    elemH: fit.nh * worldH,
  };
}

/** Mesmo giro/zoom/pan da foto de fundo na lousa. */
function mapBackgroundLocalPoint(
  localX: number,
  localY: number,
  worldW: number,
  worldH: number,
  elemW: number,
  elemH: number,
  bg: AmbienteBackground,
): { x: number; y: number } {
  const zoom = Math.max(0.05, bg.scale ?? 1);
  const sx = (bg.flipH ? -1 : 1) * zoom;
  const sy = (bg.flipV ? -1 : 1) * zoom;
  const px = localX * sx;
  const py = localY * sy;
  const rad = ((bg.rotation ?? 0) * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const panX = ((bg.offsetX ?? 0.5) - 0.5) * 0.4 * elemW;
  const panY = ((bg.offsetY ?? 0.5) - 0.5) * 0.4 * elemH;
  return {
    x: worldW / 2 + panX + (px * c - py * s),
    y: worldH / 2 + panY + (px * s + py * c),
  };
}

function backgroundVisualBounds(
  worldW: number,
  worldH: number,
  fit: { nw: number; nh: number },
  bg: AmbienteBackground,
): { x: number; y: number; w: number; h: number } {
  const { elemW, elemH } = backgroundElementSize(worldW, worldH, fit);
  const corners = [
    mapBackgroundLocalPoint(-elemW / 2, -elemH / 2, worldW, worldH, elemW, elemH, bg),
    mapBackgroundLocalPoint(elemW / 2, -elemH / 2, worldW, worldH, elemW, elemH, bg),
    mapBackgroundLocalPoint(elemW / 2, elemH / 2, worldW, worldH, elemW, elemH, bg),
    mapBackgroundLocalPoint(-elemW / 2, elemH / 2, worldW, worldH, elemW, elemH, bg),
  ];
  const minX = Math.min(...corners.map((p) => p.x));
  const maxX = Math.max(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y));
  const maxY = Math.max(...corners.map((p) => p.y));
  const x = Math.max(0, Math.floor(minX));
  const y = Math.max(0, Math.floor(minY));
  const w = Math.max(1, Math.min(worldW - x, Math.ceil(maxX) - x));
  const h = Math.max(1, Math.min(worldH - y, Math.ceil(maxY) - y));
  return { x, y, w, h };
}

function drawBackgroundLikeBoard(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  worldW: number,
  worldH: number,
  fit: { nw: number; nh: number },
  bg: AmbienteBackground,
) {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (nw <= 0 || nh <= 0) return;
  const { elemW, elemH } = backgroundElementSize(worldW, worldH, fit);
  const zoom = Math.max(0.05, bg.scale ?? 1);
  ctx.save();
  ctx.translate(worldW / 2, worldH / 2);
  ctx.translate(((bg.offsetX ?? 0.5) - 0.5) * 0.4 * elemW, ((bg.offsetY ?? 0.5) - 0.5) * 0.4 * elemH);
  ctx.rotate(((bg.rotation ?? 0) * Math.PI) / 180);
  ctx.scale(bg.flipH ? -1 : 1, bg.flipV ? -1 : 1);
  ctx.scale(zoom, zoom);
  ctx.drawImage(img, -elemW / 2, -elemH / 2, elemW, elemH);
  ctx.restore();
}

function drawOverlayLikeBoard(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  overlay: AmbienteImageOverlay,
  worldW: number,
  worldH: number,
) {
  const boxW = Math.max(24, overlay.width * worldW);
  const boxH = Math.max(24, overlay.height * worldH);
  const srcW = img.naturalWidth || img.width || 1;
  const srcH = img.naturalHeight || img.height || 1;
  const contained = containedRectInBox(boxW, boxH, srcW, srcH);
  ctx.save();
  ctx.translate(overlay.x * worldW + boxW / 2, overlay.y * worldH + boxH / 2);
  applyPhotoOrbit(
    ctx,
    overlay.rotation,
    overlay.yaw ?? 0,
    overlay.pitch ?? 0,
    Boolean(overlay.flipH),
    Boolean(overlay.flipV),
  );
  ctx.drawImage(
    img,
    -contained.dw / 2,
    -contained.dh / 2,
    contained.dw,
    contained.dh,
  );
  ctx.restore();
}

function cropCanvas(
  source: HTMLCanvasElement,
  crop: { x: number; y: number; w: number; h: number },
): HTMLCanvasElement {
  const w = Math.max(1, Math.min(source.width - crop.x, crop.w));
  const h = Math.max(1, Math.min(source.height - crop.y, crop.h));
  if (crop.x <= 0 && crop.y <= 0 && w >= source.width && h >= source.height) {
    return source;
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { colorSpace: 'srgb', alpha: false });
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, crop.x, crop.y, w, h, 0, 0, w, h);
  return out;
}

function canvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx =
    canvas.getContext('2d', { colorSpace: 'srgb', alpha: true }) ?? canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível montar a composição do ambiente');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
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

/** Achata a montagem do ambiente exatamente como o vendedor vê na lousa. */
export async function exportAmbienteCompositionToJpeg(
  input: AmbienteExportInput,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const viewport = input.viewport;
  const hasViewport = Boolean(
    viewport && isUsableAmbienteViewport(viewport.width, viewport.height),
  );
  const bgFit =
    input.background && hasViewport && viewport
      ? containRotatedPlane(
          input.background.naturalWidth || 1,
          input.background.naturalHeight || 1,
          viewport.width,
          viewport.height,
          input.background.rotation ?? 0,
        )
      : input.background
        ? { nw: 1, nh: 1 }
        : null;

  let worldW: number;
  let worldH: number;
  let crop: { x: number; y: number; w: number; h: number } | null = null;

  if (input.background && hasViewport && viewport && bgFit) {
    const photoW = Math.max(1, bgFit.nw * viewport.width);
    const photoH = Math.max(1, bgFit.nh * viewport.height);
    const kPhoto = MAX_EDGE_PX / Math.max(photoW, photoH);
    const kCanvas = MAX_CANVAS_PX / Math.max(viewport.width, viewport.height);
    const k = Math.min(kPhoto, kCanvas, 4);
    worldW = Math.max(1, Math.round(viewport.width * k));
    worldH = Math.max(1, Math.round(viewport.height * k));
    crop = backgroundVisualBounds(worldW, worldH, bgFit, input.background);
  } else if (input.background) {
    const sized = scaleToMaxEdge(
      input.background.naturalWidth || WORLD_MIN_W,
      input.background.naturalHeight || WORLD_MIN_H,
      MAX_EDGE_PX,
    );
    worldW = sized.width;
    worldH = sized.height;
  } else if (hasViewport && viewport) {
    const sized = scaleToMaxEdge(viewport.width, viewport.height, MAX_EDGE_PX);
    worldW = sized.width;
    worldH = sized.height;
  } else {
    const sized = scaleToMaxEdge(WORLD_MIN_W, WORLD_MIN_H, MAX_EDGE_PX);
    worldW = sized.width;
    worldH = sized.height;
  }

  const canvas = document.createElement('canvas');
  canvas.width = worldW;
  canvas.height = worldH;
  const ctx = canvasContext(canvas);

  if (input.background) {
    ctx.fillStyle = '#1a100c';
    ctx.fillRect(0, 0, worldW, worldH);
    const img = await loadImageForRender(input.background.url);
    if (bgFit) {
      drawBackgroundLikeBoard(ctx, img, worldW, worldH, bgFit, input.background);
    }
  } else {
    drawWarmPlaceholder(ctx, worldW, worldH);
  }

  const overlays = [...input.overlays].sort((a, b) => a.zIndex - b.zIndex);
  for (const overlay of overlays) {
    try {
      const img = await loadImageForRender(overlay.url);
      drawOverlayLikeBoard(ctx, img, overlay, worldW, worldH);
    } catch {
      // overlay inválido — segue a composição
    }
  }

  for (const shape of input.shapes ?? []) {
    paintGeoShape(ctx, shape, worldW, worldH);
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
        const cx = object.x * worldW;
        const cy = object.y * worldH;
        const w = Math.max(40, object.width * worldW);
        const h = Math.max(48, object.height * worldH);
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
    drawFurniture(ctx, object, worldW, worldH, woodImg);
  }
  for (const marker of input.markers) {
    drawMarker(ctx, marker, worldW, worldH);
  }

  const flattened = crop ? cropCanvas(canvas, crop) : canvas;
  return {
    dataUrl: flattened.toDataURL('image/jpeg', JPEG_QUALITY),
    width: flattened.width,
    height: flattened.height,
  };
}

const MAX_FURNITURE_REFS = 4;
const MAX_FURNITURE_REF_EDGE = 768;
const FURNITURE_REF_QUALITY = 0.82;

/** Recortes das fotos de móvel posicionadas na lousa — já com giro, espelho e retoque. */
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
      const rotation = overlay.rotation || 0;
      const rad = (rotation * Math.PI) / 180;
      const boundsW = Math.abs(nw * Math.cos(rad)) + Math.abs(nh * Math.sin(rad));
      const boundsH = Math.abs(nw * Math.sin(rad)) + Math.abs(nh * Math.cos(rad));
      const sized = scaleToMaxEdge(Math.max(1, boundsW), Math.max(1, boundsH), MAX_FURNITURE_REF_EDGE);
      const canvas = document.createElement('canvas');
      canvas.width = sized.width;
      canvas.height = sized.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.clearRect(0, 0, sized.width, sized.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.save();
      ctx.translate(sized.width / 2, sized.height / 2);
      applyPhotoOrbit(
        ctx,
        overlay.rotation || 0,
        overlay.yaw ?? 0,
        overlay.pitch ?? 0,
        Boolean(overlay.flipH),
        Boolean(overlay.flipV),
      );
      const fit = Math.min(sized.width / Math.max(1, boundsW), sized.height / Math.max(1, boundsH));
      ctx.drawImage(img, (-nw * fit) / 2, (-nh * fit) / 2, nw * fit, nh * fit);
      ctx.restore();

      const pixels = ctx.getImageData(0, 0, sized.width, sized.height).data;
      let hasAlpha = false;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i]! < 250) {
          hasAlpha = true;
          break;
        }
      }
      result.push({
        label: overlay.label || 'Móvel do projeto',
        dataUrl: hasAlpha
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', FURNITURE_REF_QUALITY),
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
