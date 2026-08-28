import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { LeadAIFormattedContent } from '@/lib/lead-ai-formatted-content';
import { LeadSkyChatPanel } from '@/components/leads/LeadSkyChatPanel';
import { IRIS_SKY_AGENT } from '@/lib/iris-sky-agent';
import type { LeadAIMediaItem } from '@/lib/lead-ai-media-sources';
import {
  AnalysisMediaPlaceholder,
  frameBadgeLabel,
  PdfPagesLoadingState,
  useAnalysisMediaImage,
  useAnalysisMediaThumb,
} from '@/components/leads/lead-ai-analysis-media-utils';
import {
  type AnalysisViewerFrame,
  useAnalysisViewerFrames,
} from '@/lib/lead-ai-media-viewer';
import { useInlineImageZoom, useZoomContainerBinding } from '@/components/leads/use-inline-image-zoom';
import { useLeadAIMediaItems } from '@/hooks/useLeadAIMediaItems';
import { useSendLeadSkyChatMessage, useLeadSkyChatMessages } from '@/hooks/useLeadSkyChat';
import {
  buildIrisSpotVisionPayload,
  getNormalizedImageClickCoords,
  type IrisSpotCoords,
} from '@/lib/iris-spot-vision';
import {
  extractSpotShortLabel,
  findLatestSpotFromMessages,
  type IrisActiveSpot,
} from '@/lib/iris-spot-session';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  FileDown,
  FileText,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  MessageCircleQuestion,
  MessagesSquare,
} from 'lucide-react';
import { LeadAIRelatorioExportDialog } from '@/components/leads/LeadAIRelatorioExportDialog';
import { toast } from 'sonner';
import {
  LeadAIAnalysisImageThinkingOverlay,
  LeadAIAnalysisThinkingState,
} from '@/components/leads/LeadAIAnalysisThinkingState';

interface LeadAIAnalysisReaderProps {
  items: LeadAIMediaItem[];
  content: string;
  briefingContent?: string | null;
  isLoading?: boolean;
  variant?: 'embedded' | 'fullscreen';
  className?: string;
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  analiseId?: string | null;
  onPanelModeChange?: (mode: TextPanelMode) => void;
}

type TextPanelMode = 'report' | 'chat';

