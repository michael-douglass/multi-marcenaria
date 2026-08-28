import { getAttachmentTipo } from '@/lib/attachment-files';
import { renderPdfFileToImages, renderPdfFileToThumbnail } from '@/lib/pdf-render';
import { PDF_PREVIEW_WIDTH_PX } from '@/lib/pdf-image-cache';

export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

/** Converte cada página do PDF em arquivo JPEG para upload como foto. */
export async function pdfFileToImageFiles(
  file: File,
  targetWidthPx = PDF_PREVIEW_WIDTH_PX,
): Promise<File[]> {
  const pages = await renderPdfFileToImages(file, targetWidthPx);
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'documento';
  return pages.map((page) =>
    dataUrlToFile(page.src, `${baseName}-pagina-${page.pageNumber}.jpg`),
  );
}

/** Lista de arquivos prontos para envio (PDF vira uma foto por página). */
export async function resolveContratoUploadFiles(file: File): Promise<File[]> {
  const tipo = getAttachmentTipo(file);
  if (tipo === 'pdf') {
    return pdfFileToImageFiles(file);
  }
  return [file];
}

/** Miniatura JPEG (data URL) para prévia de PDF pendente. */
export async function pdfFileToPreviewDataUrl(file: File): Promise<string> {
  return renderPdfFileToThumbnail(file, 360);
}
