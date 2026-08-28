export type AttachmentTipo = 'pdf' | 'imagem' | 'documento';

export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;

const DOCUMENTO_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/plain',
]);

export function getAttachmentTipo(file: File): AttachmentTipo | null {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'imagem';
  if (DOCUMENTO_MIME_TYPES.has(file.type)) return 'documento';
  return null;
}

export function validateAttachmentFile(file: File): string | null {
  const tipo = getAttachmentTipo(file);
  if (!tipo) {
    return 'Formatos permitidos: PDF, imagens (JPG, PNG, WebP, GIF) e documentos (Word, Excel, TXT)';
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return 'Arquivo muito grande (máx. 50MB)';
  }
  return null;
}

export function attachmentFileExtension(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : null;
  if (fromName) return fromName.toLowerCase();
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  if (file.type === 'text/plain') return 'txt';
  if (file.type.includes('wordprocessingml')) return 'docx';
  if (file.type.includes('spreadsheetml')) return 'xlsx';
  return 'bin';
}

export function isPdfAttachment(item: {
  tipo?: AttachmentTipo;
  mime_type?: string | null;
  file?: File;
}): boolean {
  if (item.tipo === 'imagem' || item.tipo === 'documento') return false;
  if (item.tipo === 'pdf') return true;
  if (item.mime_type?.startsWith('image/')) return false;
  if (item.file) return item.file.type === 'application/pdf';
  return item.mime_type === 'application/pdf';
}

export function isImageAttachment(item: {
  tipo?: AttachmentTipo;
  mime_type?: string | null;
  file?: File;
}): boolean {
  if (item.tipo === 'imagem') return true;
  if (item.mime_type?.startsWith('image/')) return true;
  if (item.file) return item.file.type.startsWith('image/');
  return false;
}

export function extractStoragePathFromPublicUrl(
  fileUrl: string,
  bucket: string,
): string | null {
  try {
    const url = new URL(fileUrl);
    const match = url.pathname.match(
      new RegExp(`/storage/v1/object/public/${bucket}/(.+)`),
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export const CONTRATOS_ANEXOS_BUCKET = 'contratos-anexos';
