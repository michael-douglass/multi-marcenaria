/** Extensões comuns de vídeo aceitas na composição / apresentação. */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogg', '.ogv', '.avi', '.mkv'] as const;

const VIDEO_MIME_PREFIX = 'video/';

export function isVideoMimeType(mime: string | null | undefined): boolean {
  return !!mime && mime.toLowerCase().startsWith(VIDEO_MIME_PREFIX);
}

export function isVideoFileName(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().split('?')[0] ?? '';
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Detecta vídeo por mime, nome do arquivo ou URL (sem coluna extra no banco). */
export function isOrcamentoMidiaVideo(midia: {
  file_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  tipo_midia?: 'imagem' | 'video' | string | null;
}): boolean {
  if (midia.tipo_midia === 'video') return true;
  if (isVideoMimeType(midia.mime_type)) return true;
  if (isVideoFileName(midia.file_name)) return true;

  const url = midia.file_url ?? '';
  try {
    const path = new URL(url).pathname;
    return isVideoFileName(path);
  } catch {
    return isVideoFileName(url);
  }
}

export function isVideoFile(file: File): boolean {
  return isVideoMimeType(file.type) || isVideoFileName(file.name);
}

/** Aceite de input file para vídeos da composição. */
export const VIDEO_ACCEPT =
  'video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg,.mp4,.webm,.mov,.m4v,.ogg';
