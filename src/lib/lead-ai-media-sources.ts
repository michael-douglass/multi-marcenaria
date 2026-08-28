import type { LeadPDF } from '@/hooks/useLeadPDFs';
import { getLeadAttachmentViewKind, isPdfAttachment } from '@/hooks/useLeadPDFs';
import type { LeadWhiteboardDrawing, LeadWhiteboardImage } from '@/hooks/useLeadWhiteboard';
import { normalizeImageUrlToJpegDataUrl } from '@/lib/render-image-normalize';
import { exportWhiteboardImageForRender } from '@/lib/whiteboard-render-export';
import type { OrcamentoSlide, OrcamentoSlideMidia } from '@/lib/orcamento-slide-types';
import {
  buildMidiasFromBlocos,
  mergeMidiasOrcamentoETemplate,
} from '@/lib/orcamento-slide-bloco-imagens';
import {
  getCachedPdfPages,
  pdfCacheKeyForMedia,
  prewarmPdfSinglePage,
  resolvePdfPageCount,
  PDF_PREVIEW_WIDTH_PX,
} from '@/lib/pdf-image-cache';
import { PIPELINE_LEAD_AI_MAX_ITEMS_PER_ANALYSIS, PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS } from '@/lib/pipeline-lead-ai-config';

export type LeadAIMediaSource = 'anexo' | 'whiteboard' | 'orcamento_slide' | 'render_edit';

export interface LeadAIMediaItem {
  key: string;
  source: LeadAIMediaSource;
  id: string;
  label: string;
  thumbnailUrl: string | null;
  kind: 'image' | 'pdf';
  fileUrl?: string;
  pdfCacheKey?: string;
  orcamentoId?: string;
}

export interface LeadAIAnalysisItemPayload {
  source: LeadAIMediaSource;
  id: string;
  label: string;
  imageUrl?: string;
  pagesBase64?: string[];
  kind?: 'image' | 'pdf';
  caracteristicasExtras?: string;
  parentRenderId?: string;
}

function normalizeUrlForDedup(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.split('?')[0].toLowerCase();
  }
}

function dedupeMediaItems(items: LeadAIMediaItem[]): LeadAIMediaItem[] {
  const seenKeys = new Set<string>();
  const seenUrls = new Set<string>();
  const result: LeadAIMediaItem[] = [];

  for (const item of items) {
    const urlKey = item.fileUrl ? normalizeUrlForDedup(item.fileUrl) : '';
    const dedupeKey = urlKey || item.key;

    if (seenKeys.has(dedupeKey) || (urlKey && seenUrls.has(urlKey))) continue;

    seenKeys.add(dedupeKey);
    if (urlKey) seenUrls.add(urlKey);
    result.push(item);
  }

  return result;
}

function uniqueKey(source: LeadAIMediaSource, id: string, suffix = ''): string {
  return `${source}:${id}${suffix ? `:${suffix}` : ''}`;
}

