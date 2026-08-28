import {
  getPdfPageCountFromUrl,
  renderPdfFileSinglePage,
  renderPdfFileToImages,
  renderPdfFileToThumbnail,
  renderPdfSinglePageFromUrl,
  renderPdfToImages,
  renderPdfUrlToThumbnail,
  type PdfPageImage,
} from '@/lib/pdf-render';

const pageCache = new Map<string, PdfPageImage[]>();
const inflight = new Map<string, Promise<PdfPageImage[]>>();
const pageCountCache = new Map<string, number>();
const singlePageInflight = new Map<string, Promise<PdfPageImage | null>>();
const thumbCache = new Map<string, string>();
const thumbInflight = new Map<string, Promise<string>>();

export const PDF_THUMBNAIL_WIDTH_PX = 320;

type PrewarmSource = { file: File } | { url: string };

export function pdfCacheKeyForMedia(mediaId: string): string {
  return `media:${mediaId}`;
}

export function pdfCacheKeyForPending(tempId: string): string {
  return `pending:${tempId}`;
}

export function getCachedPdfPages(key: string): PdfPageImage[] | undefined {
  return pageCache.get(key);
}

export function setCachedPdfPages(key: string, pages: PdfPageImage[]): void {
  pageCache.set(key, pages);
}

export function migratePdfCacheKey(fromKey: string, toKey: string): void {
  const pages = pageCache.get(fromKey);
  if (pages) {
    pageCache.set(toKey, pages);
    pageCache.delete(fromKey);
  }
  const count = pageCountCache.get(fromKey);
  if (count) {
    pageCountCache.set(toKey, count);
    pageCountCache.delete(fromKey);
  }
  const pending = inflight.get(fromKey);
  if (pending) {
    inflight.set(
      toKey,
      pending.then((result) => {
        pageCache.set(toKey, result);
        if (result.length > 0) pageCountCache.set(toKey, result.length);
        return result;
      }),
    );
    inflight.delete(fromKey);
  }
  const thumb = thumbCache.get(fromKey);
  if (thumb) {
    thumbCache.set(toKey, thumb);
    thumbCache.delete(fromKey);
  }
  const thumbPending = thumbInflight.get(fromKey);
  if (thumbPending) {
    thumbInflight.set(
      toKey,
      thumbPending.then((result) => {
        thumbCache.set(toKey, result);
        return result;
      }),
    );
    thumbInflight.delete(fromKey);
  }
}

export function clearPdfCacheKey(key: string): void {
  pageCache.delete(key);
  inflight.delete(key);
  pageCountCache.delete(key);
  thumbCache.delete(key);
  thumbInflight.delete(key);
}

export function getCachedPdfThumbnail(key: string): string | undefined {
  return thumbCache.get(key);
}

/** Miniatura recortada (sem logo/cabeçalho do topo da 1ª página). */
export function prewarmPdfThumbnail(
  key: string,
  source: PrewarmSource,
  targetWidthPx: number = PDF_THUMBNAIL_WIDTH_PX,
): Promise<string> {
  const cached = thumbCache.get(key);
  if (cached) return Promise.resolve(cached);

  const running = thumbInflight.get(key);
  if (running) return running;

  const task =
    'file' in source
      ? renderPdfFileToThumbnail(source.file, targetWidthPx)
      : renderPdfUrlToThumbnail(source.url, targetWidthPx);

  const promise = task
    .then((src) => {
      thumbCache.set(key, src);
      thumbInflight.delete(key);
      return src;
    })
    .catch((err) => {
      thumbInflight.delete(key);
      throw err;
    });

  thumbInflight.set(key, promise);
  return promise;
}

/** Converte PDF em imagens e guarda em cache (reutiliza se já existir ou estiver convertendo). */
export function prewarmPdfImages(
  key: string,
  source: PrewarmSource,
  targetWidthPx: number,
): Promise<PdfPageImage[]> {
  const cached = pageCache.get(key);
  if (cached?.length) return Promise.resolve(cached);

  const running = inflight.get(key);
  if (running) return running;

  const task =
    'file' in source
      ? renderPdfFileToImages(source.file, targetWidthPx)
      : renderPdfToImages(source.url, targetWidthPx);

  const promise = task
    .then((pages) => {
      pageCache.set(key, pages);
      if (pages.length > 0) pageCountCache.set(key, pages.length);
      inflight.delete(key);
      return pages;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

/** Largura usada na conversão em background (miniatura + tela cheia). */
export const PDF_PREVIEW_WIDTH_PX = 1100;

function mergeCachedPdfPage(key: string, page: PdfPageImage): void {
  const existing = pageCache.get(key) ?? [];
  const next = existing.filter((entry) => entry.pageNumber !== page.pageNumber);
  next.push(page);
  next.sort((a, b) => a.pageNumber - b.pageNumber);
  pageCache.set(key, next);
  // NÃO usar next.length como total: o cache pode ter só algumas páginas renderizadas.
}

/** Conta páginas sem renderizar o PDF inteiro. */
export async function resolvePdfPageCount(key: string, fileUrl: string): Promise<number> {
  const cachedCount = pageCountCache.get(key);
  if (cachedCount && cachedCount > 0) return cachedCount;

  const count = await getPdfPageCountFromUrl(fileUrl);
  if (count > 0) pageCountCache.set(key, count);
  return count;
}

/** Guarda o total oficial de páginas (ex.: após renderizar o PDF completo). */
export function setCachedPdfPageCount(key: string, count: number): void {
  if (count > 0) pageCountCache.set(key, count);
}

/** Renderiza e guarda em cache apenas uma página do PDF. */
export async function prewarmPdfSinglePage(
  key: string,
  source: PrewarmSource,
  pageNumber: number,
  targetWidthPx: number,
): Promise<PdfPageImage | null> {
  const cached = getCachedPdfPages(key);
  const hit = cached?.find((page) => page.pageNumber === pageNumber);
  if (hit) return hit;

  const inflightKey = `${key}:p${pageNumber}:w${targetWidthPx}`;
  const running = singlePageInflight.get(inflightKey);
  if (running) return running;

  const promise = (async () => {
    try {
      const page =
        'file' in source
          ? await renderPdfFileSinglePage(source.file, pageNumber, targetWidthPx)
          : await renderPdfSinglePageFromUrl(source.url, pageNumber, targetWidthPx);
      mergeCachedPdfPage(key, page);
      return page;
    } catch {
      return null;
    } finally {
      singlePageInflight.delete(inflightKey);
    }
  })();

  singlePageInflight.set(inflightKey, promise);
  return promise;
}
