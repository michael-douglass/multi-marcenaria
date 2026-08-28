import { compressBannerImageForUpload } from '@/lib/compress-banner-image';

/** Logo no menu lateral */
export const MAX_EMPRESA_LOGO_BYTES = 2 * 1024 * 1024;

/** Banners / slides do portal do prestador (imagens em alta resolução) */
export const MAX_EMPRESA_BANNER_BYTES = 20 * 1024 * 1024;

const BANNER_COMPRESS_THRESHOLD = 1.5 * 1024 * 1024;

export function formatMaxMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function validateEmpresaBannerFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Selecione uma imagem válida (PNG, JPG ou WebP).';
  }
  if (file.size > MAX_EMPRESA_BANNER_BYTES) {
    return `Imagem muito grande. Máximo: ${formatMaxMb(MAX_EMPRESA_BANNER_BYTES)}.`;
  }
  return null;
}

/** Reduz fotos pesadas (comum no celular) antes do upload ao storage */
export async function prepareBannerFileForUpload(
  file: File,
  slot: 'desktop' | 'mobile',
): Promise<File> {
  const shouldCompress =
    file.size > BANNER_COMPRESS_THRESHOLD || (slot === 'mobile' && file.size > 600 * 1024);

  if (!shouldCompress) return file;

  return compressBannerImageForUpload(file, {
    slot,
    maxBytes: MAX_EMPRESA_BANNER_BYTES - 512 * 1024,
  });
}

export function mapBannerUploadError(message: string): string {
  if (/maximum allowed size|exceeded.*size|entity too large/i.test(message)) {
    return 'Arquivo grande demais. A imagem será otimizada automaticamente — tente enviar de novo.';
  }
  return message;
}
