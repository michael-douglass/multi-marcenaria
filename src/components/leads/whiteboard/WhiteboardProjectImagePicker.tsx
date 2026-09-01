import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Image, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLeadMidiasParaOrcamento } from '@/hooks/useLeadMidiasParaOrcamento';
import { setProjectImagePickerOpenFlag, swallowClickThroughAfterDialogClose } from '@/lib/dialog-outside-guard';
import { isLeadMidiaPdf } from '@/lib/orcamento-slide-projeto-files';
import type { LeadMidiaDisponivel } from '@/lib/orcamento-slide-types';
import {
  getCachedPdfPages,
  getCachedPdfThumbnail,
  pdfCacheKeyForMedia,
  PDF_PREVIEW_WIDTH_PX,
  prewarmPdfImages,
  prewarmPdfThumbnail,
} from '@/lib/pdf-image-cache';
import type { PdfPageImage } from '@/lib/pdf-render';
import {
  leadFullscreenNestedContentClass,
  leadFullscreenNestedOverlayClass,
} from '@/lib/overlay-z-index';
import { cn } from '@/lib/utils';
import {
  ProjectImageStudio,
  type ProjectImageStudioHandle,
} from '@/components/leads/whiteboard/ProjectImageStudio';

interface WhiteboardProjectImagePickerProps {
  leadId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URLs já presentes na lousa — ocultadas no seletor */
  existingImageUrls: string[];
  onSelect: (midia: LeadMidiaDisponivel) => void | Promise<void>;
  isSelecting?: boolean;
  /** Acima da tela cheia da lousa / compositor de ambiente. */
  elevated?: boolean;
}

function midiaIsPdf(midia: LeadMidiaDisponivel): boolean {
  return midia.tipo_arquivo === 'pdf' || isLeadMidiaPdf(midia);
}

function PdfThumb({ midia }: { midia: LeadMidiaDisponivel }) {
  const cacheKey = pdfCacheKeyForMedia(midia.id);
  const [src, setSrc] = useState<string | null>(() => getCachedPdfThumbnail(cacheKey) ?? null);

  useEffect(() => {
    if (src || !midia.file_url) return;
    let cancelled = false;
    void prewarmPdfThumbnail(cacheKey, { url: midia.file_url })
      .then((thumb) => {
        if (!cancelled) setSrc(thumb);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, midia.file_url, src]);

  if (!src) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 bg-mahogany-muted/80 text-cream-muted">
        <FileText className="h-8 w-8 text-amber-400/80" />
        <span className="text-[10px] font-medium">PDF</span>
      </div>
    );
  }

  return <img src={src} alt={midia.file_name} className="aspect-square w-full object-cover object-top" />;
}