function FilmstripThumb({
  frame,
  active,
  onSelect,
}: {
  frame: AnalysisViewerFrame;
  active: boolean;
  onSelect: () => void;
}) {
  const { src } = useAnalysisMediaThumb(frame.item, frame.pdfPageNumber);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Ver ${frame.displayLabel}`}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition-all duration-300 snap-start',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60',
        active
          ? 'border-gold ring-2 ring-gold/40 scale-105 shadow-lg shadow-gold/15'
          : 'border-gold-border-subtle/30 opacity-75 hover:border-gold/40 hover:opacity-100',
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
      ) : (
        <div className="flex h-full items-center justify-center bg-mahogany-muted/60">
          <FileText className="h-4 w-4 text-cream-faint" />
        </div>
      )}
      {frame.pdfPageNumber && (
        <span className="absolute bottom-0 inset-x-0 bg-black/65 py-0.5 text-center text-[9px] font-medium tabular-nums text-cream-secondary">
          {frame.pdfPageNumber}
        </span>
      )}
      {active && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />
      )}
    </button>
  );
}

function ImageStage({
  frame,
  index,
  total,
  onPrev,
  onNext,
  variant,
  isAnalyzing = false,
  spotPickMode = false,
  spotMarker = null,
  isSpotAnalyzing = false,
  onSpotPick,
}: {
  frame: AnalysisViewerFrame;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  variant: 'embedded' | 'fullscreen';
  isAnalyzing?: boolean;
  spotPickMode?: boolean;
  spotMarker?: IrisSpotCoords | null;
  isSpotAnalyzing?: boolean;
  onSpotPick?: (coords: IrisSpotCoords) => void;
}) {
  const { item, pdfPageNumber, displayLabel } = frame;
  const { src, isLoading } = useAnalysisMediaImage(item, pdfPageNumber);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragMovedRef = useRef(false);
  const {
    scale,
    position,
    resetView,
    zoomIn,
    zoomOut,
    toggleZoom,
    bindZoomContainer,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isZoomed,
    canZoomIn,
    canZoomOut,
  } = useInlineImageZoom(src);
  const canNavigate = total > 1;
  const canZoom = !!src && !isLoading && !spotPickMode;
  const containerRef = useZoomContainerBinding(bindZoomContainer, canZoom);
  const badge = frameBadgeLabel(frame);

  const handleImagePointerDown = useCallback(() => {
    dragMovedRef.current = false;
  }, []);

  const handleImagePointerMove = useCallback(() => {
    if (scale > 1) dragMovedRef.current = true;
  }, [scale]);

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!spotPickMode || !onSpotPick || !imgRef.current || dragMovedRef.current) return;
      e.stopPropagation();
      const coords = getNormalizedImageClickCoords(imgRef.current, e.clientX, e.clientY);
      if (coords) onSpotPick(coords);
    },
    [onSpotPick, spotPickMode],
  );

  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-1 flex-col overflow-hidden',
        'bg-[radial-gradient(ellipse_at_center,_rgba(242,216,146,0.06)_0%,_transparent_55%)] bg-mahogany-base',
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />

      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="min-w-0 rounded-lg border border-gold-border-subtle/25 bg-mahogany-panel/85 px-3 py-2 backdrop-blur-md">
          <p className="truncate text-sm font-medium text-foreground" title={displayLabel}>
            {displayLabel}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-gold-border-subtle/40 bg-mahogany-muted/60 text-[10px]"
            >
              {badge}
            </Badge>
            {canNavigate && (
              <span className="text-[11px] tabular-nums text-cream-muted">
                {index + 1} de {total}
              </span>
            )}
          </div>
        </div>

        {canZoom && (
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-gold-border-subtle/30 bg-mahogany-panel/85 p-0.5 backdrop-blur-md">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={zoomOut}
              disabled={!canZoomOut}
              className="h-8 w-8 text-cream-muted hover:text-gold"
              aria-label="Diminuir zoom"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <button
              type="button"
              onClick={resetView}
              className="min-w-[3rem] px-1 text-center text-[11px] tabular-nums text-cream-secondary hover:text-gold"
              aria-label="Restaurar zoom"
              title="Restaurar zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={zoomIn}
              disabled={!canZoomIn}
              className="h-8 w-8 text-cream-muted hover:text-gold"
              aria-label="Aumentar zoom"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            {isZoomed && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={resetView}
                className="h-8 w-8 text-cream-muted hover:text-gold"
                aria-label="Restaurar visualização"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {isAnalyzing && <LeadAIAnalysisImageThinkingOverlay />}
      {isSpotAnalyzing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-mahogany-deep/40 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-mahogany-panel/90 px-4 py-2.5 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-gold" />
            <span className="text-xs font-medium text-cream-secondary">Íris identificando o ponto…</span>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden touch-none',
          variant === 'embedded' ? 'min-h-[200px]' : 'min-h-[280px]',
          spotPickMode
            ? 'cursor-crosshair'
            : isZoomed
              ? 'cursor-grab active:cursor-grabbing'
              : 'cursor-zoom-in',
        )}
        onPointerDown={canZoom ? handlePointerDown : spotPickMode ? handleImagePointerDown : undefined}
        onPointerMove={canZoom ? handlePointerMove : spotPickMode ? handleImagePointerMove : undefined}
        onPointerUp={canZoom ? handlePointerUp : undefined}
        onPointerCancel={canZoom ? handlePointerUp : undefined}
        onDoubleClick={canZoom ? toggleZoom : undefined}
      >
        <div className="flex h-full w-full items-center justify-center p-4 pt-2 sm:p-6 sm:pt-3">
          {isLoading ? (
            <AnalysisMediaPlaceholder
              item={item}
              message={item.kind === 'pdf' ? 'Carregando página…' : undefined}
            />
          ) : src ? (
            <div className="relative inline-block max-h-full max-w-full">
              <img
                ref={imgRef}
                key={src}
                src={src}
                alt={displayLabel}
                draggable={false}
                onClick={handleImageClick}
                className={cn(
                  'max-h-full max-w-full select-none object-contain shadow-2xl shadow-black/50',
                  'animate-in fade-in zoom-in-95 duration-500 fill-mode-both',
                  'rounded-sm border border-white/5 transition-transform duration-150 ease-out will-change-transform',
                )}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                }}
                loading="eager"
              />
              {spotMarker && (
                <div
                  className="pointer-events-none absolute z-10"
                  style={{
                    left: `${spotMarker.normalizedX * 100}%`,
                    top: `${spotMarker.normalizedY * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <span className="relative flex h-5 w-5 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/50 opacity-75" />
                    <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-gold bg-gold/80 shadow-lg shadow-gold/30" />
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-cream-muted">Imagem indisponível</div>
          )}
        </div>
      </div>

      {canNavigate && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onPrev}
            className={cn(
              'absolute left-1 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full sm:left-2 sm:h-10 sm:w-10',
              'border border-gold-border-subtle/30 bg-mahogany-panel/80 text-cream-secondary backdrop-blur-sm',
              'hover:border-gold/50 hover:bg-mahogany-elevated hover:text-gold',
            )}
            aria-label="Referência anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onNext}
            className={cn(
              'absolute right-1 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full sm:right-2 sm:h-10 sm:w-10',
              'border border-gold-border-subtle/30 bg-mahogany-panel/80 text-cream-secondary backdrop-blur-sm',
              'hover:border-gold/50 hover:bg-mahogany-elevated hover:text-gold',
            )}
            aria-label="Próxima referência"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}

      {spotPickMode ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-1 z-10 flex items-center justify-center gap-1.5 text-center text-[10px] text-gold/90">
          <Crosshair className="h-3 w-3" aria-hidden />
          Clique em um ponto da imagem para a Íris analisar
        </p>
      ) : canZoom ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-1 z-10 text-center text-[10px] text-cream-faint/80">
          Pinça ou scroll para zoom · duplo toque/clique · arraste quando ampliado
        </p>
      ) : null}
    </div>
  );
}

