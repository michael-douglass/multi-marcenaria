import { loadImageForRender } from '@/lib/render-image-normalize';

/** Ponto na foto (0–1), no mesmo espaço da imagem original — não da tela. */
export interface ImageStudioSeed {
  u: number;
  v: number;
}

export interface ImageStudioEdits {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  /** Giro livre em graus (0–360), sentido horário. */
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  removeBg: boolean;
  bgTolerance: number;
  /** Toques manuais em restos de fundo que o recorte automático não pegou. */
  bgSeeds: ImageStudioSeed[];
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
  bgTolerance: 38,
  bgSeeds: [],
};

const MAX_BAKE_EDGE_PX = 1600;
export const PREVIEW_CUTOUT_MAX_EDGE = 800;

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

export function normalizeStudioRotation(deg: number): number {
  return ((deg % 360) + 360) % 360;
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

/** Caixa alinhada à tela depois de girar um retângulo. */
export function rotatedBounds(width: number, height: number, deg: number) {
  const rad = (normalizeStudioRotation(deg) * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  return {
    width: Math.max(1, width * c + height * s),
    height: Math.max(1, width * s + height * c),
  };
}

/**
 * Escala o plano da foto para caber inteiro no quadro, já considerando o giro.
 * Sem isso, uma foto deitada virada de lado estoura o campo e parece cortada.
 */
export function containRotatedPlane(
  imageW: number,
  imageH: number,
  hostW: number,
  hostH: number,
  rotationDeg: number,
  padding = 0.96,
): { nw: number; nh: number } {
  const iw = Math.max(1, imageW);
  const ih = Math.max(1, imageH);
  const hw = Math.max(1, hostW);
  const hh = Math.max(1, hostH);
  const box = rotatedBounds(iw, ih, rotationDeg);
  const contain = Math.min(hw / box.width, hh / box.height) * padding;
  return {
    nw: (iw * contain) / hw,
    nh: (ih * contain) / hh,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

/** Distância que ignora um pouco a sombra e olha mais a “cor de parede”. */
function chromaDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const y1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
  const y2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
  const cb1 = 128 - 0.168736 * r1 - 0.331264 * g1 + 0.5 * b1;
  const cb2 = 128 - 0.168736 * r2 - 0.331264 * g2 + 0.5 * b2;
  const cr1 = 128 + 0.5 * r1 - 0.418688 * g1 - 0.081312 * b1;
  const cr2 = 128 + 0.5 * r2 - 0.418688 * g2 - 0.081312 * b2;
  const dy = (y1 - y2) * 0.4;
  const dcb = cb1 - cb2;
  const dcr = cr1 - cr2;
  return Math.sqrt(dy * dy + dcb * dcb + dcr * dcr);
}

interface BgRef {
  r: number;
  g: number;
  b: number;
}

function sampleMedian(data: Uint8ClampedArray, width: number, coords: Array<[number, number]>): BgRef {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (const [x, y] of coords) {
    const i = (y * width + x) * 4;
    rs.push(data[i]!);
    gs.push(data[i + 1]!);
    bs.push(data[i + 2]!);
  }
  return { r: median(rs), g: median(gs), b: median(bs) };
}

function collectEdgeCoords(width: number, height: number): {
  all: Array<[number, number]>;
  top: Array<[number, number]>;
  bottom: Array<[number, number]>;
  left: Array<[number, number]>;
  right: Array<[number, number]>;
} {
  const step = Math.max(1, Math.floor(Math.min(width, height) / 72));
  const top: Array<[number, number]> = [];
  const bottom: Array<[number, number]> = [];
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (let x = 0; x < width; x += step) {
    top.push([x, 0]);
    bottom.push([x, height - 1]);
  }
  for (let y = 0; y < height; y += step) {
    left.push([0, y]);
    right.push([width - 1, y]);
  }
  return { all: [...top, ...bottom, ...left, ...right], top, bottom, left, right };
}

function minDistToRefs(r: number, g: number, b: number, refs: BgRef[]): number {
  let best = Infinity;
  for (const ref of refs) {
    const d = chromaDist(r, g, b, ref.r, ref.g, ref.b);
    if (d < best) best = d;
  }
  return best;
}

function seedToPixel(seed: ImageStudioSeed, width: number, height: number): { x: number; y: number } {
  const u = Math.min(1, Math.max(0, seed.u));
  const v = Math.min(1, Math.max(0, seed.v));
  // flipY do Three.js: v=1 é o topo da foto; no canvas, y=0 é o topo.
  const x = Math.min(width - 1, Math.max(0, Math.round(u * (width - 1))));
  const y = Math.min(height - 1, Math.max(0, Math.round((1 - v) * (height - 1))));
  return { x, y };
}

/**
 * Recorta o fundo típico de foto de móvel no ateliê:
 * espalha a partir das bordas, segue degradê da parede, come restos colados
 * no recorte e aceita toques manuais em ilhas que sobraram no meio.
 */
export function removeStudioBackground(
  imageData: ImageData,
  tolerance: number,
  seeds: ImageStudioSeed[] = [],
): boolean {
  const { data, width, height } = imageData;
  const pixelCount = width * height;
  const T = 9 + Math.max(8, Math.min(90, tolerance)) * 0.95;
  const TParent = T * 0.55;
  const TGlobalCap = T * 1.12;
  const TLeak = T * 1.08;

  const edge = collectEdgeCoords(width, height);
  const refs: BgRef[] = [
    sampleMedian(data, width, edge.all),
    sampleMedian(data, width, edge.top),
    sampleMedian(data, width, edge.bottom),
    sampleMedian(data, width, edge.left),
    sampleMedian(data, width, edge.right),
  ];

  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount * 2);
  let qh = 0;
  let qt = 0;

  const matchesBg = (
    i: number,
    parentI: number,
    maxBg: number,
    maxParent: number,
    allowChain: boolean,
    extraRefs: BgRef[] | null,
  ) => {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const pool = extraRefs ?? refs;
    const dBg = minDistToRefs(r, g, b, pool);
    if (dBg <= maxBg) return true;
    if (allowChain && parentI >= 0) {
      const dParent = chromaDist(r, g, b, data[parentI]!, data[parentI + 1]!, data[parentI + 2]!);
      if (dParent <= maxParent && dBg <= TGlobalCap) return true;
    }
    return false;
  };

  const enqueue = (
    x: number,
    y: number,
    parentI: number,
    maxBg: number,
    maxParent: number,
    allowChain: boolean,
    extraRefs: BgRef[] | null = null,
  ) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (data[i + 3]! === 0) {
      visited[idx] = 1;
      return;
    }
    if (!matchesBg(i, parentI, maxBg, maxParent, allowChain, extraRefs)) return;
    visited[idx] = 1;
    queue[qt++] = x;
    queue[qt++] = y;
  };

  const flood = (
    maxBg: number,
    maxParent: number,
    allowChain: boolean,
    extraRefs: BgRef[] | null = null,
  ) => {
    while (qh < qt) {
      const x = queue[qh++]!;
      const y = queue[qh++]!;
      const i = (y * width + x) * 4;
      data[i + 3] = 0;
      enqueue(x - 1, y, i, maxBg, maxParent, allowChain, extraRefs);
      enqueue(x + 1, y, i, maxBg, maxParent, allowChain, extraRefs);
      enqueue(x, y - 1, i, maxBg, maxParent, allowChain, extraRefs);
      enqueue(x, y + 1, i, maxBg, maxParent, allowChain, extraRefs);
    }
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0, -1, T, TParent, true);
    enqueue(x, height - 1, -1, T, TParent, true);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y, -1, T, TParent, true);
    enqueue(width - 1, y, -1, T, TParent, true);
  }
  flood(T, TParent, true);

  // Toques manuais: começa uma nova “poça” exatamente onde a pessoa apontou.
  const seedT = T * 1.22;
  const seedParent = T * 0.7;
  qh = qt = 0;
  for (const seed of seeds) {
    const { x, y } = seedToPixel(seed, width, height);
    const si = (y * width + x) * 4;
    const seedRef: BgRef[] = [{ r: data[si]!, g: data[si + 1]!, b: data[si + 2]! }, ...refs];
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const sx = x + dx;
        const sy = y + dy;
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
        const idx = sy * width + sx;
        visited[idx] = 0;
        enqueue(sx, sy, -1, seedT, seedParent, true, seedRef);
      }
    }
    flood(seedT, seedParent, true, seedRef);
    qh = qt = 0;
  }

  // Restos colados na área já apagada — só morde o pixel da borda, sem invadir o móvel.
  const leakFromTransparent = (passes: number, limit: number) => {
    for (let pass = 0; pass < passes; pass += 1) {
      qh = qt = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = y * width + x;
          const i = idx * 4;
          if (data[i + 3]! === 0) continue;
          const n =
            (x > 0 && data[i - 1]! === 0 ? 1 : 0) +
            (x + 1 < width && data[i + 7]! === 0 ? 1 : 0) +
            (y > 0 && data[i - width * 4 + 3]! === 0 ? 1 : 0) +
            (y + 1 < height && data[i + width * 4 + 3]! === 0 ? 1 : 0);
          if (n === 0) continue;
          if (minDistToRefs(data[i]!, data[i + 1]!, data[i + 2]!, refs) > limit) continue;
          visited[idx] = 0;
          enqueue(x, y, -1, limit, TParent, false);
        }
      }
      flood(limit, TParent, false);
    }
  };
  leakFromTransparent(2, TLeak);

  // Pontinhos soltos da mesma cor da parede.
  const speckLimit = Math.max(18, Math.round(pixelCount * 0.0014));
  const speckVisited = new Uint8Array(pixelCount);
  const stack = new Int32Array(pixelCount);
  for (let start = 0; start < pixelCount; start += 1) {
    if (speckVisited[start] || data[start * 4 + 3]! === 0) continue;
    let sp = 0;
    stack[sp++] = start;
    speckVisited[start] = 1;
    const blob: number[] = [];
    let bgLike = 0;
    while (sp > 0) {
      const idx = stack[--sp]!;
      blob.push(idx);
      const i = idx * 4;
      if (minDistToRefs(data[i]!, data[i + 1]!, data[i + 2]!, refs) <= TLeak) bgLike += 1;
      const x = idx % width;
      const y = (idx / width) | 0;
      const tryN = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
        const nidx = ny * width + nx;
        if (speckVisited[nidx] || data[nidx * 4 + 3]! === 0) return;
        speckVisited[nidx] = 1;
        stack[sp++] = nidx;
      };
      tryN(x - 1, y);
      tryN(x + 1, y);
      tryN(x, y - 1);
      tryN(x, y + 1);
    }
    if (blob.length <= speckLimit && bgLike / blob.length >= 0.72) {
      for (const idx of blob) data[idx * 4 + 3] = 0;
    }
  }

  // Borda macia + tira o “halo” da parede no móvel.
  const alphaCopy = new Uint8ClampedArray(data);
  for (let pass = 0; pass < 2; pass += 1) {
    const src = pass === 0 ? alphaCopy : data;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4;
        const a = src[i + 3]!;
        if (a === 0) continue;
        const n0 = src[((y - 1) * width + x) * 4 + 3]!;
        const n1 = src[((y + 1) * width + x) * 4 + 3]!;
        const n2 = src[(y * width + x - 1) * 4 + 3]!;
        const n3 = src[(y * width + x + 1) * 4 + 3]!;
        const minN = Math.min(n0, n1, n2, n3);
        data[i + 3] = Math.round(a * 0.62 + minN * 0.38);
      }
    }
  }

  const primary = refs[0]!;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a === 0 || a >= 248) continue;
    const t = 1 - a / 255;
    data[i] = Math.max(0, Math.min(255, Math.round(data[i]! + (data[i]! - primary.r) * t * 0.4)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1]! + (data[i + 1]! - primary.g) * t * 0.4)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2]! + (data[i + 2]! - primary.b) * t * 0.4)));
  }

  return true;
}