export function buildSelectableLeadMediaItems(input: {
  anexos: LeadPDF[];
  whiteboardImages: LeadWhiteboardImage[];
  orcamentos: OrcamentoSlide[];
  orcamentoMidiasById: Record<string, OrcamentoSlideMidia[]>;
}): LeadAIMediaItem[] {
  const items: LeadAIMediaItem[] = [];

  for (const anexo of input.anexos) {
    const viewKind = getLeadAttachmentViewKind(anexo);
    if (viewKind === 'video') continue;

    if (viewKind === 'image') {
      items.push({
        key: uniqueKey('anexo', anexo.id),
        source: 'anexo',
        id: anexo.id,
        label: anexo.titulo || anexo.file_name,
        thumbnailUrl: anexo.file_url,
        kind: 'image',
        fileUrl: anexo.file_url,
      });
      continue;
    }

    items.push({
      key: uniqueKey('anexo', anexo.id),
      source: 'anexo',
      id: anexo.id,
      label: anexo.titulo || anexo.file_name,
      thumbnailUrl: null,
      kind: 'pdf',
      fileUrl: anexo.file_url,
      pdfCacheKey: pdfCacheKeyForMedia(anexo.id),
    });
  }

  for (const img of input.whiteboardImages) {
    items.push({
      key: uniqueKey('whiteboard', img.id),
      source: 'whiteboard',
      id: img.id,
      label: img.file_name || 'Foto da lousa',
      thumbnailUrl: img.file_url,
      kind: 'image',
      fileUrl: img.file_url,
    });
  }

  for (const orc of input.orcamentos) {
    const midiasDb = input.orcamentoMidiasById[orc.id] ?? [];
    const blocos = orc.dados?.blocos ?? [];
    const midias = mergeMidiasOrcamentoETemplate(midiasDb, blocos);
    const seenUrls = new Set<string>();

    for (const midia of midias) {
      if (!midia.file_url?.trim()) continue;
      if (!midia.file_url.match(/\.(jpe?g|png|webp|gif)(\?|$)/i) && !midia.file_url.includes('/storage/')) {
        if (!midia.file_url.toLowerCase().includes('image')) continue;
      }
      if (seenUrls.has(midia.file_url)) continue;
      seenUrls.add(midia.file_url);

      const mediaId = midia.id || midia.file_url;
      items.push({
        key: uniqueKey('orcamento_slide', mediaId, orc.id),
        source: 'orcamento_slide',
        id: mediaId,
        label: `${orc.identificador || 'Orçamento'} — ${midia.file_name || 'Imagem'}`,
        thumbnailUrl: midia.file_url,
        kind: 'image',
        fileUrl: midia.file_url,
        orcamentoId: orc.id,
      });
    }

    if (midiasDb.length === 0 && blocos.length > 0) {
      for (const sintetica of buildMidiasFromBlocos(blocos)) {
        if (!sintetica.file_url?.trim() || seenUrls.has(sintetica.file_url)) continue;
        seenUrls.add(sintetica.file_url);
        items.push({
          key: uniqueKey('orcamento_slide', sintetica.id, orc.id),
          source: 'orcamento_slide',
          id: sintetica.id,
          label: `${orc.identificador || 'Orçamento'} — ${sintetica.file_name || 'Imagem'}`,
          thumbnailUrl: sintetica.file_url,
          kind: 'image',
          fileUrl: sintetica.file_url,
          orcamentoId: orc.id,
        });
      }
    }
  }

  return dedupeMediaItems(items);
}

function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

async function ensurePdfPageBase64(item: LeadAIMediaItem, pageNumber: number): Promise<string | null> {
  if (!item.pdfCacheKey || !item.fileUrl) return null;

  const cachedPages = getCachedPdfPages(item.pdfCacheKey);
  const cachedPage = cachedPages?.find((page) => page.pageNumber === pageNumber);
  if (cachedPage) return dataUrlToBase64(cachedPage.src);

  const page = await prewarmPdfSinglePage(
    item.pdfCacheKey,
    { url: item.fileUrl },
    pageNumber,
    PDF_PREVIEW_WIDTH_PX,
  );
  return page ? dataUrlToBase64(page.src) : null;
}

export interface ResolveItemForRenderOptions {
  whiteboard?: {
    image: LeadWhiteboardImage;
    drawings: LeadWhiteboardDrawing[];
    legacyFallbackImageId?: string | null;
  };
}

/** Prepara um único item para renderização (imagem ou página específica de PDF). */
export async function resolveItemForRenderAPI(
  item: LeadAIMediaItem,
  pdfPageNumber?: number,
  options?: ResolveItemForRenderOptions,
): Promise<LeadAIAnalysisItemPayload | null> {
  if (item.kind === 'image' && item.fileUrl) {
    const imageUrl =
      item.source === 'whiteboard' && options?.whiteboard
        ? await exportWhiteboardImageForRender(options.whiteboard)
        : await normalizeImageUrlToJpegDataUrl(item.fileUrl);

    return {
      source: item.source,
      id: item.id,
      label: item.label,
      imageUrl,
      kind: 'image',
    };
  }

  if (item.kind === 'pdf') {
    const targetPage = pdfPageNumber ?? 1;
    const pageBase64 = await ensurePdfPageBase64(item, targetPage);
    if (!pageBase64) return null;

    let totalPages = 1;
    if (item.pdfCacheKey && item.fileUrl) {
      try {
        totalPages = await resolvePdfPageCount(item.pdfCacheKey, item.fileUrl);
      } catch {
        totalPages = 1;
      }
    }

    const label =
      totalPages > 1
        ? `${item.label} — Pág. ${targetPage}/${totalPages}`
        : item.label;

    return {
      source: item.source,
      id: item.id,
      label,
      pagesBase64: [pageBase64],
      kind: 'pdf',
    };
  }

  return null;
}

