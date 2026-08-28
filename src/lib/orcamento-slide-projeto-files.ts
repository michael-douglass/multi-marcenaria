import { getAttachmentTipo } from '@/lib/attachment-files';
import { dataUrlToFile } from '@/lib/contrato-anexo-upload';
import { PDF_PREVIEW_WIDTH_PX } from '@/lib/pdf-image-cache';
import {
  renderPdfFileToImages,
  renderPdfToImages,
  type PdfPageImage,
} from '@/lib/pdf-render';

export function isOrcamentoProjetoPdfFile(file: File): boolean {
  const tipo = getAttachmentTipo(file);
  return tipo === 'pdf' || file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** Converte páginas renderizadas (opcionalmente filtradas) em arquivos JPEG. */
export function pdfPageImagesToFiles(
  pages: PdfPageImage[],
  fileName: string,
  pageNumbers?: number[],
): File[] {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'documento';
  const selected = pageNumbers?.length ? new Set(pageNumbers) : null;
  const escolhidas = selected
    ? pages.filter((p) => selected.has(p.pageNumber))
    : pages;

  return escolhidas.map((page) =>
    dataUrlToFile(page.src, `${baseName}-pagina-${page.pageNumber}.jpg`),
  );
}

/** Renderiza PDF local para prévia (ainda sem upload). */
export async function renderOrcamentoProjetoPdfFile(
  file: File,
  targetWidthPx = PDF_PREVIEW_WIDTH_PX,
): Promise<PdfPageImage[]> {
  if (!isOrcamentoProjetoPdfFile(file)) {
    throw new Error('Arquivo não é PDF');
  }
  return renderPdfFileToImages(file, targetWidthPx);
}

/** Renderiza PDF remoto (anexo do lead) para prévia. */
export async function renderOrcamentoProjetoPdfUrl(
  fileUrl: string,
  targetWidthPx = PDF_PREVIEW_WIDTH_PX,
): Promise<PdfPageImage[]> {
  return renderPdfToImages(fileUrl, targetWidthPx);
}

export function isLeadMidiaPdf(midia: {
  file_name?: string | null;
  mime_type?: string | null;
  tipo?: string | null;
}): boolean {
  if (midia.tipo === 'pdf') return true;
  if (midia.mime_type === 'application/pdf') return true;
  return /\.pdf$/i.test(midia.file_name ?? '');
}
