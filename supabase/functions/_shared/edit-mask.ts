import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import type { EditPonto } from './render-prompts.ts';

const REGION_RADIUS_RATIO = 0.09;

export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    return null;
  }
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  if (!width || !height || width > 8192 || height > 8192) return null;
  return { width, height };
}

export async function readImageDimensions(
  bytes: Uint8Array,
): Promise<{ width: number; height: number } | null> {
  const pngDim = readPngDimensions(bytes);
  if (pngDim) return pngDim;

  try {
    const img = await Image.decode(bytes);
    if (!img.width || !img.height || img.width > 8192 || img.height > 8192) return null;
    return { width: img.width, height: img.height };
  } catch {
    return null;
  }
}

/** Máscara PNG: opaco = preservar; transparente = região editável (API OpenAI). */
export async function buildEditMaskFromPontos(
  width: number,
  height: number,
  pontos: EditPonto[],
): Promise<Uint8Array> {
  const img = new Image(width, height);
  img.fill(0xffffffff);

  const radius = Math.max(24, Math.round(Math.min(width, height) * REGION_RADIUS_RATIO));
  const radiusSq = radius * radius;

  for (const p of pontos) {
    const cx = Math.round(p.x * width);
    const cy = Math.round(p.y * height);
    const yMin = Math.max(0, cy - radius);
    const yMax = Math.min(height - 1, cy + radius);
    const xMin = Math.max(0, cx - radius);
    const xMax = Math.min(width - 1, cx + radius);

    for (let y = yMin; y <= yMax; y++) {
      const dy = y - cy;
      for (let x = xMin; x <= xMax; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy <= radiusSq) {
          img.setPixelAt(x + 1, y + 1, 0x00000000);
        }
      }
    }
  }

  return await img.encode();
}

export function maskMatchesImage(
  imageBytes: Uint8Array,
  maskBytes: Uint8Array,
): boolean {
  const imageDim = readPngDimensions(imageBytes);
  const maskDim = readPngDimensions(maskBytes);
  if (!imageDim || !maskDim) return false;
  return imageDim.width === maskDim.width && imageDim.height === maskDim.height;
}
