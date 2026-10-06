import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  History,
  AlertCircle,
  Maximize2,
  Presentation,
  CheckCircle2,
  Layers,
  Trash2,
  FileDown,
  Search,
} from 'lucide-react';
import { useLeadAIMediaItems } from '@/hooks/useLeadAIMediaItems';
import { useLeadAIMediaFolderBrowse } from '@/hooks/useLeadAIMediaFolderBrowse';
import {
  useLeadAIAnalyses,
  useDeleteLeadAIAnalysis,
} from '@/hooks/useLeadAIAnalyses';
import { LeadAIMediaFolderShelf } from '@/components/leads/LeadAIMediaFolderShelf';
import { useLeadAIAnalysisBackground } from '@/contexts/LeadAIAnalysisBackgroundContext';
import { usePipelineLeadAIConfig } from '@/hooks/usePipelineLeadAIConfig';
import {
  resolveAnalysisMediaFromSnapshot,
  type LeadAIMediaItem,
} from '@/lib/lead-ai-media-sources';
import { resolveAiRenderIdFromAttachment } from '@/lib/lead-ai-render-attachments';
import { useLeadAIRenders, useDeleteLeadAIRender } from '@/hooks/useLeadAIRenders';
import {
  getCachedPdfThumbnail,
  prewarmPdfThumbnail,
  pdfCacheKeyForMedia,
} from '@/lib/pdf-image-cache';
import { prewarmPdfPageCount } from '@/lib/lead-ai-media-viewer';
import { LeadAIAnalysisFullscreenDialog } from '@/components/leads/LeadAIAnalysisFullscreenDialog';
import { LeadAIImageFullscreenDialog } from '@/components/leads/LeadAIImageFullscreenDialog';
import { IncluirAnaliseNaApresentacaoDialog } from '@/components/leads/IncluirAnaliseNaApresentacaoDialog';
import { LeadAIRelatorioExportDialog } from '@/components/leads/LeadAIRelatorioExportDialog';
import { LeadAIAnalysisReader } from '@/components/leads/LeadAIAnalysisReader';
import {
  LeadAIMediaGalleryFullscreenDialog,
} from '@/components/leads/LeadAIMediaGalleryFullscreenDialog';
import { buildLeadCardReturnTo } from '@/lib/orcamento-slide-navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS,
  PIPELINE_LEAD_AI_MAX_ITEMS_PER_ANALYSIS,
} from '@/lib/pipeline-lead-ai-config';