export function getCanvasSourceSize(source: CanvasImageSource): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return {
      width: Math.max(1, source.naturalWidth || source.width),
      height: Math.max(1, source.naturalHeight || source.height),
    };
  }
  if (source instanceof HTMLVideoElement) {
    return { width: Math.max(1, source.videoWidth || 1), height: Math.max(1, source.videoHeight || 1) };
  }
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return { width: Math.max(1, source.width), height: Math.max(1, source.height) };
  }
  if ('width' in source && 'height' in source) {
    return {
      width: Math.max(1, Number(source.width) || 1),
      height: Math.max(1, Number(source.height) || 1),
    };
  }
  return { width: 1, height: 1 };
}

export function computeStudioAlphaMask(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  tolerance: number,
  seeds: ImageStudioSeed[],
  maxEdge: number = PREVIEW_CUTOUT_MAX_EDGE,
): { width: number; height: number; rgba: Uint8Array } {
  const sized = scaleToMaxEdge(srcW, srcH, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = sized.width;
  canvas.height = sized.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { width: 1, height: 1, rgba: new Uint8Array([255, 255, 255, 255]) };
  }
  ctx.drawImage(source, 0, 0, sized.width, sized.height);
  const imageData = ctx.getImageData(0, 0, sized.width, sized.height);
  removeStudioBackground(imageData, tolerance, seeds);
  const rgba = new Uint8Array(sized.width * sized.height * 4);
  const src = imageData.data;
  for (let i = 0, p = 0; i < src.length; i += 4, p += 4) {
    const a = src[i + 3]!;
    rgba[p] = a;
    rgba[p + 1] = a;
    rgba[p + 2] = a;
    rgba[p + 3] = 255;
  }
  return { width: sized.width, height: sized.height, rgba };
}

