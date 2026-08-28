/** Limite legado do bucket antes da migration (2 MB) — usamos margem para compressão automática */
const SAFE_UPLOAD_BYTES = 1900000;

interface CompressBannerOptions {
  slot: 'desktop' | 'mobile';
  maxBytes?: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao comprimir imagem'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Redimensiona e comprime fotos de banner (celular costuma vir muito pesada).
 * Garante upload mesmo com limite antigo de 2 MB no storage.
 */
export async function compressBannerImageForUpload(
  file: File,
  { slot, maxBytes = SAFE_UPLOAD_BYTES }: CompressBannerOptions,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= maxBytes && file.type === 'image/jpeg') return file;

  const img = await loadImage(file);
  const maxW = slot === 'mobile' ? 1080 : 1920;
  const maxH = slot === 'mobile' ? 1920 : 1080;

  let { width, height } = img;
  const ratio = Math.min(maxW / width, maxH / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem');
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.88;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > maxBytes && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }

  if (blob.size > maxBytes) {
    throw new Error(
      'Imagem ainda muito grande após otimização. Tente uma foto com resolução menor.',
    );
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'banner';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