interface LeadAIAnalysisTabProps {
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

function ImageSelectThumbnail({ item }: { item: LeadAIMediaItem }) {
  const [failed, setFailed] = useState(false);
  const src = item.thumbnailUrl ?? item.fileUrl ?? null;

  if (!src || failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-cream-faint">
        <ImageIcon className="h-7 w-7 opacity-70" />
        <span className="text-[10px] uppercase tracking-wider px-2 text-center">
          {failed ? 'Prévia indisponível' : 'Sem imagem'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={item.label}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function PdfSelectThumbnail({ item }: { item: LeadAIMediaItem }) {
  const [src, setSrc] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const cacheKey = item.pdfCacheKey ?? pdfCacheKeyForMedia(item.id);

  useEffect(() => {
    if (!item.fileUrl) return;
    let cancelled = false;

    const cached = getCachedPdfThumbnail(cacheKey);
    if (cached) {
      setSrc(cached);
    } else {
      void prewarmPdfThumbnail(cacheKey, { url: item.fileUrl }).then((thumb) => {
        if (!cancelled) setSrc(thumb);
      });
    }

    void prewarmPdfPageCount(item).then((count) => {
      if (!cancelled) setPageCount(count);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, item.fileUrl, item.id, item.kind]);

  if (!src) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-cream-faint">
        <FileText className="h-7 w-7 opacity-70" />
        <span className="text-[10px] uppercase tracking-wider">Carregando PDF…</span>
      </div>
    );
  }

  return (
    <>
      <img
        src={src}
        alt={item.label}
        className="h-full w-full object-cover object-top"
        loading="lazy"
      />
      {pageCount != null && pageCount > 0 && (
        <div className="absolute bottom-2 left-2 z-10 rounded-md border border-amber-400/30 bg-black/70 px-2 py-0.5 text-[10px] font-medium text-amber-100 backdrop-blur-sm">
          {pageCount} {pageCount === 1 ? 'página' : 'páginas'}
        </div>
      )}
    </>
  );
}

function MediaSelectCard({
  item,
  selected,
  onChange,
  onExpand,
  onDelete,
  isDeleting = false,
  index,
}: {
  item: LeadAIMediaItem;
  selected: boolean;
  onChange: (selected: boolean) => void;
  onExpand?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  index: number;
}) {
  const inputId = `lead-ai-media-${item.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const meta = sourceMeta(item);

  return (
    <label
      htmlFor={inputId}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={cn(
        'group relative block cursor-pointer overflow-hidden rounded-xl border transition-all duration-300',
        'animate-in fade-in slide-in-from-bottom-2 fill-mode-both',
        'bg-mahogany-card/60 shadow-lg shadow-black/20',
        selected
          ? 'border-gold/60 ring-2 ring-gold/40 shadow-gold/10 shadow-xl scale-[1.02]'
          : 'border-gold-border-subtle/25 hover:border-gold-border/50 hover:shadow-gold/5 hover:shadow-xl',
      )}
      title="Clique para selecionar"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-mahogany-base">
        {item.kind === 'pdf' ? (
          <PdfSelectThumbnail item={item} />
        ) : (
          <ImageSelectThumbnail item={item} />
        )}

        <div
          className={cn(
            'pointer-events-none absolute inset-0 transition-opacity duration-300',
            selected
              ? 'bg-gradient-to-t from-gold/25 via-gold/5 to-transparent opacity-100'
              : 'bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-90 group-hover:opacity-100',
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
          <Badge
            variant="outline"
            className={cn('border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm', meta.tone)}
          >
            {meta.label}
          </Badge>
        </div>

        {selected && (
          <div className="absolute bottom-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-gold text-gold-on shadow-md">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          </div>
        )}

        {onExpand && (item.thumbnailUrl || item.fileUrl || item.kind === 'pdf') && (
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
              '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100',
            )}
            aria-label={`Ampliar ${item.label}`}
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
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
            'opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
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

      <div className="border-t border-gold-border-subtle/20 bg-mahogany-elevated/90 px-3 py-2.5">
        <p className="truncate text-xs font-medium text-cream-secondary" title={item.label}>
          {item.label}
        </p>
      </div>
    </label>
  );
}

function isAiRenderMediaItem(item: LeadAIMediaItem): boolean {
  if (item.label?.startsWith('Render IA')) return true;
  return Boolean(
    resolveAiRenderIdFromAttachment({
      id: item.id,
      fileUrl: item.fileUrl,
      fileName: item.label,
    }),
  );
}

export function LeadAIAnalysisVisualTab({ leadId, leadName, leadOrigin }: LeadAIAnalysisTabProps) {
  const location = useLocation();
  const returnToLeadCard = buildLeadCardReturnTo(location.pathname, location.search, leadId);
  const { items, isLoading: mediaLoading, isRefreshing: mediaRefreshing } = useLeadAIMediaItems(leadId);
  const folderBrowse = useLeadAIMediaFolderBrowse(leadId, items);
  const visibleGalleryItems = folderBrowse.visibleItems;
  const { config: aiConfig, isLoading: configLoading } = usePipelineLeadAIConfig();
  const { data: historico = [], isLoading: historicoLoading } = useLeadAIAnalyses(leadId);
  const { data: renderHistorico = [] } = useLeadAIRenders(leadId);
  const deleteMutation = useDeleteLeadAIAnalysis(leadId);
  const deleteRenderMutation = useDeleteLeadAIRender(leadId);
  const {
    startBackgroundAnalysis,
    getJobForLead,
  } = useLeadAIAnalysisBackground();
  const backgroundJob = getJobForLead(leadId);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [displayedText, setDisplayedText] = useState('');
  const [displayedBriefing, setDisplayedBriefing] = useState<string | null>(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [pendingAnalysisMedia, setPendingAnalysisMedia] = useState<LeadAIMediaItem[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [galleryFullscreenOpen, setGalleryFullscreenOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<LeadAIMediaItem | null>(null);
  const [renderDeleteTarget, setRenderDeleteTarget] = useState<LeadAIMediaItem | null>(null);
  const [incluirApresentacaoOpen, setIncluirApresentacaoOpen] = useState(false);
  const [exportRelatorioOpen, setExportRelatorioOpen] = useState(false);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedKeys.has(item.key)),
    [items, selectedKeys],
  );

  const activeAnalysisEntry = useMemo(
    () => historico.find((entry) => entry.id === activeAnalysisId),
    [historico, activeAnalysisId],
  );

  const activeAnalysisDate = useMemo(() => {
    if (!activeAnalysisEntry) return undefined;
    return format(new Date(activeAnalysisEntry.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  }, [activeAnalysisEntry]);

  const isBusy =
    backgroundJob?.status === 'preparing' || backgroundJob?.status === 'running';

  const displayedMediaItems = useMemo(() => {
    if (isBusy) {
      const media =
        backgroundJob?.mediaItems?.length
          ? backgroundJob.mediaItems
          : pendingAnalysisMedia.length > 0
            ? pendingAnalysisMedia
            : selectedItems;
      return media;
    }
    if (activeAnalysisEntry) {
      return resolveAnalysisMediaFromSnapshot(activeAnalysisEntry.itensSelecionados, items);
    }
    return selectedItems;
  }, [
    activeAnalysisEntry,
    backgroundJob?.mediaItems,
    isBusy,
    items,
    pendingAnalysisMedia,
    selectedItems,
  ]);

  useEffect(() => {
    if (historico.length > 0 && !displayedText) {
      setDisplayedText(historico[0].conteudo);
      setDisplayedBriefing(historico[0].perguntasBriefing);
      setActiveAnalysisId(historico[0].id);
    }
  }, [historico, displayedText]);

  const setItemSelected = useCallback((key: string, selected: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (selected) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  useEffect(() => {
    if (backgroundJob?.status === 'completed' && backgroundJob.result) {
      setDisplayedText(backgroundJob.result.conteudo);
      setDisplayedBriefing(backgroundJob.result.perguntasBriefing);
      setActiveAnalysisId(backgroundJob.result.analiseId);
      setPendingAnalysisMedia([]);
    }
  }, [backgroundJob?.result, backgroundJob?.status]);

  const runAnalysis = useCallback(
    async (itemsToAnalyze: LeadAIMediaItem[]) => {
      if (itemsToAnalyze.length === 0) return false;
      if (!aiConfig.ativo) {
        toast.error('Análise de IA desativada', {
          description: 'Peça ao administrador para ativar em Pipeline → Configurações → IA',
        });
        return false;
      }
      if (!aiConfig.apiKeyConfigured) {
        toast.error('Chave da API não configurada', {
          description: 'Configure em Pipeline → Configurações → Configuração IA',
        });
        return false;
      }

      setPendingAnalysisMedia(itemsToAnalyze);
      return startBackgroundAnalysis({
        leadId,
        leadName,
        leadOrigin,
        itemsToAnalyze,
      });
    },
    [
      aiConfig.ativo,
      aiConfig.apiKeyConfigured,
      leadId,
      leadName,
      leadOrigin,
      startBackgroundAnalysis,
    ],
  );

  const handleAnalyze = () => {
    void runAnalysis(selectedItems);
  };

  const selectAll = () =>
    setSelectedKeys(new Set((visibleGalleryItems.length > 0 ? visibleGalleryItems : items).map((i) => i.key)));
  const clearSelection = () => setSelectedKeys(new Set());

  const handleCopy = async () => {
    if (!displayedText) return;
    try {
      await navigator.clipboard.writeText(displayedText);
      setCopied(true);
      toast.success('Texto copiado');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const deleteTargetEntry = useMemo(
    () => historico.find((entry) => entry.id === deleteTargetId),
    [deleteTargetId, historico],
  );

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;

    const wasActive = activeAnalysisId === deleteTargetId;
    const remaining = historico.filter((entry) => entry.id !== deleteTargetId);

    try {
      await deleteMutation.mutateAsync(deleteTargetId);
      setDeleteTargetId(null);

      if (wasActive) {
        if (remaining.length > 0) {
          setDisplayedText(remaining[0].conteudo);
          setDisplayedBriefing(remaining[0].perguntasBriefing);
          setActiveAnalysisId(remaining[0].id);
        } else {
          setDisplayedText('');
          setDisplayedBriefing(null);
          setActiveAnalysisId(null);
        }
      }
    } catch {
      // toast handled in mutation
    }
  };

  const loading = mediaLoading;
  const analyzeButtonDisabled =
    isBusy || selectedKeys.size === 0 || !aiConfig.ativo || !aiConfig.apiKeyConfigured;

  const previewContent = displayedText;

  const analyzeButtonLabel = isBusy ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Analisando…
    </>
  ) : (
    <>
      <Sparkles className="h-4 w-4 mr-2" />
      Analisar com IA
    </>
  );

  const galleryGridClassName =
    'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4';

  const handleConfirmDeleteRender = useCallback(async () => {
    if (!renderDeleteTarget) return;
    const renderId = resolveAiRenderIdFromAttachment({
      id: renderDeleteTarget.id,
      fileUrl: renderDeleteTarget.fileUrl,
      fileName: renderDeleteTarget.label,
    });
    const linkedRender = renderId
      ? renderHistorico.find((entry) => entry.id === renderId)
      : null;

    if (!linkedRender) {
      toast.error('Não foi possível excluir esta renderização');
      setRenderDeleteTarget(null);
      return;
    }

    try {
      await deleteRenderMutation.mutateAsync(linkedRender);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(renderDeleteTarget.key);
        return next;
      });
      setRenderDeleteTarget(null);
    } catch {
      // toast no hook
    }
  }, [deleteRenderMutation, renderDeleteTarget, renderHistorico]);

  const renderMediaGalleryGrid = (
    gridItems: LeadAIMediaItem[] = visibleGalleryItems,
    gridClassName?: string,
  ) => (
    <div className={cn(galleryGridClassName, gridClassName)}>
      {gridItems.map((item, index) => (
        <MediaSelectCard
          key={item.key}
          item={item}
          index={index}
          selected={selectedKeys.has(item.key)}
          onChange={(checked) => setItemSelected(item.key, checked)}
          onExpand={() => setPreviewItem(item)}
          onDelete={isAiRenderMediaItem(item) ? () => setRenderDeleteTarget(item) : undefined}
          isDeleting={deleteRenderMutation.isPending && renderDeleteTarget?.key === item.key}
        />
      ))}
    </div>
  );

  const renderGalleryBrowser = (gridClassName?: string) => (
    <div className="space-y-3">
      {items.length > 0 && (
        <LeadAIMediaFolderShelf
          folders={folderBrowse.folders}
          coverSource={folderBrowse.coverSource}
          folderCounts={folderBrowse.folderCounts}
          unfiledCount={folderBrowse.unfiledCount}
          showFolderShelf={folderBrowse.showFolderShelf}
          viewingRoot={folderBrowse.viewingRoot}
          folderLabel={folderBrowse.folderLabel}
          searchQuery={folderBrowse.searchQuery}
          onSearchChange={folderBrowse.setSearchQuery}
          onOpenFolder={folderBrowse.openFolder}
          onOpenUnfiled={folderBrowse.openUnfiled}
          onGoRoot={folderBrowse.goRoot}
          searchPlaceholder="Buscar foto ou PDF do lead…"
        />
      )}

      {folderBrowse.showFolderShelf ? (
        <p className="px-1 text-center text-[11px] text-cream-muted">
          Abra uma pasta — ou busque pelo nome do arquivo.
        </p>
      ) : visibleGalleryItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gold-border-subtle/30 bg-mahogany-muted/30 px-4 py-8 text-center">
          <Search className="mx-auto mb-2 h-5 w-5 text-cream-faint opacity-70" />
          <p className="text-sm text-cream-muted">
            {folderBrowse.isSearching
              ? 'Nenhum arquivo com esse nome.'
              : 'Esta pasta não tem imagens ou PDFs para análise.'}
          </p>
        </div>
      ) : (
        renderMediaGalleryGrid(visibleGalleryItems, gridClassName)
      )}
    </div>
  );

  return (
    <div className="space-y-6 py-1">
      {isBusy && (
        <div className="flex items-start gap-2 rounded-xl border border-gold/35 bg-gold/10 px-3 py-2.5 text-sm text-cream-secondary">
          <Loader2 className="h-4 w-4 shrink-0 mt-0.5 animate-spin text-gold" />
          <p>
            A IA está analisando em segundo plano. Você pode fechar este card, trocar de aba ou
            navegar pelo sistema — avisaremos quando terminar.
          </p>
        </div>
      )}

      {!aiConfig.ativo && !configLoading && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            A análise de IA está desativada nas configurações do pipeline. Ative em{' '}
            <strong>Pipeline → Configurações → Configuração IA</strong>.
          </p>
        </div>
      )}

      {aiConfig.ativo && !aiConfig.apiKeyConfigured && !configLoading && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            A chave da API OpenAI ainda não foi configurada. O administrador deve cadastrá-la em{' '}
            <strong>Pipeline → Configurações → Configuração IA</strong>.
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
                  Galeria do lead
                </span>
              </div>
              <Label className="text-sm font-medium text-foreground">
                Selecione fotos e PDFs para análise
              </Label>
              <p className="text-xs text-cream-muted">
                Pastas do lead · {selectedKeys.size} selecionado(s) · até{' '}
                {PIPELINE_LEAD_AI_MAX_ITEMS_PER_ANALYSIS} arquivos · até{' '}
                {PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS} páginas/imagens por análise
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setGalleryFullscreenOpen(true)}
                disabled={items.length === 0 || loading}
                className="border-gold-border-subtle/40 bg-mahogany-muted/40 hover:bg-mahogany-soft/60"
              >
                <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                Tela cheia
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={items.length === 0}
                className="border-gold-border-subtle/40 bg-mahogany-muted/40 hover:bg-mahogany-soft/60"
              >
                Selecionar todas
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSelection}
                disabled={selectedKeys.size === 0}
                className="border-gold-border-subtle/40 bg-mahogany-muted/40 hover:bg-mahogany-soft/60"
              >
                Limpar
              </Button>
              <Button type="button" size="sm" onClick={handleAnalyze} disabled={analyzeButtonDisabled}>
                {analyzeButtonLabel}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <ScrollArea
              className="h-[min(30rem,42vh)] w-full rounded-lg border border-gold-border-subtle/15 bg-mahogany-muted/20"
            >
              <div className={cn(galleryGridClassName, 'p-1 pr-3')}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] rounded-xl bg-mahogany-muted/50" />
                ))}
              </div>
            </ScrollArea>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gold-border-subtle/30 bg-mahogany-muted/30 px-4 py-10 text-center">
              <ImageIcon className="mx-auto mb-3 h-8 w-8 text-cream-faint opacity-60" />
              <p className="text-sm text-cream-muted">
                Nenhuma imagem ou PDF disponível neste lead. Adicione anexos, fotos na lousa ou
                orçamentos com imagens.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[min(30rem,42vh)] w-full rounded-lg border border-gold-border-subtle/15 bg-mahogany-muted/10">
              {mediaRefreshing && (
                <div className="flex items-center gap-2 px-3 py-2 text-[10px] text-cream-muted border-b border-gold-border-subtle/15">
                  <Loader2 className="h-3 w-3 animate-spin text-gold" aria-hidden />
                  Atualizando mais imagens do lead…
                </div>
              )}
              <div className="p-3 pr-3 sm:p-4">{renderGalleryBrowser()}</div>
            </ScrollArea>
          )}

          {selectedKeys.size > 0 && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-cream-secondary">
                {selectedKeys.size === 1
                  ? '1 imagem selecionada — pronta para análise'
                  : `${selectedKeys.size} imagens selecionadas — prontas para análise`}
              </p>
              <Button type="button" onClick={handleAnalyze} disabled={analyzeButtonDisabled} className="shrink-0">
                {analyzeButtonLabel}
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label className="text-sm font-medium">Análise IA</Label>
            {activeAnalysisDate && (
              <p className="text-xs text-cream-muted mt-0.5">Gerada em {activeAnalysisDate}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {previewContent && !isBusy && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExportRelatorioOpen(true)}
                  className="h-8 border-gold-border-subtle/40 text-xs"
                >
                  <FileDown className="h-3.5 w-3.5 mr-1.5" />
                  Exportar PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIncluirApresentacaoOpen(true)}
                  className="h-8 border-gold-border-subtle/40 text-xs"
                >
                  <Presentation className="h-3.5 w-3.5 mr-1.5" />
                  Incluir na apresentação
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleCopy()}
                  className="h-8 px-2 text-cream-muted hover:text-primary"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="sr-only">Copiar</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFullscreenOpen(true)}
                  disabled={!displayedText}
                  className="h-8 border-gold-border-subtle/40 text-xs"
                >
                  <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                  Tela cheia
                </Button>
              </>
            )}
          </div>
        </div>

        {(previewContent || isBusy || displayedMediaItems.length > 0) && (
          <LeadAIAnalysisReader
            items={displayedMediaItems}
            content={isBusy ? '' : previewContent}
            briefingContent={isBusy ? null : displayedBriefing}
            isLoading={isBusy}
            variant="embedded"
            leadId={leadId}
            leadName={leadName}
            leadOrigin={leadOrigin}
            analiseId={activeAnalysisId}
          />
        )}

        {!previewContent && !isBusy && displayedMediaItems.length === 0 && (
          <div className="rounded-xl border border-dashed border-gold-border-subtle/25 bg-mahogany-muted/20 px-4 py-10 text-center">
            <p className="text-sm italic text-cream-muted">
              O resultado da análise aparecerá aqui após clicar em &quot;Analisar com IA&quot;.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <History className="h-4 w-4 text-gold" />
          Histórico de análises
        </Label>
        {historicoLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : historico.length === 0 ? (
          <p className="text-sm text-cream-muted">Nenhuma análise realizada ainda.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {historico.map((entry) => {
              const isActive =
                displayedText === entry.conteudo && activeAnalysisId === entry.id;
              const isDeleting = deleteMutation.isPending && deleteTargetId === entry.id;

              return (
                <li key={entry.id}>
                  <div
                    className={cn(
                      'group flex items-stretch gap-1 rounded-xl border transition-all',
                      'border-gold-border-subtle/20 bg-mahogany-card/40 hover:border-gold-border/40 hover:bg-mahogany-soft/40',
                      isActive && 'border-gold/50 bg-gold/10 shadow-sm shadow-gold/5',
                    )}
                  >
                    <button
                      type="button"
                  onClick={() => {
                    setDisplayedText(entry.conteudo);
                    setDisplayedBriefing(entry.perguntasBriefing);
                    setActiveAnalysisId(entry.id);
                  }}
                      className="min-w-0 flex-1 px-3 py-2.5 text-left text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate text-cream-secondary">
                          {format(new Date(entry.criadoEm), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-gold-border-subtle/40 text-[10px]"
                        >
                          {entry.itensSelecionados.length} item(ns)
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-cream-muted">
                        {entry.conteudo.slice(0, 120)}
                        {entry.conteudo.length > 120 ? '…' : ''}
                      </p>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={deleteMutation.isPending}
                      onClick={() => setDeleteTargetId(entry.id)}
                      className={cn(
                        'my-1.5 mr-1.5 h-9 w-9 shrink-0 rounded-lg text-cream-muted',
                        'opacity-70 hover:bg-destructive/15 hover:text-destructive hover:opacity-100',
                        'focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
                      )}
                      aria-label={`Excluir análise de ${format(new Date(entry.criadoEm), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <IncluirAnaliseNaApresentacaoDialog
        open={incluirApresentacaoOpen}
        onOpenChange={setIncluirApresentacaoOpen}
        leadId={leadId}
        relatorio={displayedText}
        returnTo={returnToLeadCard}
      />

      <LeadAIRelatorioExportDialog
        open={exportRelatorioOpen}
        onOpenChange={setExportRelatorioOpen}
        initialContent={displayedText}
        initialBriefing={displayedBriefing}
        leadName={leadName}
        leadId={leadId}
      />

      <LeadAIImageFullscreenDialog
        open={!!previewItem && previewItem.kind !== 'pdf'}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
        src={previewItem?.fileUrl ?? previewItem?.thumbnailUrl ?? null}
        alt={previewItem?.label ?? 'Imagem'}
        title={previewItem?.label ?? 'Visualização'}
        subtitle={previewItem ? sourceMeta(previewItem).label : undefined}
        outputUrl={previewItem?.fileUrl ?? previewItem?.thumbnailUrl ?? null}
      />

      <Dialog
        open={!!previewItem && previewItem.kind === 'pdf'}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
      >
        <DialogContent className="max-w-4xl border-gold-border-subtle/30 bg-mahogany-panel p-3 sm:p-4 [&>button.absolute]:hidden">
          <DialogTitle className="sr-only">{previewItem?.label ?? 'Visualizar PDF'}</DialogTitle>
          {previewItem?.kind === 'pdf' && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{previewItem.label}</p>
                  <p className="text-xs text-cream-muted">{sourceMeta(previewItem).label}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-cream-muted hover:text-foreground"
                >
                  Fechar
                </button>
              </div>
              <div className="relative max-h-[min(70vh,640px)] overflow-auto rounded-lg border border-gold-border-subtle/20 bg-black/20">
                <div className="relative aspect-[3/4] min-h-[280px] w-full">
                  <PdfSelectThumbnail item={previewItem} />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <LeadAIMediaGalleryFullscreenDialog
        open={galleryFullscreenOpen}
        onOpenChange={setGalleryFullscreenOpen}
        leadName={leadName}
        selectedCount={selectedKeys.size}
        maxItems={PIPELINE_LEAD_AI_MAX_ITEMS_PER_ANALYSIS}
        maxImages={PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onAnalyze={handleAnalyze}
        analyzeDisabled={analyzeButtonDisabled}
        analyzeLabel={analyzeButtonLabel}
        itemsEmpty={items.length === 0}
      >
        {renderGalleryBrowser()}
      </LeadAIMediaGalleryFullscreenDialog>

      <LeadAIAnalysisFullscreenDialog
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        title={leadName ? `Análise — ${leadName}` : 'Análise IA'}
        subtitle={activeAnalysisDate ? `Gerada em ${activeAnalysisDate}` : undefined}
        content={isBusy ? '' : displayedText}
        briefingContent={isBusy ? null : displayedBriefing}
        mediaItems={displayedMediaItems}
        isLoading={isBusy}
        copied={copied}
        onCopy={() => void handleCopy()}
        leadId={leadId}
        leadName={leadName}
        leadOrigin={leadOrigin}
        analiseId={activeAnalysisId}
      />

      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent className="border-gold-border-subtle/30 bg-mahogany-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir análise do histórico?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-cream-muted">
                <p>
                  Esta ação remove permanentemente a análise de{' '}
                  <strong className="text-foreground">
                    {deleteTargetEntry
                      ? format(new Date(deleteTargetEntry.criadoEm), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })
                      : '—'}
                  </strong>
                  .
                </p>
                <p>O texto e as referências de imagens desta entrada serão apagados.</p>
              </div>
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
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo…
                </>
              ) : (
                'Excluir análise'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!renderDeleteTarget}
        onOpenChange={(open) => !open && !deleteRenderMutation.isPending && setRenderDeleteTarget(null)}
      >
        <AlertDialogContent className="border-gold-border-subtle/30 bg-mahogany-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir renderização?</AlertDialogTitle>
            <AlertDialogDescription>
              {renderDeleteTarget?.label
                ? `“${renderDeleteTarget.label}” será removida dos anexos e do histórico do lead.`
                : 'Esta renderização será removida dos anexos e do histórico do lead.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRenderMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteRenderMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteRender();
              }}
            >
              {deleteRenderMutation.isPending ? 'Excluindo…' : 'Excluir imagem'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
