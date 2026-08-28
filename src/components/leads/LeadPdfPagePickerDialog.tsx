import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { LeadAIMediaItem } from '@/lib/lead-ai-media-sources';
import {
  getCachedPdfPages,
  pdfCacheKeyForMedia,
  prewarmPdfImages,
  PDF_PREVIEW_WIDTH_PX,
} from '@/lib/pdf-image-cache';
import type { PdfPageImage } from '@/lib/pdf-render';
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, Wand2 } from 'lucide-react';

interface LeadPdfPagePickerDialogProps {
  item: LeadAIMediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPage?: number;
  onConfirm: (pageNumber: number) => void;
}

export function LeadPdfPagePickerDialog({
  item,
  open,
  onOpenChange,
  initialPage = 1,
  onConfirm,
}: LeadPdfPagePickerDialogProps) {
  const [pages, setPages] = useState<PdfPageImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(initialPage);

  const cacheKey = item?.pdfCacheKey ?? (item ? pdfCacheKeyForMedia(item.id) : '');

  useEffect(() => {
    if (!open || !item?.fileUrl) {
      setPages([]);
      setError(null);
      setLoading(false);
      return;
    }

    setActivePage(initialPage);
    let cancelled = false;

    const cached = getCachedPdfPages(cacheKey);
    if (cached?.length) {
      setPages(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setPages([]);
    setError(null);

    prewarmPdfImages(cacheKey, { url: item.fileUrl }, PDF_PREVIEW_WIDTH_PX)
      .then((images) => {
        if (!cancelled) {
          setPages(images);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Não foi possível abrir o PDF');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, item, cacheKey, initialPage]);

  const activeImage = pages.find((p) => p.pageNumber === activePage) ?? pages[0];
  const totalPages = pages.length;

  const goPrev = useCallback(() => {
    setActivePage((p) => Math.max(1, p - 1));
  }, []);

  const goNext = useCallback(() => {
    setActivePage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const handleConfirm = () => {
    if (!activeImage) return;
    onConfirm(activeImage.pageNumber);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(92dvh,900px)] flex-col gap-0 overflow-hidden p-0',
          'border-gold-border-subtle/40 bg-mahogany-panel sm:max-w-3xl lg:max-w-5xl',
        )}
      >
        <DialogHeader className="shrink-0 border-b border-gold-border-subtle/20 bg-mahogany-elevated/80 px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10">
              <FileText className="h-5 w-5 text-amber-200" />
            </div>
            <div className="min-w-0 space-y-1 text-left">
              <DialogTitle className="truncate text-base font-semibold text-cream-secondary sm:text-lg">
                Escolher página do PDF
              </DialogTitle>
              <DialogDescription className="line-clamp-2 text-xs text-cream-muted sm:text-sm">
                {item?.label ?? 'Documento'}
                {totalPages > 0 && (
                  <span className="ml-1.5 text-amber-200/80">
                    · {totalPages} {totalPages === 1 ? 'página' : 'páginas'}
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-gold/15" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-gold/30 bg-mahogany-card">
                  <Loader2 className="h-6 w-6 animate-spin text-gold" />
                </div>
              </div>
              <p className="text-sm text-cream-muted">Abrindo páginas do documento…</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <FileText className="h-12 w-12 text-cream-faint opacity-40" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && pages.length > 0 && (
            <>
              {/* Preview principal — desktop e mobile */}
              <div className="relative flex min-h-0 flex-1 flex-col bg-[radial-gradient(ellipse_at_center,_rgba(242,216,146,0.06)_0%,_transparent_70%)] bg-mahogany-base">
                <div className="flex items-center justify-between gap-2 border-b border-gold-border-subtle/15 px-3 py-2 sm:px-4">
                  <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-gold/90">
                    Página {activeImage?.pageNumber ?? 1} de {totalPages}
                  </span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-cream-muted hover:text-gold"
                        onClick={goPrev}
                        disabled={activePage <= 1}
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-cream-muted hover:text-gold"
                        onClick={goNext}
                        disabled={activePage >= totalPages}
                        aria-label="Próxima página"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <ScrollArea className="flex-1 min-h-[200px] max-h-[45dvh] lg:max-h-none">
                  <div className="flex items-start justify-center p-3 sm:p-5">
                    {activeImage && (
                      <img
                        src={activeImage.src}
                        alt={`${item?.label} — página ${activeImage.pageNumber}`}
                        className="max-h-[40dvh] w-full max-w-2xl rounded-lg border border-gold-border-subtle/25 bg-white object-contain shadow-2xl shadow-black/40 lg:max-h-[52dvh]"
                        width={activeImage.width}
                        height={activeImage.height}
                      />
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Grade de miniaturas */}
              {totalPages > 1 && (
                <div className="shrink-0 border-t border-gold-border-subtle/20 bg-mahogany-elevated/60 lg:w-52 lg:border-l lg:border-t-0 xl:w-56">
                  <p className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cream-muted lg:px-4">
                    Todas as páginas
                  </p>
                  <ScrollArea className="h-28 lg:h-full lg:max-h-[min(52dvh,480px)]">
                    <div className="flex gap-2 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-x-hidden lg:px-3 lg:pb-4">
                      {pages.map((page, index) => {
                        const isActive = page.pageNumber === activePage;
                        return (
                          <button
                            key={page.pageNumber}
                            type="button"
                            onClick={() => setActivePage(page.pageNumber)}
                            style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
                            className={cn(
                              'group relative shrink-0 overflow-hidden rounded-lg border transition-all duration-300',
                              'animate-in fade-in slide-in-from-bottom-1 fill-mode-both',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60',
                              'h-20 w-14 sm:h-24 sm:w-[4.5rem] lg:h-auto lg:w-full lg:aspect-[3/4]',
                              isActive
                                ? 'border-gold ring-2 ring-gold/40 scale-[1.02] shadow-lg shadow-gold/10'
                                : 'border-gold-border-subtle/30 opacity-80 hover:border-gold/50 hover:opacity-100',
                            )}
                            aria-label={`Selecionar página ${page.pageNumber}`}
                            aria-current={isActive ? 'true' : undefined}
                          >
                            <img
                              src={page.src}
                              alt=""
                              className="h-full w-full object-cover object-top bg-white"
                              loading="lazy"
                            />
                            <span
                              className={cn(
                                'absolute inset-x-0 bottom-0 py-0.5 text-center text-[9px] font-semibold tabular-nums',
                                isActive
                                  ? 'bg-gold/90 text-gold-on'
                                  : 'bg-black/65 text-cream-secondary',
                              )}
                            >
                              {page.pageNumber}
                            </span>
                            {isActive && (
                              <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-gold-on shadow">
                                <CheckCircle2 className="h-3 w-3" aria-hidden />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-gold-border-subtle/20 bg-mahogany-elevated/80 px-4 py-3 sm:px-6 sm:py-4">
          <Button
            type="button"
            variant="outline"
            className="border-gold-border-subtle/40"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={loading || !!error || pages.length === 0}
            onClick={handleConfirm}
            className="bg-gold text-gold-on hover:bg-gold/90"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Usar esta página
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
