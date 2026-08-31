import { loadImageForRender } from '@/lib/render-image-normalize';

export interface ImageStudioEdits {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  rotation: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  removeBg: boolean;
  bgTolerance: number;
}

export const DEFAULT_IMAGE_STUDIO_EDITS: ImageStudioEdits = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  removeBg: false,
  bgTolerance: 34,
};

const MAX_BAKE_EDGE_PX = 1600;

export function imageStudioHasEdits(edits: ImageStudioEdits): boolean {
  return (
    edits.brightness !== 100 ||
    edits.contrast !== 100 ||
    edits.saturation !== 100 ||
    edits.warmth !== 0 ||
    edits.rotation !== 0 ||
    edits.flipH ||
    edits.flipV ||
    edits.removeBg
  );
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

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Recorte de fundo claro: espalha a partir das bordas, típico de foto de móvel no ateliê. */
export function removeStudioBackground(imageData: ImageData, tolerance: number): boolean {
  const { data, width, height } = imageData;
  const maxDist = Math.max(8, Math.min(90, tolerance)) * 2.55;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height * 2);
  let qh = 0;
  let qt = 0;

  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };

  const corners = [sample(0, 0), sample(width - 1, 0), sample(0, height - 1), sample(width - 1, height - 1)];
  const ref = {
    r: Math.round(corners.reduce((s, c) => s + c.r, 0) / 4),
    g: Math.round(corners.reduce((s, c) => s + c.g, 0) / 4),
    b: Math.round(corners.reduce((s, c) => s + c.b, 0) / 4),
  };

  const enqueue = (x: number, y: number) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (colorDistance(data[i], data[i + 1], data[i + 2], ref.r, ref.g, ref.b) > maxDist) return;
    visited[idx] = 1;
    queue[qt++] = x;
    queue[qt++] = y;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (qh < qt) {
    const x = queue[qh++];
    const y = queue[qh++];
    const i = (y * width + x) * 4;
    data[i + 3] = 0;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }

  // Suaviza a borda do recorte para o móvel não ficar “recortado à tesoura”.
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const i = idx * 4;
      if (copy[i + 3] === 0) continue;
      let transparentNeighbors = 0;
      if (copy[((y - 1) * width + x) * 4 + 3] === 0) transparentNeighbors += 1;
      if (copy[((y + 1) * width + x) * 4 + 3] === 0) transparentNeighbors += 1;
      if (copy[(y * width + x - 1) * 4 + 3] === 0) transparentNeighbors += 1;
      if (copy[(y * width + x + 1) * 4 + 3] === 0) transparentNeighbors += 1;
      if (transparentNeighbors > 0) {
        data[i + 3] = Math.max(0, Math.round(copy[i + 3] * (1 - transparentNeighbors * 0.28)));
      }
    }
  }

  return qt > 8;
}

function applyColorGrade(imageData: ImageData, edits: ImageStudioEdits) {
  const brightness = edits.brightness / 100;
  const contrast = edits.contrast / 100;
  const saturation = edits.saturation / 100;
  const warmth = edits.warmth / 100;
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let b = data[i + 2] / 255;

    r *= brightness;
    g *= brightness;
    b *= brightness;

    r = (r - 0.5) * contrast + 0.5;
    g = (g - 0.5) * contrast + 0.5;
    b = (b - 0.5) * contrast + 0.5;

    const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
    r = luma + (r - luma) * saturation;
    g = luma + (g - luma) * saturation;
    b = luma + (b - luma) * saturation;

    r += warmth * 0.18;
    b -= warmth * 0.14;

    data[i] = Math.max(0, Math.min(255, Math.round(r * 255)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
  }
}

export async function bakeImageStudio(sourceUrl: string, edits: ImageStudioEdits): Promise<string> {
  if (!imageStudioHasEdits(edits)) return sourceUrl;

  const img = await loadImageForRender(sourceUrl);
  const srcW = Math.max(1, img.naturalWidth || img.width);
  const srcH = Math.max(1, img.naturalHeight || img.height);
  const swapped = edits.rotation === 90 || edits.rotation === 270;
  const sized = scaleToMaxEdge(swapped ? srcH : srcW, swapped ? srcW : srcH, MAX_BAKE_EDGE_PX);
  const outW = sized.width;
  const outH = sized.height;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Não foi possível preparar a edição da foto');

  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((edits.rotation * Math.PI) / 180);
  ctx.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1);
  const drawW = swapped ? outH : outW;
  const drawH = swapped ? outW : outH;
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  const imageData = ctx.getImageData(0, 0, outW, outH);
  if (edits.removeBg) removeStudioBackground(imageData, edits.bgTolerance);
  applyColorGrade(imageData, edits);
  ctx.putImageData(imageData, 0, 0);

  let hasAlpha = false;
  if (edits.removeBg) {
    const pixels = imageData.data;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 250) {
        hasAlpha = true;
        break;
      }
    }
  }

  return hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
}