function applyColorGrade(imageData: ImageData, edits: ImageStudioEdits) {
  const brightness = edits.brightness / 100;
  const contrast = edits.contrast / 100;
  const saturation = edits.saturation / 100;
  const warmth = edits.warmth / 100;
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    let r = data[i]! / 255;
    let g = data[i + 1]! / 255;
    let b = data[i + 2]! / 255;

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
  const workSize = scaleToMaxEdge(srcW, srcH, MAX_BAKE_EDGE_PX);

  const work = document.createElement('canvas');
  work.width = workSize.width;
  work.height = workSize.height;
  const workCtx = work.getContext('2d', { willReadFrequently: true });
  if (!workCtx) throw new Error('Não foi possível preparar a edição da foto');
  workCtx.drawImage(img, 0, 0, work.width, work.height);

  if (edits.removeBg) {
    const cut = workCtx.getImageData(0, 0, work.width, work.height);
    removeStudioBackground(cut, edits.bgTolerance, edits.bgSeeds);
    workCtx.putImageData(cut, 0, 0);
  }

  const rotation = normalizeStudioRotation(edits.rotation);
  const aabb = rotatedBounds(work.width, work.height, rotation);
  const sized = scaleToMaxEdge(aabb.width, aabb.height, MAX_BAKE_EDGE_PX);
  const outW = sized.width;
  const outH = sized.height;
  const fit = outW / aabb.width;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Não foi possível preparar a edição da foto');

  ctx.clearRect(0, 0, outW, outH);
  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1);
  ctx.drawImage(work, (-work.width * fit) / 2, (-work.height * fit) / 2, work.width * fit, work.height * fit);
  ctx.restore();

  const imageData = ctx.getImageData(0, 0, outW, outH);
  applyColorGrade(imageData, edits);
  ctx.putImageData(imageData, 0, 0);

  const cardinalTurn = Math.abs(Math.round(rotation / 90) * 90 - rotation) < 0.51;
  let hasAlpha = !cardinalTurn;
  if (edits.removeBg || hasAlpha) {
    const pixels = imageData.data;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i]! < 250) {
        hasAlpha = true;
        break;
      }
    }
  }

  return hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
}
