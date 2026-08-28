import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LeadAIMediaItem } from '@/lib/lead-ai-media-sources';
import {
  getCachedPdfThumbnail,
  prewarmPdfThumbnail,
  pdfCacheKeyForMedia,
} from '@/lib/pdf-image-cache';
import { FileText, ImageIcon, ZoomIn } from 'lucide-react';

interface LeadAIAnalysisMediaStripProps {
  items: LeadAIMediaItem[];
  layout?: 'horizontal' | 'vertical';
  className?: string;
}

function AnalysisMediaThumb({ item }: { item: LeadAIMediaItem }) {
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const cacheKey = item.pdfCacheKey ?? pdfCacheKeyForMedia(item.id);

  useEffect(() => {
    if (item.kind !== 'pdf' || !item.fileUrl) return;
    let cancelled = false;

    const cached = getCachedPdfThumbnail(cacheKey);
    if (cached) {
      setPdfSrc(cached);
      return;
    }

    void prewarmPdfThumbnail(cacheKey, { url: item.fileUrl }).then((thumb) => {
      if (!cancelled) setPdfSrc(thumb);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, item.fileUrl, item.kind]);

  const src = item.kind === 'pdf' ? pdfSrc : item.thumbnailUrl;

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-mahogany-muted/50 text-cream-faint">
        {item.kind === 'pdf' ? (
          <FileText className="h-6 w-6 opacity-60" />
        ) : (
          <ImageIcon className="h-6 w-6 opacity-60" />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={item.label}
      className="h-full w-full object-cover object-center"
      loading="lazy"
    />
  );
}

function sourceLabel(item: LeadAIMediaItem) {
  if (item.kind === 'pdf') return 'PDF';
  if (item.source === 'whiteboard') return 'Lousa';
  if (item.source === 'orcamento_slide') return 'Orçamento';
  return 'Anexo';
}

export function LeadAIAnalysisMediaStrip({
  items,
  layout = 'horizontal',
  className,
}: LeadAIAnalysisMediaStripProps) {
  const [previewItem, setPreviewItem] = useState<LeadAIMediaItem | null>(null);

  if (items.length === 0) return null;

  const isVertical = layout === 'vertical';

  return (
    <>
      <div className={cn('space-y-2', className)}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
          Imagens analisadas ({items.length})
        </p>
        <div
          className={cn(
            isVertical
              ? 'flex flex-col gap-2.5'
              : 'flex gap-2.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 snap-x snap-mandatory',
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPreviewItem(item)}
              className={cn(
                'group relative shrink-0 overflow-hidden rounded-lg border border-gold-border-subtle/30 bg-mahogany-card text-left transition-all',
                'hover:border-gold/50 hover:shadow-md hover:shadow-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
                isVertical ? 'flex w-full gap-3 p-2' : 'w-[108px] snap-start',
              )}
            >
              <div
                className={cn(
                  'relative overflow-hidden bg-mahogany-base',
                  isVertical ? 'h-16 w-16 shrink-0 rounded-md' : 'aspect-square w-full',
                )}
              >
                <AnalysisMediaThumb item={item} />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                  <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                </div>
                <Badge
                  variant="outline"
                  className="absolute left-1 top-1 border-gold-border-subtle/40 bg-mahogany-panel/90 px-1.5 py-0 text-[9px]"
                >
                  {sourceLabel(item)}
                </Badge>
              </div>
              <div className={cn(isVertical && 'min-w-0 flex-1 py-0.5')}>
                <p
                  className={cn(
                    'truncate text-cream-secondary',
                    isVertical ? 'text-xs font-medium' : 'px-1.5 py-1 text-[10px]',
                  )}
                  title={item.label}
                >
                  {item.label}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-4xl border-gold-border-subtle/30 bg-mahogany-panel p-3 sm:p-4 [&>button.absolute]:hidden">
          <DialogTitle className="sr-only">{previewItem?.label ?? 'Visualizar imagem'}</DialogTitle>
          {previewItem && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{previewItem.label}</p>
                  <p className="text-xs text-cream-muted">{sourceLabel(previewItem)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-cream-muted hover:text-foreground"
                >
                  Fechar
                </button>
              </div>
              <div className="max-h-[min(70vh,640px)] overflow-auto rounded-lg border border-gold-border-subtle/20 bg-black/20">
                {previewItem.kind === 'pdf' ? (
                  <AnalysisMediaThumb item={previewItem} />
                ) : previewItem.thumbnailUrl || previewItem.fileUrl ? (
                  <img
                    src={previewItem.thumbnailUrl ?? previewItem.fileUrl}
                    alt={previewItem.label}
                    className="mx-auto max-h-[min(70vh,640px)] w-auto object-contain"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center text-cream-muted">
                    Imagem indisponível
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
