import { installPdfJsPolyfills } from '@/lib/map-polyfills';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs';

installPdfJsPolyfills();

declare global {
  // eslint-disable-next-line no-var
  var pdfjsWorker: typeof import('pdfjs-dist/build/pdf.worker.min.mjs') | undefined;
}

/**
 * Mesmo “fake worker” do `pdf-to-image` (main thread).
 * O `?worker` + workerPort conflita com countPdfPages / pipeline e trava
 * a grade “Gerando prévia…” para sempre no Vite/dev.
 */
function ensurePdfWorker(): void {
  if (!globalThis.pdfjsWorker) {
    globalThis.pdfjsWorker = pdfjsWorker;
  }
  GlobalWorkerOptions.workerPort = null;
}

export interface PdfPageImage {
  pageNumber: number;
  src: string;
  width: number;
  height: number;
}

const JPEG_QUALITY = 0.88;
const PAGE_RENDER_CONCURRENCY = 3;
/** Recorte do topo da 1ª página na miniatura (cabeçalho/logo institucional). */
export const PDF_THUMBNAIL_TOP_CROP_RATIO = 0.22;

async function loadPdfFromArrayBuffer(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  ensurePdfWorker();
  return getDocument({ data }).promise;
}

/** Carrega PDF via fetch (evita problemas de CORS com URL direta no pdf.js). */
export async function loadPdfDocument(fileUrl: string) {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o PDF (${response.status})`);
  }
  const data = await response.arrayBuffer();
  return loadPdfFromArrayBuffer(data);
}

/** Carrega PDF a partir de um arquivo local (prévia imediata no seletor). */
export async function loadPdfFromFile(file: File) {
  const data = await file.arrayBuffer();
  return loadPdfFromArrayBuffer(data);
}

async function renderPageToImage(
  pdf: PDFDocumentProxy,
  pageNum: number,
  targetWidthPx: number,
  jpegQuality: number = JPEG_QUALITY,
): Promise<PdfPageImage> {
  const page = await pdf.getPage(pageNum);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = targetWidthPx / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  await page.render({
    canvas,
    viewport,
  }).promise;

  const quality = Math.min(1, Math.max(0.5, jpegQuality));
  return {
    pageNumber: pageNum,
    src: canvas.toDataURL('image/jpeg', quality),
    width: canvas.width,
    height: canvas.height,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  });

  await Promise.all(workers);
  return results;
}

/** Converte todas as páginas do PDF em imagens JPEG (data URL). */
export async function renderPdfFromDocument(
  pdf: PDFDocumentProxy,
  targetWidthPx: number,
): Promise<PdfPageImage[]> {
  const pageNumbers = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
  return mapWithConcurrency(pageNumbers, PAGE_RENDER_CONCURRENCY, (pageNum) =>
    renderPageToImage(pdf, pageNum, targetWidthPx),
  );
}

/** Converte PDF local (File) — sem baixar de novo da internet. */
export async function renderPdfFileToImages(
  file: File,
  targetWidthPx: number,
): Promise<PdfPageImage[]> {
  const data = await file.arrayBuffer();
  const pdf = await loadPdfFromArrayBuffer(data);
  return renderPdfFromDocument(pdf, targetWidthPx);
}

/** Converte todas as páginas a partir de URL pública. */
export async function renderPdfToImages(
  fileUrl: string,
  targetWidthPx: number,
): Promise<PdfPageImage[]> {
  const pdf = await loadPdfDocument(fileUrl);
  return renderPdfFromDocument(pdf, targetWidthPx);
}

/** Miniatura da 1ª página sem o cabeçalho/logo do topo. */
export async function renderPdfThumbnailFromDocument(
  pdf: PDFDocumentProxy,
  targetWidthPx: number,
  topCropRatio: number = PDF_THUMBNAIL_TOP_CROP_RATIO,
): Promise<string> {
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = targetWidthPx / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvas, viewport }).promise;

  const cropPx = Math.min(
    Math.round(viewport.height * topCropRatio),
    viewport.height - 1,
  );
  const croppedHeight = viewport.height - cropPx;

  const cropped = document.createElement('canvas');
  cropped.width = viewport.width;
  cropped.height = croppedHeight;
  const ctx = cropped.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/jpeg', JPEG_QUALITY);

  ctx.drawImage(
    canvas,
    0,
    cropPx,
    viewport.width,
    croppedHeight,
    0,
    0,
    viewport.width,
    croppedHeight,
  );

  return cropped.toDataURL('image/jpeg', JPEG_QUALITY);
}

export async function renderPdfFileToThumbnail(
  file: File,
  targetWidthPx: number,
): Promise<string> {
  const data = await file.arrayBuffer();
  const pdf = await loadPdfFromArrayBuffer(data);
  return renderPdfThumbnailFromDocument(pdf, targetWidthPx);
}

export async function renderPdfUrlToThumbnail(
  fileUrl: string,
  targetWidthPx: number,
): Promise<string> {
  const pdf = await loadPdfDocument(fileUrl);
  return renderPdfThumbnailFromDocument(pdf, targetWidthPx);
}

/** Renderiza só a primeira página (miniatura) — prefira cache de prewarm quando possível. */
export async function renderPdfFirstPageToDataUrl(
  fileUrl: string,
  maxWidthPx: number,
): Promise<string> {
  const pdf = await loadPdfDocument(fileUrl);
  const page = await renderPageToImage(pdf, 1, maxWidthPx);
  return page.src;
}

export async function extractPdfTextFromUrl(
  fileUrl: string,
  maxPages = 40,
): Promise<{ text: string; pageCount: number; pagesRead: number; hasText: boolean }> {
  const pdf = await loadPdfDocument(fileUrl);
  const pageCount = pdf.numPages;
  const pagesRead = Math.min(pageCount, maxPages);
  const partes: string[] = [];

  for (let pageNumber = 1; pageNumber <= pagesRead; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const linha = content.items
      .map((item) => ('str' in item ? String(item.str) : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (linha) partes.push(`--- Página ${pageNumber} ---\n${linha}`);
  }

  const text = partes.join('\n\n');
  const compacto = text.replace(/\s+/g, '');
  return {
    text,
    pageCount,
    pagesRead,
    hasText: compacto.length >= 80,
  };
}

/** Conta páginas sem renderizar todas — leve para montar o visualizador. */
export async function getPdfPageCountFromUrl(fileUrl: string): Promise<number> {
  const pdf = await loadPdfDocument(fileUrl);
  return pdf.numPages;
}

/** Renderiza uma página a partir de um PDF já carregado (reusa o documento). */
export async function renderPdfPageFromDocument(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  targetWidthPx: number,
  jpegQuality?: number,
): Promise<PdfPageImage> {
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(
      `Página ${pageNumber} inexistente neste PDF (total: ${pdf.numPages})`,
    );
  }
  return renderPageToImage(pdf, pageNumber, targetWidthPx, jpegQuality);
}

/** Renderiza uma única página do PDF (evita converter o documento inteiro). */
export async function renderPdfSinglePageFromUrl(
  fileUrl: string,
  pageNumber: number,
  targetWidthPx: number,
): Promise<PdfPageImage> {
  const pdf = await loadPdfDocument(fileUrl);
  return renderPdfPageFromDocument(pdf, pageNumber, targetWidthPx);
}

/** Renderiza uma única página de um arquivo local. */
export async function renderPdfFileSinglePage(
  file: File,
  pageNumber: number,
  targetWidthPx: number,
): Promise<PdfPageImage> {
  const data = await file.arrayBuffer();
  const pdf = await loadPdfFromArrayBuffer(data);
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(
      `Página ${pageNumber} inexistente neste PDF (total: ${pdf.numPages})`,
    );
  }
  return renderPageToImage(pdf, pageNumber, targetWidthPx);
}
