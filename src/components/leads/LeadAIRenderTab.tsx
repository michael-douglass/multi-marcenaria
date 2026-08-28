import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  ImageIcon,
  Loader2,
  FileText,
  AlertCircle,
  History,
  Layers,
  Wand2,
  CheckCircle2,
  Trash2,
  Pencil,
  Maximize2,
  Sofa,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLeadAIMediaItems } from '@/hooks/useLeadAIMediaItems';
import { useLeadPDFs } from '@/hooks/useLeadPDFs';
import { useLeadWhiteboard } from '@/hooks/useLeadWhiteboard';
import {
  useLeadAIRenders,
  useDeleteLeadAIRender,
  type LeadAIRender,
} from '@/hooks/useLeadAIRenders';
import { useLeadAIRenderBackground } from '@/contexts/LeadAIRenderBackgroundContext';
import { usePipelineLeadAIConfig } from '@/hooks/usePipelineLeadAIConfig';
import {
  resolveAnalysisMediaFromSnapshot,
  resolveItemForRenderAPI,
  resolveMediaItemImageUrlForEdit,
  type LeadAIMediaItem,
  type LeadAIAnalysisItemPayload,
  type ResolveItemForRenderOptions,
} from '@/lib/lead-ai-media-sources';
import { resolveAiRenderIdFromAttachment } from '@/lib/lead-ai-render-attachments';
import {
  getCachedPdfThumbnail,
  prewarmPdfThumbnail,
  pdfCacheKeyForMedia,
} from '@/lib/pdf-image-cache';
import { prewarmPdfPageCount } from '@/lib/lead-ai-media-viewer';
import { useAnalysisMediaImage } from '@/components/leads/lead-ai-analysis-media-utils';
import { LeadAIRenderCompare } from '@/components/leads/LeadAIRenderCompare';
import { LeadAIRenderHistoryPanel } from '@/components/leads/LeadAIRenderHistoryPanel';
import { LeadAIImageFullscreenDialog } from '@/components/leads/LeadAIImageFullscreenDialog';
import { LeadAIRenderOptionsDialog } from '@/components/leads/LeadAIRenderOptionsDialog';
import { LeadPdfPagePickerDialog } from '@/components/leads/LeadPdfPagePickerDialog';
import { LeadAIPhotoPointEditDialog } from '@/components/leads/LeadAIPhotoPointEditDialog';
import { LeadAIRenderEditDialog } from '@/components/leads/LeadAIRenderEditDialog';
import { LeadAIAmbienteComposer } from '@/components/leads/LeadAIAmbienteComposer';
import { invokeAnalyzeLeadAmbiente } from '@/lib/render-lead-ambiente-api';
import { AmbienteAtmosphereFoil } from '@/components/leads/ambiente/AmbienteAtmosphereFoil';
import type { AmbienteIncomingPhoto } from '@/lib/lead-ai-ambiente-types';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface LeadAIRenderTabProps {
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
}

function sourceMeta(item: LeadAIMediaItem) {
  if (item.kind === 'pdf') {
    return { label: 'PDF', tone: 'bg-amber-500/20 text-amber-100 border-amber-400/30' };
  }
  switch (item.source) {
    case 'whiteboard':
      return { label: 'Lousa', tone: 'bg-gold/15 text-gold border-gold-border-subtle' };
    case 'orcamento_slide':
      return { label: 'Orçamento', tone: 'bg-sky-500/15 text-sky-100 border-sky-400/25' };
    default:
      return { label: 'Anexo', tone: 'bg-mahogany-muted/80 text-cream-muted border-gold-border-subtle/40' };
  }
}

function PdfSelectThumbnail({
  item,
  selectedPage,
}: {
  item: LeadAIMediaItem;
  selectedPage?: number | null;
}) {
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const cacheKey = item.pdfCacheKey ?? pdfCacheKeyForMedia(item.id);
  const { src: pageSrc, isLoading: pageLoading } = useAnalysisMediaImage(
    selectedPage ? item : null,
    selectedPage ?? undefined,
  );

  useEffect(() => {
    if (!item.fileUrl || selectedPage) return;
    let cancelled = false;

    const cached = getCachedPdfThumbnail(cacheKey);
    if (cached) {
      setFallbackSrc(cached);
    } else {
      void prewarmPdfThumbnail(cacheKey, { url: item.fileUrl }).then((thumb) => {
        if (!cancelled) setFallbackSrc(thumb);
      });
    }

    void prewarmPdfPageCount(item).then((count) => {
      if (!cancelled) setPageCount(count);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, item, selectedPage]);

  const src = selectedPage ? pageSrc : fallbackSrc;
  const isLoading = selectedPage ? pageLoading : !fallbackSrc && !!item.fileUrl;

  if (isLoading || !src) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-cream-faint">
        <FileText className="h-7 w-7 opacity-70" />
        <span className="text-[10px] uppercase tracking-wider">Carregando PDF…</span>
      </div>
    );
  }

  return (
    <>
      <img src={src} alt={item.label} className="h-full w-full object-cover object-top" loading="lazy" />
      {selectedPage != null && (
        <div className="absolute bottom-2 left-2 z-10 rounded-md border border-gold/40 bg-gold/90 px-2 py-0.5 text-[10px] font-semibold text-gold-on shadow-md">
          Pág. {selectedPage}
        </div>
      )}
      {!selectedPage && pageCount != null && pageCount > 0 && (
        <div className="absolute bottom-2 left-2 z-10 rounded-md border border-amber-400/30 bg-black/70 px-2 py-0.5 text-[10px] font-medium text-amber-100 backdrop-blur-sm">
          {pageCount} {pageCount === 1 ? 'página' : 'páginas'}
        </div>
      )}
    </>
  );
}