/** URL exibível no editor de pontos (imagem ou página de PDF em data URL). */
export async function resolveMediaItemImageUrlForEdit(
  item: LeadAIMediaItem,
  pdfPageNumber?: number,
  options?: ResolveItemForRenderOptions,
): Promise<string | null> {
  if (item.kind === 'image') {
    const url = item.fileUrl ?? item.thumbnailUrl;
    if (!url) return null;
    if (item.source === 'whiteboard' && options?.whiteboard) {
      return exportWhiteboardImageForRender(options.whiteboard);
    }
    return normalizeImageUrlToJpegDataUrl(url);
  }

  if (item.kind === 'pdf' && item.pdfCacheKey && item.fileUrl) {
    const targetPage = pdfPageNumber ?? 1;
    const pageBase64 = await ensurePdfPageBase64(item, targetPage);
    if (!pageBase64) return null;
    return `data:image/jpeg;base64,${pageBase64}`;
  }

  return null;
}

export async function resolveSelectedForAPI(
  selected: LeadAIMediaItem[],
): Promise<LeadAIAnalysisItemPayload[]> {
  const deduped = dedupeMediaItems(selected);
  const limited = deduped.slice(0, PIPELINE_LEAD_AI_MAX_ITEMS_PER_ANALYSIS);
  const payload: LeadAIAnalysisItemPayload[] = [];
  let imageBudget = PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS;

  for (const item of limited) {
    if (imageBudget <= 0) break;

    if (item.kind === 'image' && item.fileUrl) {
      payload.push({
        source: item.source,
        id: item.id,
        label: item.label,
        imageUrl: item.fileUrl,
        kind: 'image',
      });
      imageBudget -= 1;
      continue;
    }

    if (item.kind === 'pdf') {
      if (!item.pdfCacheKey || !item.fileUrl) continue;

      let totalPages = 0;
      try {
        totalPages = await resolvePdfPageCount(item.pdfCacheKey, item.fileUrl);
      } catch {
        totalPages = 0;
      }
      if (totalPages <= 0) continue;

      const pagesToSend = Math.min(totalPages, imageBudget);
      const pagesBase64: string[] = [];

      for (let pageNumber = 1; pageNumber <= pagesToSend; pageNumber++) {
        const pageBase64 = await ensurePdfPageBase64(item, pageNumber);
        if (!pageBase64) {
          // Página falhou: interrompe para não enviar sequência incompleta/errada.
          break;
        }
        pagesBase64.push(pageBase64);
        imageBudget -= 1;
      }

      if (pagesBase64.length === 0) continue;

      const label =
        totalPages > 1
          ? `${item.label} (${pagesBase64.length} de ${totalPages} páginas)`
          : item.label;

      payload.push({
        source: item.source,
        id: item.id,
        label,
        pagesBase64,
        kind: 'pdf',
      });
    }
  }

  return payload;
}

export function countAnalysisImages(payload: LeadAIAnalysisItemPayload[]): number {
  return payload.reduce((acc, item) => {
    if (item.pagesBase64?.length) return acc + item.pagesBase64.length;
    if (item.imageUrl) return acc + 1;
    return acc;
  }, 0);
}

/** Reconstrói itens de mídia a partir do snapshot salvo no histórico da análise. */
export function resolveAnalysisMediaFromSnapshot(
  snapshot: LeadAIAnalysisItemPayload[],
  allItems: LeadAIMediaItem[],
): LeadAIMediaItem[] {
  const resolved: LeadAIMediaItem[] = [];
  const seen = new Set<string>();

  for (const snap of snapshot) {
    const match =
      allItems.find((item) => item.source === snap.source && item.id === snap.id) ??
      allItems.find((item) => item.source === snap.source && item.label === snap.label);

    if (match) {
      if (!seen.has(match.key)) {
        seen.add(match.key);
        resolved.push(match);
      }
      continue;
    }

    const fallbackKey = `${snap.source}:${snap.id}:snapshot`;
    if (seen.has(fallbackKey)) continue;
    seen.add(fallbackKey);

    const isPdf = snap.kind === 'pdf' || !!snap.pagesBase64?.length;
    resolved.push({
      key: fallbackKey,
      source: snap.source,
      id: snap.id,
      label: snap.label,
      thumbnailUrl: isPdf ? null : snap.imageUrl ?? null,
      kind: isPdf ? 'pdf' : 'image',
      fileUrl: snap.imageUrl,
      pdfCacheKey: isPdf ? pdfCacheKeyForMedia(snap.id) : undefined,
    });
  }

  return resolved;
}

export function isPdfAnexo(anexo: LeadPDF): boolean {
  return isPdfAttachment(anexo);
}
