import { useEffect, useState } from 'react';
import type { LeadAIMediaItem } from '@/lib/lead-ai-media-sources';
import type { AnalysisViewerFrame } from '@/lib/lead-ai-media-viewer';
import {
  getCachedPdfPages,
  getCachedPdfThumbnail,
  pdfCacheKeyForMedia,
  prewarmPdfSinglePage,
  prewarmPdfThumbnail,
  PDF_PREVIEW_WIDTH_PX,
  PDF_THUMBNAIL_WIDTH_PX,
} from '@/lib/pdf-image-cache';
import { FileText, ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function sourceLabel(item: LeadAIMediaItem) {
  if (item.kind === 'pdf') return 'PDF';
  if (item.source === 'whiteboard') return 'Lousa';
  if (item.source === 'orcamento_slide') return 'Orçamento';
  return 'Anexo';
}

export function useAnalysisMediaImage(
  item: LeadAIMediaItem | null,
  pdfPageNumber?: number,
) {
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const cacheKey = item?.pdfCacheKey ?? (item ? pdfCacheKeyForMedia(item.id) : '');

  useEffect(() => {
    if (!item || item.kind !== 'pdf' || !item.fileUrl) {
      setPdfSrc(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const load = async () => {
      const targetPage = pdfPageNumber ?? 1;
      const cachedPages = getCachedPdfPages(cacheKey);
      const cachedPage =
        cachedPages?.find((entry) => entry.pageNumber === targetPage) ??
        cachedPages?.[targetPage - 1];

      if (cachedPage) {
        if (!cancelled) {
          setPdfSrc(cachedPage.src);
          setIsLoading(false);
        }
        return;
      }

      const page = await prewarmPdfSinglePage(
        cacheKey,
        { url: item.fileUrl! },
        targetPage,
        PDF_PREVIEW_WIDTH_PX,
      );

      if (cancelled) return;
      setPdfSrc(page?.src ?? null);
      setIsLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, item, pdfPageNumber]);

  if (!item) return { src: null, isLoading: false };

  if (item.kind === 'pdf') {
    return { src: pdfSrc, isLoading: isLoading || (!pdfSrc && !!item.fileUrl) };
  }

  return {
    src: item.fileUrl ?? item.thumbnailUrl ?? null,
    isLoading: false,
  };
}

export function useAnalysisMediaThumb(item: LeadAIMediaItem, pdfPageNumber?: number) {
  const [pageThumbSrc, setPageThumbSrc] = useState<string | null>(null);
  const [pageThumbLoading, setPageThumbLoading] = useState(false);
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const cacheKey = item.pdfCacheKey ?? pdfCacheKeyForMedia(item.id);

  useEffect(() => {
    if (item.kind !== 'pdf' || !pdfPageNumber || !item.fileUrl) {
      setPageThumbSrc(null);
      setPageThumbLoading(false);
      return;
    }

    let cancelled = false;
    setPageThumbLoading(true);

    const cachedPages = getCachedPdfPages(cacheKey);
    const cachedPage =
      cachedPages?.find((entry) => entry.pageNumber === pdfPageNumber) ??
      cachedPages?.[pdfPageNumber - 1];
    if (cachedPage) {
      setPageThumbSrc(cachedPage.src);
      setPageThumbLoading(false);
      return;
    }

    void prewarmPdfSinglePage(
      cacheKey,
      { url: item.fileUrl },
      pdfPageNumber,
      PDF_THUMBNAIL_WIDTH_PX,
    ).then((page) => {
      if (!cancelled) {
        setPageThumbSrc(page?.src ?? null);
        setPageThumbLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, item, pdfPageNumber]);

  useEffect(() => {
    if (item.kind !== 'pdf' || pdfPageNumber) return;
    if (!item.fileUrl) return;

    let cancelled = false;
    const cached = getCachedPdfThumbnail(cacheKey);
    if (cached) {
      setThumbSrc(cached);
      return;
    }

    void prewarmPdfThumbnail(cacheKey, { url: item.fileUrl }).then((thumb) => {
      if (!cancelled) setThumbSrc(thumb);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, item, pdfPageNumber]);

  if (item.kind === 'pdf' && pdfPageNumber) {
    return { src: pageThumbSrc, isLoading: pageThumbLoading || (!pageThumbSrc && !!item.fileUrl) };
  }

  if (item.kind === 'pdf') {
    return { src: thumbSrc, isLoading: !thumbSrc && !!item.fileUrl };
  }

  return {
    src: item.thumbnailUrl ?? item.fileUrl ?? null,
    isLoading: false,
  };
}

export function AnalysisMediaPlaceholder({
  item,
  message,
}: {
  item?: LeadAIMediaItem;
  message?: string;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-cream-faint">
      {item?.kind === 'pdf' ? (
        <FileText className="h-10 w-10 opacity-50" />
      ) : (
        <ImageIcon className="h-10 w-10 opacity-50" />
      )}
      <span className="text-xs uppercase tracking-[0.2em] opacity-70">
        {message ?? 'Carregando…'}
      </span>
    </div>
  );
}

export function PdfPagesLoadingState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex min-h-[240px] flex-col items-center justify-center overflow-hidden',
        'bg-[radial-gradient(ellipse_at_center,_rgba(242,216,146,0.08)_0%,_transparent_60%)] bg-mahogany-base',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-gold/15" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-gold/30 bg-mahogany-panel/90">
          <FileText className="h-6 w-6 text-gold" />
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-cream-secondary">
        <Loader2 className="h-4 w-4 animate-spin text-gold" />
        Preparando páginas do PDF…
      </div>
      <p className="mt-2 text-[11px] text-cream-muted">Cada página ficará disponível para navegação</p>
    </div>
  );
}

export function frameBadgeLabel(frame: AnalysisViewerFrame) {
  if (frame.pdfPageNumber && frame.pdfPageTotal && frame.pdfPageTotal > 1) {
    return `Pág. ${frame.pdfPageNumber}/${frame.pdfPageTotal}`;
  }
  return sourceLabel(frame.item);
}
