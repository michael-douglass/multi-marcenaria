import { useEffect, useMemo, useRef, useState } from 'react';
import type { LeadAIMediaItem } from '@/lib/lead-ai-media-sources';
import {
  getCachedPdfPages,
  pdfCacheKeyForMedia,
  resolvePdfPageCount,
} from '@/lib/pdf-image-cache';

export interface AnalysisViewerFrame {
  key: string;
  item: LeadAIMediaItem;
  pdfPageNumber?: number;
  pdfPageTotal?: number;
  displayLabel: string;
}

export interface UseAnalysisViewerFramesOptions {
  /** No chat Íris Sky: só a 1ª página de cada PDF (evita centenas de miniaturas). */
  pdfFirstPageOnly?: boolean;
}

export function buildItemsStructureFingerprint(items: LeadAIMediaItem[]): string {
  return items.map((item) => `${item.key}:${item.kind}:${item.id}`).join('|');
}

export function buildAnalysisViewerFrames(
  items: LeadAIMediaItem[],
  pdfPagesByKey: Record<string, { pageNumber: number }[]>,
  pdfFirstPageOnly = false,
): AnalysisViewerFrame[] {
  const frames: AnalysisViewerFrame[] = [];

  for (const item of items) {
    if (item.kind !== 'pdf') {
      frames.push({
        key: item.key,
        item,
        displayLabel: item.label,
      });
      continue;
    }

    const cacheKey = item.pdfCacheKey ?? pdfCacheKeyForMedia(item.id);
    const pages = pdfPagesByKey[cacheKey];

    if (!pages?.length) {
      frames.push({
        key: item.key,
        item,
        displayLabel: item.label,
      });
      continue;
    }

    const visiblePages = pdfFirstPageOnly ? pages.slice(0, 1) : pages;

    for (const page of visiblePages) {
      frames.push({
        key: `${item.key}:p${page.pageNumber}`,
        item,
        pdfPageNumber: page.pageNumber,
        pdfPageTotal: pages.length,
        displayLabel:
          pages.length > 1
            ? `${item.label} — Pág. ${page.pageNumber}/${pages.length}`
            : item.label,
      });
    }
  }

  return frames;
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function pagesMapSignature(map: Record<string, { pageNumber: number }[]>): string {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, pages]) => `${key}:${pages.map((p) => p.pageNumber).join(',')}`)
    .join('|');
}

export function useAnalysisViewerFrames(
  items: LeadAIMediaItem[],
  options: UseAnalysisViewerFramesOptions = {},
) {
  const { pdfFirstPageOnly = false } = options;
  const [pdfPagesByKey, setPdfPagesByKey] = useState<Record<string, { pageNumber: number }[]>>({});
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const itemsFingerprint = useMemo(() => buildItemsStructureFingerprint(items), [items]);
  const loadModeKey = pdfFirstPageOnly ? 'first' : 'all';

  useEffect(() => {
    let cancelled = false;
    const currentItems = itemsRef.current;

    const load = async () => {
      const pdfItems = currentItems.filter((item) => item.kind === 'pdf' && item.fileUrl);
      if (pdfItems.length === 0) {
        setPdfPagesByKey((prev) => (Object.keys(prev).length === 0 ? prev : {}));
        setIsLoadingPages(false);
        return;
      }

      setIsLoadingPages(true);
      const next: Record<string, { pageNumber: number }[]> = {};

      for (const item of pdfItems) {
        if (cancelled) return;

        const cacheKey = item.pdfCacheKey ?? pdfCacheKeyForMedia(item.id);

        if (pdfFirstPageOnly) {
          next[cacheKey] = [{ pageNumber: 1 }];
          continue;
        }

        const cachedPages = getCachedPdfPages(cacheKey);
        if (cachedPages?.length) {
          next[cacheKey] = cachedPages.map((page) => ({ pageNumber: page.pageNumber }));
          continue;
        }

        try {
          const count = await resolvePdfPageCount(cacheKey, item.fileUrl!);
          next[cacheKey] = Array.from({ length: Math.max(1, count) }, (_, index) => ({
            pageNumber: index + 1,
          }));
        } catch {
          next[cacheKey] = [{ pageNumber: 1 }];
        }

        await yieldToMainThread();
      }

      if (!cancelled) {
        const nextSignature = pagesMapSignature(next);
        setPdfPagesByKey((prev) =>
          pagesMapSignature(prev) === nextSignature ? prev : next,
        );
        setIsLoadingPages(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [itemsFingerprint, loadModeKey, pdfFirstPageOnly]);

  const frames = useMemo(
    () => buildAnalysisViewerFrames(items, pdfPagesByKey, pdfFirstPageOnly),
    [items, pdfPagesByKey, pdfFirstPageOnly],
  );

  return { frames, isLoadingPages };
}

export async function prewarmPdfPageCount(item: LeadAIMediaItem): Promise<number> {
  if (item.kind !== 'pdf' || !item.fileUrl) return 0;
  const cacheKey = item.pdfCacheKey ?? pdfCacheKeyForMedia(item.id);
  return resolvePdfPageCount(cacheKey, item.fileUrl);
}