export function WhiteboardProjectImagePicker({
  leadId,
  open,
  onOpenChange,
  existingImageUrls,
  onSelect,
  isSelecting = false,
  elevated = false,
}: WhiteboardProjectImagePickerProps) {
  const { data: midias = [], isLoading } = useLeadMidiasParaOrcamento(leadId);
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const [pdfPages, setPdfPages] = useState<PdfPageImage[]>([]);
  const [pdfPageIndex, setPdfPageIndex] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isBaking, setIsBaking] = useState(false);
  const studioRef = useRef<ProjectImageStudioHandle>(null);
  const confirmingRef = useRef(false);

  const existing = new Set(existingImageUrls);
  const disponiveis = midias.filter((m) => !existing.has(m.file_url));
  const inspecting = inspectIndex != null ? disponiveis[inspectIndex] ?? null : null;
  const inspectingPdf = inspecting ? midiaIsPdf(inspecting) : false;
  const activePdfPage = pdfPages[pdfPageIndex] ?? pdfPages[0] ?? null;

  useEffect(() => {
    setProjectImagePickerOpenFlag(open);
    return () => setProjectImagePickerOpenFlag(false);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setInspectIndex(null);
      setPdfPages([]);
      setPdfPageIndex(0);
      setPdfLoading(false);
      setPdfError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!inspecting || !inspectingPdf || !inspecting.file_url) {
      setPdfPages([]);
      setPdfPageIndex(0);
      setPdfLoading(false);
      setPdfError(null);
      return;
    }

    const cacheKey = pdfCacheKeyForMedia(inspecting.id);
    const fileUrl = inspecting.file_url;
    const cached = getCachedPdfPages(cacheKey);
    if (cached?.length) {
      setPdfPages(cached);
      setPdfPageIndex(0);
      setPdfLoading(false);
      setPdfError(null);
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setPdfPages([]);
    setPdfPageIndex(0);
    setPdfError(null);

    void prewarmPdfImages(cacheKey, { url: fileUrl }, PDF_PREVIEW_WIDTH_PX)
      .then((pages) => {
        if (!cancelled) {
          setPdfPages(pages);
          setPdfLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPdfError(err instanceof Error ? err.message : 'Não foi possível abrir o PDF');
          setPdfLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [inspecting?.id, inspecting?.file_url, inspectingPdf]);

  useEffect(() => {
    if (!open || inspectIndex == null) return;

    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest('[data-image-studio-panel]')) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (inspectingPdf && pdfPageIndex > 0) {
          setPdfPageIndex((index) => Math.max(0, index - 1));
          return;
        }
        setInspectIndex((index) => (index == null ? index : Math.max(0, index - 1)));
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (inspectingPdf && pdfPageIndex < pdfPages.length - 1) {
          setPdfPageIndex((index) => Math.min(pdfPages.length - 1, index + 1));
          return;
        }
        setInspectIndex((index) =>
          index == null ? index : Math.min(disponiveis.length - 1, index + 1),
        );
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disponiveis.length, inspectIndex, inspectingPdf, open, pdfPageIndex, pdfPages.length]);

  const studioSourceUrl = inspectingPdf ? activePdfPage?.src : inspecting?.file_url;

  const handleConfirmInspect = async () => {
    if (!inspecting || isSelecting || isBaking || confirmingRef.current) return;
    if (inspectingPdf && !activePdfPage) return;

    const sourceUrl = (inspectingPdf ? activePdfPage?.src : inspecting.file_url) || '';
    if (!sourceUrl) {
      toast.error('Esta foto não tem um arquivo válido');
      return;
    }

    confirmingRef.current = true;
    try {
      setIsBaking(true);
      let bakedUrl = sourceUrl;
      const shouldBake = Boolean(studioRef.current?.hasEdits());
      if (shouldBake && studioRef.current) {
        try {
          bakedUrl = await Promise.race([
            studioRef.current.bake(),
            new Promise<string>((_, reject) => {
              window.setTimeout(() => reject(new Error('O retoque demorou demais')), 6000);
            }),
          ]);
          bakedUrl = bakedUrl || sourceUrl;
        } catch (err) {
          bakedUrl = sourceUrl;
          toast.message('A foto entra como está — o retoque não pôde ser aplicado.', {
            description: err instanceof Error ? err.message : undefined,
          });
        }
      }

      if (inspectingPdf && activePdfPage) {
        const base = inspecting.file_name.replace(/\.[^.]+$/, '') || 'documento';
        await onSelect({
          ...inspecting,
          file_url: bakedUrl || activePdfPage.src,
          file_name: `${base}-pagina-${activePdfPage.pageNumber}.jpg`,
          preview_label: `${inspecting.preview_label || 'PDF'} · pág. ${activePdfPage.pageNumber}`,
          tipo_arquivo: 'imagem',
        });
      } else {
        await onSelect({
          ...inspecting,
          file_url: bakedUrl || inspecting.file_url,
          preview_label: inspecting.preview_label || inspecting.file_name,
        });
      }
      swallowClickThroughAfterDialogClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível aplicar a edição da foto');
    } finally {
      confirmingRef.current = false;
      setIsBaking(false);
    }
  };

  const canGoPrevFile = inspectIndex != null && inspectIndex > 0;
  const canGoNextFile = inspectIndex != null && inspectIndex < disponiveis.length - 1;
  const canGoPrevPage = inspectingPdf && pdfPageIndex > 0;
  const canGoNextPage = inspectingPdf && pdfPageIndex < pdfPages.length - 1;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setInspectIndex(null);
      setPdfPages([]);
      setPdfPageIndex(0);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        nested
        data-whiteboard-project-picker=""
        portalContainer={typeof document !== 'undefined' ? document.body : undefined}
        overlayClassName={cn(
          elevated ? leadFullscreenNestedOverlayClass : 'z-[80]',
          'ambiente-project-picker-overlay',
        )}
        className={cn(
          'flex max-h-[min(94dvh,960px)] flex-col gap-0 overflow-hidden p-0',
          'border-gold-border-subtle/40 bg-mahogany-panel',
          inspecting ? 'h-[min(90dvh,880px)] min-h-[min(62dvh,480px)] sm:max-w-6xl' : 'sm:max-w-2xl',
          elevated ? leadFullscreenNestedContentClass : '!z-[81]',
        )}
        onPointerDownOutside={(event) => event.stopPropagation()}
        onInteractOutside={(event) => event.stopPropagation()}
        onFocusOutside={(event) => event.stopPropagation()}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-gold-border-subtle/20 bg-mahogany-elevated/80 px-4 py-4 sm:px-5">
          <DialogTitle className="font-display text-left text-base tracking-wide text-cream-secondary sm:text-lg">
            {inspecting ? 'Bancada de retoque' : 'Fotos do projeto'}
          </DialogTitle>
          <DialogDescription className="text-left text-xs text-cream-muted sm:text-sm">
            {inspecting
              ? 'Folheie as fotos, recorte o fundo e ajuste luz e cor. O arquivo original do lead permanece igual.'
              : 'Clique numa foto para ver de perto. Em um PDF, você folheia as páginas e pode editar antes de usar.'}
          </DialogDescription>
        </DialogHeader>

        <div className={cn('min-h-0 flex-1', inspecting ? 'flex overflow-hidden' : 'overflow-y-auto')}>
          {isLoading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : disponiveis.length === 0 ? (
            <div className="rounded-lg px-4 py-12 text-center text-sm text-muted-foreground">
              <Image className="mx-auto mb-2 h-8 w-8 opacity-40" />
              {midias.length === 0
                ? 'Este lead ainda não tem foto anexada. Use Inserir ou Tirar foto, ou anexe no card.'
                : 'As fotos deste lead já estão na lousa. Use Inserir para trazer outra do computador.'}
            </div>
          ) : inspecting ? (
            <div className="flex h-full min-h-[min(68dvh,640px)] w-full flex-1 flex-col">
              <div className="relative flex min-h-[min(48dvh,360px)] flex-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 z-20 h-10 w-10 -translate-y-1/2 text-cream-muted hover:text-gold"
                  disabled={!canGoPrevFile && !canGoPrevPage}
                  onClick={() => {
                    if (canGoPrevPage) {
                      setPdfPageIndex((index) => index - 1);
                      return;
                    }
                    if (canGoPrevFile) setInspectIndex((index) => (index == null ? 0 : index - 1));
                  }}
                  aria-label={inspectingPdf ? 'Página ou foto anterior' : 'Foto anterior'}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>

                {inspectingPdf && pdfLoading ? (
                  <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-3 text-cream-muted">
                    <Loader2 className="h-7 w-7 animate-spin text-gold" />
                    <p className="text-sm">Abrindo páginas do documento…</p>
                  </div>
                ) : inspectingPdf && pdfError ? (
                  <p className="m-auto max-w-sm px-8 text-center text-sm text-red-400">{pdfError}</p>
                ) : studioSourceUrl ? (
                  <ProjectImageStudio
                    key={studioSourceUrl}
                    ref={studioRef}
                    sourceUrl={studioSourceUrl}
                    disabled={isSelecting || isBaking}
                  />
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 z-20 h-10 w-10 -translate-y-1/2 text-cream-muted hover:text-gold lg:right-[20rem]"
                  disabled={!canGoNextFile && !canGoNextPage}
                  onClick={() => {
                    if (canGoNextPage) {
                      setPdfPageIndex((index) => index + 1);
                      return;
                    }
                    if (canGoNextFile) setInspectIndex((index) => (index == null ? 0 : index + 1));
                  }}
                  aria-label={inspectingPdf ? 'Próxima página ou foto' : 'Próxima foto'}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-gold-border-subtle/15 px-4 py-2">
                <p className="truncate text-xs text-cream-muted">
                  {inspecting.preview_label}
                  {inspectingPdf && activePdfPage
                    ? ` · página ${activePdfPage.pageNumber} de ${pdfPages.length || '…'}`
                    : ` · ${inspectIndex! + 1} de ${disponiveis.length}`}
                </p>
                <p className="shrink-0 text-[10px] uppercase tracking-wider text-cream-faint">
                  {format(new Date(inspecting.criado_em), 'dd/MM/yy', { locale: ptBR })}
                </p>
              </div>

              {inspectingPdf && pdfPages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto border-t border-gold-border-subtle/15 px-3 py-2">
                  {pdfPages.map((page, index) => (
                    <button
                      key={page.pageNumber}
                      type="button"
                      onClick={() => setPdfPageIndex(index)}
                      className={cn(
                        'relative h-16 w-12 shrink-0 overflow-hidden rounded-md border',
                        index === pdfPageIndex
                          ? 'border-gold ring-2 ring-gold/40'
                          : 'border-gold-border-subtle/30 opacity-80 hover:opacity-100',
                      )}
                      aria-label={`Página ${page.pageNumber}`}
                      aria-current={index === pdfPageIndex ? 'true' : undefined}
                    >
                      <img src={page.src} alt="" className="h-full w-full object-cover object-top" />
                      <span className="absolute inset-x-0 bottom-0 bg-black/65 py-0.5 text-center text-[9px] font-semibold text-cream-secondary">
                        {page.pageNumber}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              {disponiveis.map((midia, index) => {
                const isPdf = midiaIsPdf(midia);
                return (
                  <button
                    key={`${midia.origem}-${midia.id}`}
                    type="button"
                    disabled={isSelecting}
                    className={cn(
                      'relative overflow-hidden rounded-xl border-2 border-transparent text-left transition-all',
                      'hover:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
                      isSelecting && 'opacity-70',
                    )}
                    onClick={() => setInspectIndex(index)}
                  >
                    {isPdf ? (
                      <PdfThumb midia={midia} />
                    ) : (
                      <img
                        src={midia.file_url}
                        alt={midia.file_name}
                        className="aspect-square w-full object-cover"
                      />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-black/20" />
                    <Badge
                      className="pointer-events-none absolute left-2 top-2 text-[10px]"
                      variant={isPdf ? 'outline' : midia.origem === 'lead_whiteboard' ? 'secondary' : 'default'}
                    >
                      {isPdf ? 'PDF · ver páginas' : midia.preview_label}
                    </Badge>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-[10px] text-white">
                      {format(new Date(midia.criado_em), 'dd/MM/yy', { locale: ptBR })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {inspecting && (
          <DialogFooter className="shrink-0 gap-2 border-t border-gold-border-subtle/20 bg-mahogany-elevated/80 px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="outline"
              className="border-gold-border-subtle/40"
              onClick={() => setInspectIndex(null)}
            >
              Ver todas
            </Button>
            <Button
              type="button"
              disabled={isSelecting || isBaking || (inspectingPdf && (pdfLoading || !activePdfPage))}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (event.button !== 0) return;
                void handleConfirmInspect();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void handleConfirmInspect();
              }}
              className="bg-gold text-gold-on hover:bg-gold/90"
            >
              {isSelecting || isBaking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {inspectingPdf ? 'Usar esta página' : 'Usar esta foto'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