function ImageStageWithFilmstrip({
  frames,
  isLoadingPages,
  activeIndex,
  onSelect,
  variant,
  isAnalyzing = false,
  spotPickMode = false,
  spotMarker = null,
  isSpotAnalyzing = false,
  onSpotPick,
}: {
  frames: AnalysisViewerFrame[];
  isLoadingPages: boolean;
  activeIndex: number;
  onSelect: (index: number) => void;
  variant: 'embedded' | 'fullscreen';
  isAnalyzing?: boolean;
  spotPickMode?: boolean;
  spotMarker?: IrisSpotCoords | null;
  isSpotAnalyzing?: boolean;
  onSpotPick?: (coords: IrisSpotCoords) => void;
}) {
  const frame = frames[activeIndex];
  const total = frames.length;

  const goPrev = useCallback(() => {
    onSelect(activeIndex <= 0 ? total - 1 : activeIndex - 1);
  }, [activeIndex, onSelect, total]);

  const goNext = useCallback(() => {
    onSelect(activeIndex >= total - 1 ? 0 : activeIndex + 1);
  }, [activeIndex, onSelect, total]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (total <= 1) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, total]);

  if (isLoadingPages && total === 0) {
    return <PdfPagesLoadingState className="h-full min-h-[240px]" />;
  }

  if (!frame) return null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ImageStage
        frame={frame}
        index={activeIndex}
        total={total}
        onPrev={goPrev}
        onNext={goNext}
        variant={variant}
        isAnalyzing={isAnalyzing}
        spotPickMode={spotPickMode}
        spotMarker={spotMarker}
        isSpotAnalyzing={isSpotAnalyzing}
        onSpotPick={onSpotPick}
      />

      {total > 1 && (
        <div className="shrink-0 border-t border-gold-border-subtle/20 bg-mahogany-elevated/80 px-3 py-2.5 backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/80">
              {spotPickMode ? 'Anexos do lead' : 'Referências analisadas'}
            </p>
            <span className="text-[10px] tabular-nums text-cream-muted">
              {activeIndex + 1}/{total}
            </span>
          </div>
          <div
            className="flex gap-2 overflow-x-auto pb-0.5 snap-x snap-mandatory scrollbar-thin"
            role="tablist"
            aria-label="Navegar referências"
          >
            {(() => {
              const maxVisible = 24;
              const half = Math.floor(maxVisible / 2);
              const start = total <= maxVisible ? 0 : Math.max(0, Math.min(activeIndex - half, total - maxVisible));
              const end = total <= maxVisible ? total : start + maxVisible;
              const visibleFrames = frames.slice(start, end);

              return visibleFrames.map((thumbFrame, offset) => {
                const i = start + offset;
                return (
                  <FilmstripThumb
                    key={thumbFrame.key}
                    frame={thumbFrame}
                    active={i === activeIndex}
                    onSelect={() => onSelect(i)}
                  />
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function TextPanel({
  content,
  briefingContent,
  isLoading,
  variant,
  leadId,
  leadName,
  leadOrigin,
  analiseId,
  mode,
  onModeChange,
  onExportPdf,
  canExportPdf,
  externalIsSending = false,
  activeSpot = null,
  onClearActiveSpot,
  registerChatFocus,
}: {
  content: string;
  briefingContent?: string | null;
  isLoading?: boolean;
  variant: 'embedded' | 'fullscreen';
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  analiseId?: string | null;
  mode: TextPanelMode;
  onModeChange: (mode: TextPanelMode) => void;
  onExportPdf?: () => void;
  canExportPdf?: boolean;
  externalIsSending?: boolean;
  activeSpot?: IrisActiveSpot | null;
  onClearActiveSpot?: () => void;
  registerChatFocus?: (focus: (() => void) | null) => void;
}) {
  const panelRootRef = useRef<HTMLDivElement>(null);
  const [chatPanelReady, setChatPanelReady] = useState(false);
  const hasAnalysis = Boolean(content?.trim()) && !isLoading;

  useEffect(() => {
    if (mode !== 'chat') {
      setChatPanelReady(false);
      return;
    }
    const frameId = requestAnimationFrame(() => setChatPanelReady(true));
    return () => cancelAnimationFrame(frameId);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'chat' || variant !== 'embedded') return;
    const frameId = requestAnimationFrame(() => {
      panelRootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frameId);
  }, [mode, variant]);

  return (
    <div ref={panelRootRef} className="flex h-full min-h-0 flex-col bg-mahogany-panel/40">
      <div className="shrink-0 border-b border-gold-border-subtle/20 px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="inline-flex rounded-lg border border-gold-border-subtle/25 bg-mahogany-muted/40 p-0.5"
            role="tablist"
            aria-label="Painel do relatório"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'report'}
              onClick={() => onModeChange('report')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all',
                mode === 'report'
                  ? 'bg-gold/15 text-gold shadow-sm'
                  : 'text-cream-muted hover:text-cream-secondary',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Relatório
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'chat'}
              onClick={() => onModeChange('chat')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all',
                mode === 'chat'
                  ? 'bg-gold/15 text-gold shadow-sm'
                  : 'text-cream-muted hover:text-cream-secondary',
              )}
            >
              <MessagesSquare className="h-3.5 w-3.5" />
              {IRIS_SKY_AGENT.name}
            </button>
          </div>

          {mode === 'report' && (
            <div className="flex flex-wrap items-center gap-2">
              {isLoading ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/60 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold animate-pulse">
                    IA pensando…
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
                    Relatório da IA
                  </span>
                  {canExportPdf && onExportPdf && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onExportPdf}
                      className="h-7 border-gold-border-subtle/40 px-2 text-[10px] uppercase tracking-wide text-cream-muted hover:text-gold"
                    >
                      <FileDown className="mr-1 h-3 w-3" />
                      PDF
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {mode === 'chat' ? (
        chatPanelReady ? (
        <LeadSkyChatPanel
          leadId={leadId}
          analiseId={analiseId}
          leadName={leadName}
          leadOrigin={leadOrigin}
          hasAnalysis={hasAnalysis}
          variant={variant}
          compactHeader
          className="min-h-0 flex-1"
          externalIsSending={externalIsSending}
          activeSpot={activeSpot}
          onClearActiveSpot={onClearActiveSpot}
          registerFocus={registerChatFocus}
        />
        ) : (
          <div className="flex min-h-[200px] flex-1 items-center justify-center px-4">
            <Loader2 className="h-6 w-6 animate-spin text-gold/70" aria-hidden />
            <span className="sr-only">Abrindo Íris Sky…</span>
          </div>
        )
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div
            className={cn(
              isLoading ? 'px-2 py-2 sm:px-3' : 'px-4 py-4 sm:px-6 sm:py-5',
              variant === 'embedded' ? 'max-w-none' : 'max-w-3xl',
            )}
          >
            {isLoading ? (
              <LeadAIAnalysisThinkingState variant={variant} />
            ) : (
              <div className="space-y-6">
                {content ? (
                  <div>
                    <LeadAIFormattedContent
                      content={content}
                      className={cn(variant === 'fullscreen' ? 'text-base leading-relaxed' : 'text-sm')}
                    />
                  </div>
                ) : !briefingContent?.trim() ? (
                  <p className="py-8 text-center text-sm italic text-cream-muted">
                    O relatório aparecerá aqui após a análise.
                  </p>
                ) : null}

                {briefingContent?.trim() && (
                  <section className="rounded-xl border border-gold/25 bg-gold/5 p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2 text-gold">
                      <MessageCircleQuestion className="h-4 w-4" aria-hidden />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                        Perguntas para briefing
                      </span>
                    </div>
                    <LeadAIFormattedContent
                      content={briefingContent}
                      className={cn(
                        'text-sm text-cream-secondary',
                        variant === 'fullscreen' && 'text-base leading-relaxed',
                      )}
                    />
                  </section>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export function LeadAIAnalysisReader({
  items,
  content,
  briefingContent = null,
  isLoading = false,
  variant = 'embedded',
  className,
  leadId,
  leadName,
  leadOrigin,
  analiseId = null,
  onPanelModeChange,
}: LeadAIAnalysisReaderProps) {
  const [panelMode, setPanelMode] = useState<TextPanelMode>('report');
  const [chatMediaExpanded, setChatMediaExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [spotMarker, setSpotMarker] = useState<IrisSpotCoords | null>(null);
  const [isSpotAnalyzing, setIsSpotAnalyzing] = useState(false);
  const [activeSpot, setActiveSpot] = useState<IrisActiveSpot | null>(null);
  const chatTextareaFocusRef = useRef<(() => void) | null>(null);
  const userClearedSpotRef = useRef(false);
  const { data: chatMessages = [] } = useLeadSkyChatMessages(panelMode === 'chat' ? leadId : null);

  useEffect(() => {
    if (panelMode !== 'chat') {
      setChatMediaExpanded(false);
      return;
    }

    const expandTimer = window.setTimeout(() => {
      startTransition(() => setChatMediaExpanded(true));
    }, 120);

    return () => window.clearTimeout(expandTimer);
  }, [panelMode]);

  const { items: allLeadMediaItems, isLoading: allMediaLoading } = useLeadAIMediaItems(
    panelMode === 'chat' && chatMediaExpanded ? leadId : null,
  );

  const displayItems = useMemo(() => {
    if (panelMode !== 'chat') return items;
    if (chatMediaExpanded && allLeadMediaItems.length > 0) return allLeadMediaItems;
    return items;
  }, [panelMode, chatMediaExpanded, allLeadMediaItems, items]);

  const { frames, isLoadingPages } = useAnalysisViewerFrames(displayItems, {
    pdfFirstPageOnly: panelMode === 'chat',
  });
  const hasMedia = displayItems.length > 0;
  const canExportPdf = Boolean(content?.trim() || briefingContent?.trim()) && !isLoading;
  const sendSpotMessage = useSendLeadSkyChatMessage();
  const hasAnalysis = Boolean(content?.trim()) && !isLoading;
  const chatEnabled = hasAnalysis && panelMode === 'chat';

  const handlePanelModeChange = useCallback(
    (mode: TextPanelMode) => {
      startTransition(() => {
        setPanelMode(mode);
        setSpotMarker(null);
        if (mode !== 'chat') {
          setActiveSpot(null);
          userClearedSpotRef.current = false;
        }
      });
      onPanelModeChange?.(mode);
    },
    [onPanelModeChange],
  );

  useEffect(() => {
    if (activeIndex >= frames.length) setActiveIndex(0);
  }, [activeIndex, frames.length]);

  useEffect(() => {
    setActiveIndex(0);
    setSpotMarker(null);
    setActiveSpot(null);
    userClearedSpotRef.current = false;
  }, [leadId]);

  useEffect(() => {
    if (panelMode !== 'chat' || activeSpot || userClearedSpotRef.current) return;
    const restored = findLatestSpotFromMessages(chatMessages);
    if (restored) setActiveSpot(restored);
  }, [activeSpot, chatMessages, panelMode]);

  const activeFrame = frames[activeIndex] ?? null;
  const { src: activeImageSrc } = useAnalysisMediaImage(
    activeFrame?.item ?? null,
    activeFrame?.pdfPageNumber,
  );

  const handleSpotPick = useCallback(
    async (coords: IrisSpotCoords) => {
      if (!chatEnabled || !activeFrame || !activeImageSrc || isSpotAnalyzing || sendSpotMessage.isPending) {
        return;
      }

      setSpotMarker(coords);
      setIsSpotAnalyzing(true);

      try {
        let visionPayload;
        try {
          visionPayload = await buildIrisSpotVisionPayload(activeImageSrc, coords);
        } catch (cropError) {
          const message =
            cropError instanceof Error ? cropError.message : 'Não foi possível ler esta imagem';
          toast.error('Não foi possível preparar a imagem', { description: message });
          return;
        }

        await sendSpotMessage.mutateAsync({
          leadId,
          analiseId,
          leadName,
          leadOrigin,
          message: '',
          identifySpotOnly: true,
          spotContext: {
            mediaLabel: activeFrame.displayLabel,
            normalizedX: visionPayload.normalizedX,
            normalizedY: visionPayload.normalizedY,
            cropBase64: visionPayload.cropBase64,
            pdfPageNumber: activeFrame.pdfPageNumber,
          },
        }).then((result) => {
          if (result.spotDescription) {
            userClearedSpotRef.current = false;
            const shortLabel =
              result.shortLabel || extractSpotShortLabel(result.spotDescription) || activeFrame.displayLabel;
            setActiveSpot({
              mediaLabel: activeFrame.displayLabel,
              normalizedX: visionPayload.normalizedX,
              normalizedY: visionPayload.normalizedY,
              cropBase64: visionPayload.cropBase64,
              pdfPageNumber: activeFrame.pdfPageNumber,
              spotDescription: result.spotDescription,
              shortLabel,
            });
            window.setTimeout(() => chatTextareaFocusRef.current?.(), 150);
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível analisar o ponto';
        toast.error('Falha ao identificar o ponto', { description: message });
      } finally {
        setIsSpotAnalyzing(false);
      }
    },
    [
      activeFrame,
      activeImageSrc,
      analiseId,
      chatEnabled,
      isSpotAnalyzing,
      leadId,
      leadName,
      leadOrigin,
      sendSpotMessage,
    ],
  );

  const textPanel = (
    <TextPanel
      content={content}
      briefingContent={briefingContent}
      isLoading={isLoading}
      variant={variant}
      leadId={leadId}
      leadName={leadName}
      leadOrigin={leadOrigin}
      analiseId={analiseId}
      mode={panelMode}
      onModeChange={handlePanelModeChange}
      canExportPdf={canExportPdf}
      onExportPdf={() => setExportDialogOpen(true)}
      externalIsSending={isSpotAnalyzing || sendSpotMessage.isPending}
      activeSpot={activeSpot}
      onClearActiveSpot={() => {
        userClearedSpotRef.current = true;
        setActiveSpot(null);
        setSpotMarker(null);
      }}
      registerChatFocus={(focus) => {
        chatTextareaFocusRef.current = focus;
      }}
    />
  );

  const exportDialog = (
    <LeadAIRelatorioExportDialog
      open={exportDialogOpen}
      onOpenChange={setExportDialogOpen}
      initialContent={content}
      initialBriefing={briefingContent}
      leadName={leadName}
      leadId={leadId}
    />
  );

  if (!hasMedia) {
    return (
      <>
        <div
          className={cn(
            'overflow-hidden rounded-xl border border-gold-border-subtle/25 bg-mahogany-muted/20',
            variant === 'embedded' && 'max-h-[420px]',
            className,
          )}
        >
          {textPanel}
        </div>
        {exportDialog}
      </>
    );
  }

  const shellClass = cn(
    'overflow-hidden rounded-xl border border-gold-border-subtle/30 bg-mahogany-card/50 shadow-inner shadow-black/10',
    variant === 'embedded' ? 'h-[min(520px,72vh)]' : 'h-full min-h-0',
    className,
  );

  const imagePanel = (
    <ImageStageWithFilmstrip
      frames={frames}
      isLoadingPages={isLoadingPages || (panelMode === 'chat' && allMediaLoading)}
      activeIndex={activeIndex}
      onSelect={(index) => {
        setActiveIndex(index);
        setSpotMarker(null);
        userClearedSpotRef.current = true;
        setActiveSpot(null);
      }}
      variant={variant}
      isAnalyzing={isLoading}
      spotPickMode={chatEnabled}
      spotMarker={spotMarker}
      isSpotAnalyzing={isSpotAnalyzing}
      onSpotPick={(coords) => void handleSpotPick(coords)}
    />
  );

  return (
    <>
      <div className={shellClass}>
        <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
          <ResizablePanel defaultSize={52} minSize={35} maxSize={70}>
            {imagePanel}
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="bg-gold-border-subtle/30 aria-[orientation=horizontal]:w-1.5 hover:bg-gold/30 transition-colors"
          />
          <ResizablePanel defaultSize={48} minSize={30}>
            {textPanel}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      {exportDialog}
    </>
  );
}
