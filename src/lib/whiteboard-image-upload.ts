/**
 * Prepara fotos da lousa para upload — especialmente no tablet/celular,
 * onde o arquivo muitas vezes vem sem MIME, em HEIC ou com resolução enorme.
 */

export const WHITEBOARD_MAX_IMAGE_BYTES = 15 * 1024 * 1024;
/** Limite confortável após compressão (tablets geram 8–20 MB com facilidade). */
const TARGET_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_EDGE_PX = 4096;

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;

export function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  // iOS/Android às vezes entregam type vazio ou application/octet-stream
  if (!file.type || file.type === 'application/octet-stream') {
    return IMAGE_EXT_RE.test(file.name) || !file.name.includes('.');
  }
  return false;
}

function mimeFromFileName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'image/jpeg';
}

function ensureJpegFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim() || 'foto-lousa';
  return `${base}.jpg`;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a foto'))),
      'image/jpeg',
      quality,
    );
  });
}

async function decodeImageFile(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* cai no fallback Image — comum em HEIC sem suporte */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível ler a imagem neste aparelho'));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getDecodedSize(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if ('naturalWidth' in source) {
    return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
  }
  return { width: source.width, height: source.height };
}

/**
 * Converte/redimensiona para JPEG confiável no Storage e na lousa.
 * No Safari/iPad, HEIC costuma decodificar e virar JPG; em outros navegadores
 * devolvemos o arquivo original com MIME corrigido quando possível.
 */
export async function prepareWhiteboardImageForUpload(file: File): Promise<File> {
  if (!isLikelyImageFile(file)) {
    throw new Error('Envie apenas imagens (foto, print, etc.)');
  }
  if (file.size > WHITEBOARD_MAX_IMAGE_BYTES * 2) {
    throw new Error('Imagem muito grande (máx. 15MB). Tente outra foto ou reduza a qualidade da câmera.');
  }

  const alreadyGoodJpeg =
    file.type === 'image/jpeg' && file.size <= TARGET_UPLOAD_BYTES && file.size > 0;

  if (alreadyGoodJpeg) return file;

  try {
    const source = await decodeImageFile(file);
    const { width: srcW, height: srcH } = getDecodedSize(source);
    if (srcW < 2 || srcH < 2) {
      throw new Error('Imagem inválida');
    }

    const scale = Math.min(1, MAX_EDGE_PX / Math.max(srcW, srcH));
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar a imagem');
    ctx.drawImage(source, 0, 0, width, height);
    if ('close' in source && typeof source.close === 'function') {
      source.close();
    }

    let quality = 0.9;
    let blob = await canvasToJpegBlob(canvas, quality);
    while (blob.size > TARGET_UPLOAD_BYTES && quality > 0.5) {
      quality -= 0.08;
      blob = await canvasToJpegBlob(canvas, quality);
    }

    if (blob.size > WHITEBOARD_MAX_IMAGE_BYTES) {
      throw new Error('Imagem ainda muito grande após otimização. Tire a foto com resolução menor.');
    }

    return new File([blob], ensureJpegFileName(file.name || 'foto-lousa.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (err) {
    // Sem decodificação (ex.: HEIC no Chrome Android da galeria): tenta enviar original.
    if (file.size > WHITEBOARD_MAX_IMAGE_BYTES) {
      throw err instanceof Error ? err : new Error('Imagem muito grande (máx. 15MB)');
    }

    const mime = file.type.startsWith('image/') ? file.type : mimeFromFileName(file.name || 'foto.jpg');
    if (mime === 'image/heic' || mime === 'image/heif') {
      throw new Error(
        'Este aparelho enviou a foto em HEIC. No tablet, escolha “Mais compatível”/JPG na câmera ou importe um JPG/PNG.',
      );
    }

    const safeName =
      file.name && file.name.includes('.')
        ? file.name
        : `foto-lousa.${mime === 'image/png' ? 'png' : 'jpg'}`;

    return new File([file], safeName, {
      type: mime === 'image/heic' ? 'image/jpeg' : mime || 'image/jpeg',
      lastModified: file.lastModified || Date.now(),
    });
  }
}

/** Folha em branco (JPEG branco) para desenhar sem anexar foto. */
export async function createBlankWhiteboardFile(
  width = 1280,
  height = 720,
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(320, Math.round(width));
  canvas.height = Math.max(240, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível criar o quadro branco');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const blob = await canvasToJpegBlob(canvas, 0.92);
  return new File([blob], 'quadro-branco.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export function loadImageDimensionsFromFile(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 800;
      const height = img.naturalHeight || 600;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback seguro para não bloquear o insert no banco
      resolve({ width: 800, height: 600 });
    };
    img.src = url;
  });
}
