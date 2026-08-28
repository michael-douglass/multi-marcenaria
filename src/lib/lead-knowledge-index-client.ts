import type { LeadPDF } from '@/hooks/useLeadPDFs';
import { getLeadAttachmentViewKind } from '@/hooks/useLeadPDFs';
import type { LeadWhiteboardImage } from '@/hooks/useLeadWhiteboard';
import {
  buildSelectableLeadMediaItems,
  type LeadAIAnalysisItemPayload,
} from '@/lib/lead-ai-media-sources';
import {
  getCachedPdfPages,
  pdfCacheKeyForMedia,
  prewarmPdfSinglePage,
  resolvePdfPageCount,
  PDF_PREVIEW_WIDTH_PX,
} from '@/lib/pdf-image-cache';
import {
  LEAD_KNOWLEDGE_MAX_ITEMS,
  LEAD_KNOWLEDGE_MAX_MEDIA_PAGES,
} from '@/lib/pipeline-lead-ai-config';

function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

async function loadPdfPagesUpTo(item: {
  id: string;
  fileUrl?: string;
}, maxPages: number): Promise<string[]> {
  if (!item.fileUrl || maxPages <= 0) return [];

  const cacheKey = pdfCacheKeyForMedia(item.id);
  const totalPages = await resolvePdfPageCount(cacheKey, item.fileUrl);
  const pagesToLoad = Math.min(Math.max(1, totalPages), maxPages);
  const result: string[] = [];

  for (let pageNumber = 1; pageNumber <= pagesToLoad; pageNumber += 1) {
    const cachedPages = getCachedPdfPages(cacheKey);
    const cachedPage = cachedPages?.find((page) => page.pageNumber === pageNumber);

    if (cachedPage) {
      result.push(dataUrlToBase64(cachedPage.src));
      continue;
    }

    const page = await prewarmPdfSinglePage(
      cacheKey,
      { url: item.fileUrl },
      pageNumber,
      PDF_PREVIEW_WIDTH_PX,
    );
    if (!page) break;
    result.push(dataUrlToBase64(page.src));
    await yieldToMainThread();
  }

  return result;
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

/** Converte anexos e fotos da lousa em payload OCR para a Edge Function de indexação. */
export async function buildLeadKnowledgeClientMedia(input: {
  anexos: LeadPDF[];
  whiteboardImages: LeadWhiteboardImage[];
  maxItems?: number;
  maxPages?: number;
}): Promise<LeadAIAnalysisItemPayload[]> {
  const anexosVisiveis = input.anexos.filter(
    (anexo) => getLeadAttachmentViewKind(anexo) !== 'video',
  );

  const items = buildSelectableLeadMediaItems({
    anexos: anexosVisiveis,
    whiteboardImages: input.whiteboardImages,
    orcamentos: [],
    orcamentoMidiasById: {},
  }).filter((item) => item.kind === 'pdf');

  const maxItems = input.maxItems ?? LEAD_KNOWLEDGE_MAX_ITEMS;
  const maxPages = input.maxPages ?? LEAD_KNOWLEDGE_MAX_MEDIA_PAGES;

  const limited = items.slice(0, maxItems);
  const payload: LeadAIAnalysisItemPayload[] = [];
  let pageBudget = maxPages;

  for (const item of limited) {
    if (pageBudget <= 0) break;

    if (item.kind === 'pdf') {
      const pagesBase64 = await loadPdfPagesUpTo(
        { id: item.id, fileUrl: item.fileUrl },
        pageBudget,
      );
      if (pagesBase64.length === 0) continue;
      pageBudget -= pagesBase64.length;
      payload.push({
        source: item.source,
        id: item.id,
        label: item.label,
        pagesBase64,
        kind: 'pdf',
      });
      await yieldToMainThread();
    }
  }

  return payload;
}