function canDeleteSketchMediaItem(item: LeadAIMediaItem): boolean {
  return item.source === 'anexo' || item.source === 'whiteboard';
}

function MediaSelectCard({
  item,
  selected,
  selectedPdfPage,
  onChange,
  onOpenPdf,
  onExpand,
  onDelete,
  isDeleting = false,
  index,
}: {
  item: LeadAIMediaItem;
  selected: boolean;
  selectedPdfPage?: number | null;
  onChange: (selected: boolean) => void;
  onOpenPdf?: () => void;
  onExpand?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  index: number;
}) {
  const inputId = `lead-render-media-${item.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const meta = sourceMeta(item);
  const isPdf = item.kind === 'pdf';

  return (
    <article
      className={cn(
        'group/card relative overflow-hidden rounded-xl border transition-all duration-300',
        'bg-mahogany-card/60 shadow-lg shadow-black/20',
        'animate-in fade-in slide-in-from-bottom-2 fill-mode-both',
        selected
          ? 'border-gold/60 ring-2 ring-gold/40 shadow-gold/10 shadow-xl scale-[1.02]'
          : 'border-gold-border-subtle/25 hover:border-gold-border/50',
        isDeleting && 'pointer-events-none opacity-60',
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-mahogany-base">
        {isPdf ? (
          <PdfSelectThumbnail item={item} selectedPage={selected ? selectedPdfPage : null} />
        ) : item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={item.label}
            className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-cream-faint">
            <ImageIcon className="h-9 w-9 opacity-50" />
          </div>
        )}

        <div
          className={cn(
            'pointer-events-none absolute inset-0 transition-opacity duration-300',
            selected
              ? 'bg-gradient-to-t from-gold/25 via-gold/5 to-transparent opacity-100'
              : 'bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-90 group-hover/card:opacity-100',
          )}
        />

        <div className="absolute left-2.5 top-2.5 z-10">
          <Checkbox
            id={inputId}
            checked={selected}
            onCheckedChange={(value) => onChange(value === true)}
            className={cn(
              'h-5 w-5 border-gold-border/60 bg-mahogany-panel/90 data-[state=checked]:border-gold data-[state=checked]:bg-gold data-[state=checked]:text-gold-on',
            )}
            aria-label={`Selecionar ${item.label}`}
          />
        </div>

        <div className="absolute right-2.5 top-2.5 z-10">
          <Badge variant="outline" className={cn('border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm', meta.tone)}>
            {meta.label}
          </Badge>
        </div>

        {selected && (!isPdf || selectedPdfPage != null) && (
          <div className="absolute bottom-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-gold text-gold-on shadow-md">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          </div>
        )}

        {onExpand && (item.thumbnailUrl || item.fileUrl || isPdf) && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onExpand();
            }}
            className={cn(
              'absolute bottom-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full',
              'border border-gold/40 bg-mahogany-panel/90 text-gold shadow-lg shadow-black/30 backdrop-blur-sm',
              'opacity-90 transition-all duration-300 hover:scale-105 hover:bg-mahogany-panel',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
              '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/card:opacity-100',
            )}
            aria-label={`Ampliar ${item.label}`}
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      <div className="border-t border-gold-border-subtle/20 bg-mahogany-elevated/90 px-3 py-2.5">
        <p className="truncate text-xs font-medium text-cream-secondary" title={item.label}>
          {item.label}
          {isPdf && selected && selectedPdfPage != null && (
            <span className="text-gold"> · Pág. {selectedPdfPage}</span>
          )}
        </p>
        {isPdf && selected && onOpenPdf && (
          <button
            type="button"
            onClick={onOpenPdf}
            className="mt-1 text-[10px] font-medium text-gold hover:underline"
          >
            {selectedPdfPage != null ? 'Trocar página' : 'Escolher página'}
          </button>
        )}
      </div>

      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isDeleting}
          aria-label={`Excluir ${item.label}`}
          className={cn(
            'absolute right-2.5 top-11 z-20 h-7 w-7',
            'border border-white/10 bg-black/55 text-cream-secondary backdrop-blur-sm',
            'opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100',
            'hover:border-destructive/40 hover:bg-destructive/90 hover:text-white',
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
        >
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      )}
    </article>
  );
}

function resolveSketchPreviewUrl(
  item: LeadAIMediaItem | null,
  snapshot?: { imageUrl?: string },
): string | null {
  if (!item && !snapshot?.imageUrl) return null;
  if (item?.kind === 'image' && item.thumbnailUrl) return item.thumbnailUrl;
  if (snapshot?.imageUrl) return snapshot.imageUrl;
  if (item?.thumbnailUrl) return item.thumbnailUrl;
  return item?.fileUrl ?? null;
}

function findRootSketchSnapshot(
  render: LeadAIRender,
  historico: LeadAIRender[],
): LeadAIRender['inputSnapshot'] {
  let current: LeadAIRender | undefined = render;
  while (current?.inputSnapshot.source === 'render_edit' && current.parentRenderId) {
    const parent = historico.find((entry) => entry.id === current!.parentRenderId);
    if (!parent) break;
    current = parent;
  }
  return current?.inputSnapshot ?? render.inputSnapshot;
}

/** Colunas do grid — mesmos breakpoints do Tailwind (sm/lg). */
function getSketchGridCols(viewportWidth: number): number {
  if (viewportWidth >= 1024) return 4;
  if (viewportWidth >= 640) return 3;
  return 2;
}

/** 2 linhas do grid: card (aspect 4:5) + rodapé do card. */
function computeSketchGridHeight(containerWidth: number, cols: number): number {
  const gapPx = 12;
  const footerPx = 42;
  const cellWidth = (containerWidth - gapPx * (cols - 1)) / cols;
  const cardHeight = cellWidth * (5 / 4) + footerPx;
  return Math.ceil(cardHeight * 2 + gapPx);
}

function SketchMediaGrid({
  children,
  itemCount,
}: {
  children: ReactNode;
  itemCount: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ height: 0, cols: 2 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      const cols = getSketchGridCols(window.innerWidth);
      setLayout({ cols, height: computeSketchGridHeight(width, cols) });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const showScrollHint = itemCount > layout.cols * 2;

  return (
    <div ref={containerRef} className="relative min-w-0 w-full">
      <div
        className="overflow-y-auto overscroll-contain scroll-smooth pr-1"
        style={layout.height > 0 ? { height: layout.height, maxHeight: layout.height } : undefined}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
      </div>
      {showScrollHint && (
        <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-mahogany-elevated/95 via-mahogany-elevated/70 to-transparent pb-1.5 pt-6 text-center text-[10px] font-medium uppercase tracking-wider text-cream-faint">
          Role para ver mais imagens
        </p>
      )}
    </div>
  );
}

export function LeadAIRenderTab({ leadId, leadName, leadOrigin }: LeadAIRenderTabProps) {
  const { items, isLoading: mediaLoading } = useLeadAIMediaItems(leadId);
  const { deletePDF } = useLeadPDFs(leadId);
  const { deleteImage, images: whiteboardImages, drawings: whiteboardDrawings } = useLeadWhiteboard(leadId);
  const { config: aiConfig, isLoading: configLoading } = usePipelineLeadAIConfig();
  const { data: historico = [], isLoading: historicoLoading } = useLeadAIRenders(leadId);
  const deleteMutation = useDeleteLeadAIRender(leadId);
  const { startBackgroundRender, startBackgroundAmbienteRender, getRenderJobForLead, getEditJobForLead, getAmbienteJobForLead } = useLeadAIRenderBackground();
  const backgroundJob = getRenderJobForLead(leadId);
  const editBackgroundJob = getEditJobForLead(leadId);
  const ambienteJob = getAmbienteJobForLead(leadId);
  const { schemaEmpresa } = useEmpresa();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedPdfPage, setSelectedPdfPage] = useState<number | null>(null);
  const [pdfPickerItem, setPdfPickerItem] = useState<LeadAIMediaItem | null>(null);
  const [activeRenderId, setActiveRenderId] = useState<string | null>(null);
  const [displayedOutputUrl, setDisplayedOutputUrl] = useState<string | null>(null);
  const [displayedAnalise, setDisplayedAnalise] = useState<string | null>(null);
  const [renderOptionsOpen, setRenderOptionsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeadAIRender | null>(null);
  const [mediaDeleteTarget, setMediaDeleteTarget] = useState<LeadAIMediaItem | null>(null);
  const [isMediaDeleting, setIsMediaDeleting] = useState(false);
  const [historyFullscreenRender, setHistoryFullscreenRender] = useState<LeadAIRender | null>(null);
  const [photoEditOpen, setPhotoEditOpen] = useState(false);
  const [photoEditImageUrl, setPhotoEditImageUrl] = useState<string | null>(null);
  const [photoEditPayload, setPhotoEditPayload] = useState<LeadAIAnalysisItemPayload | null>(null);
  const [galleryRenderEditOpen, setGalleryRenderEditOpen] = useState(false);
  const [galleryRenderEditTarget, setGalleryRenderEditTarget] = useState<LeadAIRender | null>(null);
  const [isPreparingPhotoEdit, setIsPreparingPhotoEdit] = useState(false);
  const [sketchPreviewItem, setSketchPreviewItem] = useState<LeadAIMediaItem | null>(null);
  const [sketchPreviewPdfPage, setSketchPreviewPdfPage] = useState<number | null>(null);
  const [ambienteIncomingPhoto, setAmbienteIncomingPhoto] = useState<AmbienteIncomingPhoto | null>(null);
  const [isSendingToAmbiente, setIsSendingToAmbiente] = useState(false);
  const [ambientePdfFollowUp, setAmbientePdfFollowUp] = useState<{
    item: LeadAIMediaItem;
    page: number;
  } | null>(null);
  const pendingAmbienteAfterPdfRef = useRef(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.key === selectedKey) ?? null,
    [items, selectedKey],
  );

  const buildRenderOptions = useCallback(
    (item: LeadAIMediaItem | null): ResolveItemForRenderOptions | undefined => {
      if (!item || item.source !== 'whiteboard') return undefined;
      const image = whiteboardImages.find((wb) => wb.id === item.id);
      if (!image) return undefined;
      return {
        whiteboard: {
          image,
          drawings: whiteboardDrawings,
          legacyFallbackImageId: whiteboardImages[0]?.id ?? null,
        },
      };
    },
    [whiteboardDrawings, whiteboardImages],
  );

  const activeRender = useMemo(
    () => historico.find((entry) => entry.id === activeRenderId) ?? null,
    [historico, activeRenderId],
  );

  const isBusy =
    backgroundJob?.status === 'preparing' ||
    backgroundJob?.status === 'running' ||
    editBackgroundJob?.status === 'preparing' ||
    editBackgroundJob?.status === 'running' ||
    ambienteJob?.status === 'preparing' ||
    ambienteJob?.status === 'running';

  const displayedSketchItem = useMemo(() => {
    if (isBusy && selectedItem) return selectedItem;
    if (activeRender) {
      const snapshot = findRootSketchSnapshot(activeRender, historico);
      const fromSnapshot = resolveAnalysisMediaFromSnapshot([snapshot], items);
      return fromSnapshot[0] ?? null;
    }
    return selectedItem;
  }, [activeRender, historico, isBusy, items, selectedItem]);

  const sketchSnapshot = useMemo(() => {
    if (!activeRender) return undefined;
    return findRootSketchSnapshot(activeRender, historico);
  }, [activeRender, historico]);

  const sketchPdfPage = useMemo(() => {
    if (displayedSketchItem?.kind !== 'pdf') return undefined;
    if (displayedSketchItem.key === selectedKey && selectedPdfPage != null) {
      return selectedPdfPage;
    }
    const label = sketchSnapshot?.label ?? activeRender?.inputSnapshot?.label ?? '';
    const match = label.match(/Pág\.\s*(\d+)/i);
    return match ? Number.parseInt(match[1], 10) : 1;
  }, [activeRender?.inputSnapshot?.label, displayedSketchItem, selectedKey, selectedPdfPage, sketchSnapshot?.label]);

  const { src: pdfSketchSrc } = useAnalysisMediaImage(
    displayedSketchItem?.kind === 'pdf' ? displayedSketchItem : null,
    sketchPdfPage,
  );

  const sketchPreviewUrl = useMemo(() => {
    if (displayedSketchItem?.kind === 'pdf') {
      return pdfSketchSrc;
    }
    if (displayedSketchItem) return resolveSketchPreviewUrl(displayedSketchItem);
    if (activeRender && sketchSnapshot) return resolveSketchPreviewUrl(null, sketchSnapshot);
    return null;
  }, [activeRender, displayedSketchItem, pdfSketchSrc, sketchSnapshot]);

  useEffect(() => {
    if (historico.length > 0 && !displayedOutputUrl && !isBusy) {
      setDisplayedOutputUrl(historico[0].outputPublicUrl);
      setDisplayedAnalise(historico[0].analiseTexto);
      setActiveRenderId(historico[0].id);
    }
  }, [historico, displayedOutputUrl, isBusy]);

  useEffect(() => {
    if (backgroundJob?.status === 'completed' && backgroundJob.result) {
      setDisplayedOutputUrl(backgroundJob.result.outputUrl);
      setDisplayedAnalise(backgroundJob.result.analiseTexto);
      setActiveRenderId(backgroundJob.result.renderId);
    }
  }, [backgroundJob?.result, backgroundJob?.status]);

  useEffect(() => {
    if (ambienteJob?.status === 'completed' && ambienteJob.result) {
      setDisplayedOutputUrl(ambienteJob.result.outputUrl);
      setDisplayedAnalise(ambienteJob.result.analiseTexto);
      setActiveRenderId(ambienteJob.result.renderId);
    }
  }, [ambienteJob?.result, ambienteJob?.status]);

  const handleOpenRenderOptions = useCallback(() => {
    if (!selectedItem) {
      toast.error('Selecione uma imagem para renderizar');
      return;
    }
    if (selectedItem.kind === 'pdf' && selectedPdfPage == null) {
      setPdfPickerItem(selectedItem);
      return;
    }
    if (!aiConfig.renderAtivo) {
      toast.error('Renderização desativada', {
        description: 'Ative em Pipeline → Configurações → IA',
      });
      return;
    }
    if (!aiConfig.apiKeyConfigured) {
      toast.error('Chave da API não configurada');
      return;
    }
    setRenderOptionsOpen(true);
  }, [aiConfig.apiKeyConfigured, aiConfig.renderAtivo, selectedItem, selectedPdfPage]);

  const handleOpenPointEdit = useCallback(async () => {
    if (!selectedItem) {
      toast.error('Selecione uma foto para editar');
      return;
    }
    if (selectedItem.kind === 'pdf' && selectedPdfPage == null) {
      setPdfPickerItem(selectedItem);
      return;
    }
    if (!aiConfig.renderAtivo) {
      toast.error('Edição por pontos desativada', {
        description: 'Ative a renderização em Pipeline → Configurações → IA',
      });
      return;
    }
    if (!aiConfig.apiKeyConfigured) {
      toast.error('Chave da API não configurada');
      return;
    }

    const itemUrl = selectedItem.fileUrl ?? selectedItem.thumbnailUrl;
    const matchingRender = historico.find(
      (entry) => itemUrl && entry.outputPublicUrl === itemUrl,
    );
    if (matchingRender) {
      setGalleryRenderEditTarget(matchingRender);
      setGalleryRenderEditOpen(true);
      return;
    }

    setIsPreparingPhotoEdit(true);
    try {
      const renderOptions = buildRenderOptions(selectedItem);
      const imageUrl = await resolveMediaItemImageUrlForEdit(
        selectedItem,
        selectedItem.kind === 'pdf' ? (selectedPdfPage ?? undefined) : undefined,
        renderOptions,
      );
      if (!imageUrl) {
        toast.error('Não foi possível carregar a imagem selecionada');
        return;
      }

      const payload = await resolveItemForRenderAPI(
        selectedItem,
        selectedItem.kind === 'pdf' ? (selectedPdfPage ?? undefined) : undefined,
        renderOptions,
      );
      if (!payload) {
        toast.error('Não foi possível preparar a imagem selecionada');
        return;
      }

      setPhotoEditImageUrl(imageUrl);
      setPhotoEditPayload(payload);
      setPhotoEditOpen(true);
    } finally {
      setIsPreparingPhotoEdit(false);
    }
  }, [
    aiConfig.apiKeyConfigured,
    aiConfig.renderAtivo,
    buildRenderOptions,
    historico,
    selectedItem,
    selectedPdfPage,
  ]);

  const handleItemChange = useCallback(
    (item: LeadAIMediaItem, checked: boolean) => {
      if (!checked) {
        if (selectedKey === item.key) {
          setSelectedKey(null);
          setSelectedPdfPage(null);
        }
        return;
      }

      setSelectedKey(item.key);
      if (item.kind === 'pdf') {
        setSelectedPdfPage(null);
        setPdfPickerItem(item);
      } else {
        setSelectedPdfPage(null);
      }
    },
    [selectedKey],
  );

  const handleOpenPdfPicker = useCallback((item: LeadAIMediaItem) => {
    setPdfPickerItem(item);
  }, []);

  const handleExpandSketch = useCallback(
    (item: LeadAIMediaItem) => {
      if (item.kind === 'pdf') {
        const page =
          item.key === selectedKey && selectedPdfPage != null ? selectedPdfPage : 1;
        setSketchPreviewPdfPage(page);
      } else {
        setSketchPreviewPdfPage(null);
      }
      setSketchPreviewItem(item);
    },
    [selectedKey, selectedPdfPage],
  );

  const handleConfirmPdfPage = useCallback(
    (pageNumber: number) => {
      if (!pdfPickerItem) return;
      const item = pdfPickerItem;
      const shouldSendToAmbiente = pendingAmbienteAfterPdfRef.current;
      pendingAmbienteAfterPdfRef.current = false;
      setSelectedKey(item.key);
      setSelectedPdfPage(pageNumber);
      setPdfPickerItem(null);
      if (shouldSendToAmbiente) {
        setAmbientePdfFollowUp({ item, page: pageNumber });
      }
    },
    [pdfPickerItem],
  );

  const handleRender = useCallback(
    async (caracteristicasExtras?: string) => {
      if (!selectedItem) return;

      setRenderOptionsOpen(false);
      await startBackgroundRender({
        leadId,
        leadName,
        leadOrigin,
        selectedItem,
        pdfPage: selectedItem.kind === 'pdf' ? selectedPdfPage : undefined,
        caracteristicasExtras,
        renderOptions: buildRenderOptions(selectedItem),
      });
    },
    [
      leadId,
      leadName,
      leadOrigin,
      selectedItem,
      selectedPdfPage,
      buildRenderOptions,
      startBackgroundRender,
    ],
  );

  const handleEditSuccess = useCallback((render: LeadAIRender) => {
    setDisplayedOutputUrl(render.outputPublicUrl);
    setDisplayedAnalise(render.analiseTexto);
    setActiveRenderId(render.id);
  }, []);

  const handleSelectVersion = useCallback((render: LeadAIRender) => {
    setDisplayedOutputUrl(render.outputPublicUrl);
    setDisplayedAnalise(render.analiseTexto);
    setActiveRenderId(render.id);
  }, []);

  const handleDeleteVersion = useCallback(
    (render: LeadAIRender) => {
      if (activeRenderId === render.id) {
        const remaining = historico.filter((e) => e.id !== render.id);
        if (remaining.length > 0) {
          handleSelectVersion(remaining[0]);
        } else {
          setDisplayedOutputUrl(null);
          setDisplayedAnalise(null);
          setActiveRenderId(null);
        }
      }
    },
    [activeRenderId, handleSelectVersion, historico],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync(deleteTarget);
      handleDeleteVersion(deleteTarget);
      setDeleteTarget(null);
    } catch {
      // toast no hook
    }
  }, [deleteMutation, deleteTarget, handleDeleteVersion]);

  const handleConfirmDeleteMedia = useCallback(async () => {
    if (!mediaDeleteTarget) return;

    setIsMediaDeleting(true);
    try {
      if (mediaDeleteTarget.source === 'anexo') {
        if (!mediaDeleteTarget.fileUrl) {
          toast.error('Não foi possível excluir este anexo');
          return;
        }

        const renderId = resolveAiRenderIdFromAttachment({
          id: mediaDeleteTarget.id,
          fileUrl: mediaDeleteTarget.fileUrl,
        });
        const linkedRender = renderId ? historico.find((entry) => entry.id === renderId) : null;

        if (linkedRender) {
          await deleteMutation.mutateAsync(linkedRender);
          handleDeleteVersion(linkedRender);
        } else {
          await deletePDF(mediaDeleteTarget.id, mediaDeleteTarget.fileUrl);
        }
      } else if (mediaDeleteTarget.source === 'whiteboard') {
        if (!mediaDeleteTarget.fileUrl) {
          toast.error('Não foi possível excluir esta imagem');
          return;
        }
        await deleteImage({ id: mediaDeleteTarget.id, fileUrl: mediaDeleteTarget.fileUrl });
      }

      if (selectedKey === mediaDeleteTarget.key) {
        setSelectedKey(null);
        setSelectedPdfPage(null);
      }
      setMediaDeleteTarget(null);
    } finally {
      setIsMediaDeleting(false);
    }
  }, [
    deleteImage,
    deleteMutation,
    deletePDF,
    handleDeleteVersion,
    historico,
    mediaDeleteTarget,
    selectedKey,
  ]);

  const loading = mediaLoading;
  const pdfNeedsPage = selectedItem?.kind === 'pdf' && selectedPdfPage == null;
  const renderDisabled =
    isBusy || !selectedKey || pdfNeedsPage || !aiConfig.renderAtivo || !aiConfig.apiKeyConfigured;
  const photoEditDisabled =
    isBusy ||
    isPreparingPhotoEdit ||
    !selectedKey ||
    pdfNeedsPage ||
    !aiConfig.renderAtivo ||
    !aiConfig.apiKeyConfigured;
  const ambienteConfigDisabled = !aiConfig.renderAmbienteAtivo || !aiConfig.apiKeyConfigured;
  const ambienteDisabled = ambienteConfigDisabled;

  const scrollToAmbienteComposer = useCallback(() => {
    document.getElementById('lead-ai-ambiente-composer')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  const sendItemToAmbiente = useCallback(
    async (item: LeadAIMediaItem, pdfPage?: number | null) => {
      setIsSendingToAmbiente(true);
      try {
        const imageUrl = await resolveMediaItemImageUrlForEdit(
          item,
          item.kind === 'pdf' ? (pdfPage ?? undefined) : undefined,
          buildRenderOptions(item),
        );
        if (!imageUrl) {
          toast.error('Não foi possível carregar a imagem selecionada');
          return;
        }
        setAmbienteIncomingPhoto({
          url: imageUrl,
          label: item.label,
          nonce: Date.now(),
        });
        scrollToAmbienteComposer();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível enviar a foto ao ambiente');
      } finally {
        setIsSendingToAmbiente(false);
      }
    },
    [buildRenderOptions, scrollToAmbienteComposer],
  );

  useEffect(() => {
    if (!ambientePdfFollowUp) return;
    const followUp = ambientePdfFollowUp;
    setAmbientePdfFollowUp(null);
    void sendItemToAmbiente(followUp.item, followUp.page);
  }, [ambientePdfFollowUp, sendItemToAmbiente]);

  const handleOpenAmbienteComposer = useCallback(() => {
    if (ambienteConfigDisabled) return;
    if (!selectedItem) {
      toast.error('Selecione uma foto para enviar ao ambiente');
      scrollToAmbienteComposer();
      return;
    }
    if (selectedItem.kind === 'pdf' && selectedPdfPage == null) {
      pendingAmbienteAfterPdfRef.current = true;
      setPdfPickerItem(selectedItem);
      return;
    }
    void sendItemToAmbiente(selectedItem, selectedPdfPage);
  }, [ambienteConfigDisabled, scrollToAmbienteComposer, selectedItem, selectedPdfPage, sendItemToAmbiente]);

  const handleAnalyzeAmbiente = useCallback(
    async (input: { descricao: string; imageDataUrl?: string }) => {
      if (!aiConfig.renderAmbienteAtivo) {
        throw new Error('Renderização com ambiente desativada nas configurações');
      }
      if (!aiConfig.apiKeyConfigured) {
        throw new Error('Chave da API não configurada');
      }
      return invokeAnalyzeLeadAmbiente({
        leadId,
        leadName,
        leadOrigin,
        descricao: input.descricao,
        imageDataUrl: input.imageDataUrl,
        empresaSchema: schemaEmpresa,
      });
    },
    [
      aiConfig.apiKeyConfigured,
      aiConfig.renderAmbienteAtivo,
      leadId,
      leadName,
      leadOrigin,
      schemaEmpresa,
    ],
  );

  const handleRenderAmbiente = useCallback(
    async (input: {
      descricao: string;
      analiseTexto?: string;
      compositionDataUrl?: string;
      sourceImageDataUrl?: string;
    }) => {
      if (!aiConfig.renderAmbienteAtivo) {
        toast.error('Renderização com ambiente desativada', {
          description: 'Ative em Pipeline → Configurações → IA',
        });
        return;
      }
      if (!aiConfig.apiKeyConfigured) {
        toast.error('Chave da API não configurada');
        return;
      }
      void startBackgroundAmbienteRender({
        leadId,
        leadName,
        leadOrigin,
        descricao: input.descricao,
        analiseTexto: input.analiseTexto,
        compositionDataUrl: input.compositionDataUrl,
        sourceImageDataUrl: input.sourceImageDataUrl,
      });
    },
    [
      aiConfig.apiKeyConfigured,
      aiConfig.renderAmbienteAtivo,
      leadId,
      leadName,
      leadOrigin,
      startBackgroundAmbienteRender,
    ],
  );

  return (
    <div className="space-y-6 py-1">
      {isBusy && (
        <div className="flex items-start gap-2 rounded-xl border border-gold/35 bg-gold/10 px-3 py-2.5 text-sm text-cream-secondary">
          <Loader2 className="h-4 w-4 shrink-0 mt-0.5 animate-spin text-gold" />
          <p>
            A renderização continua em segundo plano. Você pode fechar este card, trocar de aba ou
            navegar pelo sistema — avisaremos quando terminar.
          </p>
        </div>
      )}

      {!aiConfig.renderAtivo && !configLoading && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            A renderização de projetos está desativada. Ative em{' '}
            <strong>Pipeline → Configurações → IA → Renderização de projetos</strong>.
          </p>
        </div>
      )}

      {!aiConfig.renderAmbienteAtivo && !configLoading && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            A renderização com ambiente está desativada. Ative em{' '}
            <strong>Pipeline → Configurações → IA → Renderização com ambiente</strong>.
          </p>
        </div>
      )}

      {(aiConfig.renderAtivo || aiConfig.renderAmbienteAtivo) && !aiConfig.apiKeyConfigured && !configLoading && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Configure a chave OpenAI em <strong>Pipeline → Configurações → IA</strong>.
          </p>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gold-border-subtle/30 bg-gradient-to-b from-mahogany-card/80 to-mahogany-elevated/40 shadow-inner shadow-black/10">
        <div className="border-b border-gold-border-subtle/20 bg-mahogany-elevated/60 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-gold">
                <Layers className="h-4 w-4" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                  Esboço do projeto
                </span>
              </div>
              <Label className="text-sm font-medium text-foreground">
                Selecione uma imagem para renderizar
              </Label>
              <p className="text-xs text-cream-muted">
                Funciona com esboços à mão na lousa, fotos de painel ou anexos. Em PDFs, escolha a página
                que deseja renderizar ou editar. Você pode gerar quantas renderizações quiser — todas ficam salvas no histórico.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleOpenPointEdit()}
                disabled={photoEditDisabled}
                className="border-gold-border-subtle/40 bg-mahogany-muted/40 hover:bg-mahogany-soft/60"
              >
                {isPreparingPhotoEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Abrindo…
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar por pontos
                  </>
                )}
              </Button>
              <Button type="button" size="sm" onClick={handleOpenRenderOptions} disabled={renderDisabled}>
                {isBusy && backgroundJob?.status !== 'completed' && !ambienteJob ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Renderizando…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Renderizar projeto
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={ambienteDisabled || isSendingToAmbiente}
                onClick={handleOpenAmbienteComposer}
                className="relative overflow-hidden"
              >
                <AmbienteAtmosphereFoil intensity={1.2} />
                <span className="relative z-10 inline-flex items-center">
                  {isSendingToAmbiente ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando foto…
                    </>
                  ) : (
                    <>
                      <Sofa className="h-4 w-4 mr-2" />
                      Renderizar com ambiente
                    </>
                  )}
                </span>
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <SketchMediaGrid itemCount={4}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] rounded-xl bg-mahogany-muted/50" />
              ))}
            </SketchMediaGrid>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gold-border-subtle/30 bg-mahogany-muted/30 px-4 py-10 text-center">
              <ImageIcon className="mx-auto mb-3 h-8 w-8 text-cream-faint opacity-60" />
              <p className="text-sm text-cream-muted">
                Nenhuma imagem disponível. Adicione um esboço na lousa ou anexe uma foto do projeto.
              </p>
            </div>
          ) : (
            <SketchMediaGrid itemCount={items.length}>
              {items.map((item, index) => (
                <MediaSelectCard
                  key={item.key}
                  item={item}
                  index={index}
                  selected={selectedKey === item.key}
                  selectedPdfPage={selectedKey === item.key ? selectedPdfPage : null}
                  onChange={(checked) => handleItemChange(item, checked)}
                  onOpenPdf={item.kind === 'pdf' ? () => handleOpenPdfPicker(item) : undefined}
                  onExpand={() => handleExpandSketch(item)}
                  onDelete={
                    canDeleteSketchMediaItem(item)
                      ? () => setMediaDeleteTarget(item)
                      : undefined
                  }
                  isDeleting={isMediaDeleting && mediaDeleteTarget?.key === item.key}
                />
              ))}
            </SketchMediaGrid>
          )}
        </div>
      </section>

      <LeadAIAmbienteComposer
        leadId={leadId}
        disabled={ambienteConfigDisabled}
        isBusy={
          ambienteJob?.status === 'preparing' || ambienteJob?.status === 'running'
        }
        incomingPhoto={ambienteIncomingPhoto}
        onAnalyze={handleAnalyzeAmbiente}
        onRender={handleRenderAmbiente}
      />

      {(displayedOutputUrl || isBusy || sketchPreviewUrl) && (
        <section className="space-y-3">
          <Label className="text-sm font-medium">Resultado da renderização</Label>
          <LeadAIRenderCompare
            sketchUrl={sketchPreviewUrl}
            sketchLabel={displayedSketchItem?.label ?? sketchSnapshot?.label ?? activeRender?.inputSnapshot?.label}
            outputUrl={isBusy ? null : displayedOutputUrl}
            analiseTexto={isBusy ? null : displayedAnalise}
            isLoading={isBusy}
            leadId={leadId}
            activeRender={activeRender}
            historico={historico}
            onEditSuccess={handleEditSuccess}
            onSelectVersion={handleSelectVersion}
            onDeleteVersion={handleDeleteVersion}
          />
        </section>
      )}

      <section className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4 text-gold" />
          Histórico de renderizações
        </Label>
        {historicoLoading ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : (
          <LeadAIRenderHistoryPanel
            historico={historico}
            selectedId={activeRenderId ?? ''}
            onSelect={handleSelectVersion}
            onFullscreen={setHistoryFullscreenRender}
            onDelete={setDeleteTarget}
            deletingId={deleteMutation.isPending ? deleteTarget?.id : null}
            title="Histórico de renderizações"
            subtitle={
              historico.length > 0
                ? `${historico.length} ${historico.length === 1 ? 'renderização salva' : 'renderizações salvas'} · clique para exibir ou excluir`
                : undefined
            }
            emptyMessage="Nenhuma renderização ainda. Gere a primeira acima — cada nova renderização será salva aqui."
            maxHeightClassName="max-h-64"
            showProjectLabel
            originBadgeLabel="Nova"
          />
        )}
      </section>

      <LeadAIRenderOptionsDialog
        open={renderOptionsOpen}
        onOpenChange={setRenderOptionsOpen}
        sketchLabel={
          selectedItem?.kind === 'pdf' && selectedPdfPage != null
            ? `${selectedItem.label} — Pág. ${selectedPdfPage}`
            : selectedItem?.label
        }
        isSubmitting={isBusy}
        onConfirm={(extras) => void handleRender(extras)}
      />

      <LeadPdfPagePickerDialog
        item={pdfPickerItem}
        open={pdfPickerItem != null}
        onOpenChange={(open) => !open && setPdfPickerItem(null)}
        initialPage={
          pdfPickerItem && selectedKey === pdfPickerItem.key && selectedPdfPage != null
            ? selectedPdfPage
            : 1
        }
        onConfirm={handleConfirmPdfPage}
      />

      {photoEditOpen && photoEditImageUrl && photoEditPayload && (
        <LeadAIPhotoPointEditDialog
          open={photoEditOpen}
          onOpenChange={setPhotoEditOpen}
          leadId={leadId}
          leadName={leadName}
          imageUrl={photoEditImageUrl}
          imageLabel={photoEditPayload.label}
          inputSnapshot={photoEditPayload}
          onSuccess={handleEditSuccess}
        />
      )}

      {galleryRenderEditOpen && galleryRenderEditTarget && (
        <LeadAIRenderEditDialog
          open={galleryRenderEditOpen}
          onOpenChange={setGalleryRenderEditOpen}
          leadId={leadId}
          leadName={leadName}
          parentRender={galleryRenderEditTarget}
          historico={historico}
          onSuccess={handleEditSuccess}
          onSelectVersion={handleSelectVersion}
          onDeleteVersion={handleDeleteVersion}
        />
      )}

      {historyFullscreenRender && (
        <LeadAIImageFullscreenDialog
          open
          onOpenChange={(open) => !open && setHistoryFullscreenRender(null)}
          src={historyFullscreenRender.outputPublicUrl}
          alt="Render fotorrealista"
          title="Renderização salva"
          subtitle={format(new Date(historyFullscreenRender.criadoEm), "dd/MM/yyyy 'às' HH:mm", {
            locale: ptBR,
          })}
          outputUrl={historyFullscreenRender.outputPublicUrl}
        />
      )}

      <LeadAIImageFullscreenDialog
        open={!!sketchPreviewItem && sketchPreviewItem.kind !== 'pdf'}
        onOpenChange={(open) => {
          if (!open) setSketchPreviewItem(null);
        }}
        src={sketchPreviewItem?.fileUrl ?? sketchPreviewItem?.thumbnailUrl ?? null}
        alt={sketchPreviewItem?.label ?? 'Imagem do projeto'}
        title={sketchPreviewItem?.label ?? 'Visualização'}
        subtitle={sketchPreviewItem ? sourceMeta(sketchPreviewItem).label : undefined}
      />

      <Dialog
        open={!!sketchPreviewItem && sketchPreviewItem.kind === 'pdf'}
        onOpenChange={(open) => {
          if (!open) setSketchPreviewItem(null);
        }}
      >
        <DialogContent className="max-w-4xl border-gold-border-subtle/30 bg-mahogany-panel p-3 sm:p-4 [&>button.absolute]:hidden">
          <DialogTitle className="sr-only">{sketchPreviewItem?.label ?? 'Visualizar PDF'}</DialogTitle>
          {sketchPreviewItem?.kind === 'pdf' && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{sketchPreviewItem.label}</p>
                  <p className="text-xs text-cream-muted">
                    {sourceMeta(sketchPreviewItem).label}
                    {sketchPreviewPdfPage != null && ` · Pág. ${sketchPreviewPdfPage}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSketchPreviewItem(null)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-cream-muted hover:text-foreground"
                >
                  Fechar
                </button>
              </div>
              <div className="relative max-h-[min(70vh,640px)] overflow-auto rounded-lg border border-gold-border-subtle/20 bg-black/20">
                <div className="relative aspect-[3/4] min-h-[280px] w-full">
                  <PdfSelectThumbnail
                    item={sketchPreviewItem}
                    selectedPage={sketchPreviewPdfPage}
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-gold-border-subtle/30 bg-mahogany-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir renderização?</AlertDialogTitle>
            <AlertDialogDescription>
              A imagem será removida permanentemente do histórico e dos anexos do lead. Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {deleteMutation.isPending ? 'Excluindo…' : 'Excluir imagem'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!mediaDeleteTarget}
        onOpenChange={(open) => !open && !isMediaDeleting && setMediaDeleteTarget(null)}
      >
        <AlertDialogContent className="border-gold-border-subtle/30 bg-mahogany-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imagem do esboço?</AlertDialogTitle>
            <AlertDialogDescription>
              {mediaDeleteTarget?.label
                ? `“${mediaDeleteTarget.label}” será removida dos anexos do lead e deixará de aparecer aqui.`
                : 'Esta imagem será removida dos anexos do lead.'}
              {mediaDeleteTarget?.label?.startsWith('Render IA') &&
                ' A renderização também será excluída do histórico e da seção Anexar PDFs, fotos e vídeos.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMediaDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMediaDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteMedia();
              }}
            >
              {isMediaDeleting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
