import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useInlineImageZoom, useZoomContainerBinding } from '@/components/leads/use-inline-image-zoom';
import { LeadAIImageFullscreenDialog } from '@/components/leads/LeadAIImageFullscreenDialog';
import { LeadAIRenderDownloadMenu } from '@/components/leads/LeadAIRenderDownloadMenu';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Pencil, ImageIcon, Layers, Link2, Link2Off, Maximize2, Minus, Plus, RotateCcw, Trash2, Wand2, X } from 'lucide-react';

interface ComparePanelProps {
  src: string | null;
  alt: string;
  label: string;
  sublabel: string;
  variant: 'before' | 'after';
  scale: number;
  position: { x: number; y: number };
  bindZoomContainer: (el: HTMLDivElement) => () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
  isZoomed: boolean;
  onViewSingle?: () => void;
}

function ComparePanel({
  src,
  alt,
  label,
  sublabel,
  variant,
  scale,
  position,
  bindZoomContainer,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
  isZoomed,
  onViewSingle,
}: ComparePanelProps) {
  const isAfter = variant === 'after';
  const containerRef = useZoomContainerBinding(bindZoomContainer, !!src);

  return (
    <div
      className={cn(
        'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        'bg-[radial-gradient(ellipse_at_center,_rgba(242,216,146,0.05)_0%,_transparent_60%)] bg-mahogany-base',
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />

      <div
        className={cn(
          'relative z-10 shrink-0 border-b px-4 py-3 backdrop-blur-md',
          isAfter
            ? 'border-gold/25 bg-gold/10'
            : 'border-gold-border-subtle/25 bg-mahogany-panel/80',
        )}
      >
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-semibold uppercase tracking-[0.16em]',
              isAfter
                ? 'border-gold/40 bg-gold/15 text-gold'
                : 'border-gold-border-subtle/40 bg-mahogany-muted/60 text-cream-muted',
            )}
          >
            {label}
          </Badge>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground" title={sublabel}>
            {sublabel}
          </p>
          {onViewSingle && src && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onViewSingle}
              className="h-7 shrink-0 px-2 text-[10px] text-gold hover:bg-gold/10 hover:text-gold"
            >
              <Maximize2 className="mr-1 h-3 w-3" />
              Tela cheia
            </Button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'group/panel relative min-h-0 flex-1 overflow-hidden touch-none',
          src && !isZoomed ? 'cursor-zoom-in' : '',
          isZoomed ? 'cursor-grab active:cursor-grabbing' : '',
        )}
        onPointerDown={src ? onPointerDown : undefined}
        onPointerMove={src ? onPointerMove : undefined}
        onPointerUp={src ? onPointerUp : undefined}
        onPointerCancel={src ? onPointerUp : undefined}
        onDoubleClick={src ? onDoubleClick : undefined}
      >
        <div className="flex h-full w-full items-center justify-center p-4 sm:p-6">
          {src ? (
            <img
              src={src}
              alt={alt}
              draggable={false}
              className={cn(
                'max-h-full max-w-full select-none object-contain',
                'animate-in fade-in zoom-in-95 duration-500 fill-mode-both',
                'rounded-sm border border-white/5 shadow-2xl shadow-black/60',
                'transition-transform duration-150 ease-out will-change-transform',
                isAfter && 'ring-1 ring-gold/20',
              )}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-cream-faint">
              <ImageIcon className="h-12 w-12 opacity-40" />
              <p className="text-sm italic text-cream-muted">Imagem indisponível</p>
            </div>
          )}
        </div>

        {onViewSingle && src && (
          <Button
            type="button"
            size="sm"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onViewSingle();
            }}
            className={cn(
              'absolute bottom-4 right-4 z-20 h-8 border border-gold/35 bg-mahogany-panel/90 text-xs text-gold backdrop-blur-sm',
              'opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover/panel:opacity-100 sm:focus-visible:opacity-100',
              'hover:bg-gold/10 hover:text-gold',
            )}
          >
            <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
            Tela cheia
          </Button>
        )}
      </div>
    </div>
  );
}

interface LeadAIRenderFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sketchUrl: string | null;
  sketchLabel?: string;
  outputUrl: string | null;
}

export function LeadAIRenderFullscreenDialog({
  open,
  onOpenChange,
  sketchUrl,
  sketchLabel = 'Esboço',
  outputUrl,
}: LeadAIRenderFullscreenDialogProps) {
  const [syncZoom, setSyncZoom] = useState(true);
  const [renderSingleOpen, setRenderSingleOpen] = useState(false);
  const resetKey = open ? `${sketchUrl ?? ''}|${outputUrl ?? ''}` : null;

  const sketchZoom = useInlineImageZoom(syncZoom ? null : sketchUrl);
  const outputZoom = useInlineImageZoom(syncZoom ? null : outputUrl);
  const sharedZoom = useInlineImageZoom(syncZoom ? resetKey : null);

  const activeZoom = syncZoom ? sharedZoom : null;

  const leftScale = activeZoom?.scale ?? sketchZoom.scale;
  const leftPosition = activeZoom?.position ?? sketchZoom.position;
  const rightScale = activeZoom?.scale ?? outputZoom.scale;
  const rightPosition = activeZoom?.position ?? outputZoom.position;

  const toolbarZoom = activeZoom ?? sketchZoom;

  const resetSketchView = sketchZoom.resetView;
  const resetOutputView = outputZoom.resetView;
  const resetSharedView = sharedZoom.resetView;
  const toolbarZoomIn = toolbarZoom.zoomIn;
  const toolbarZoomOut = toolbarZoom.zoomOut;
  const toolbarResetView = toolbarZoom.resetView;

  const handleToggleSync = useCallback(() => {
    setSyncZoom((current) => !current);
    resetSketchView();
    resetOutputView();
    resetSharedView();
  }, [resetOutputView, resetSharedView, resetSketchView]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        toolbarZoomIn();
      }
      if (e.key === '-') {
        e.preventDefault();
        toolbarZoomOut();
      }
      if (e.key === '0') {
        e.preventDefault();
        toolbarResetView();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenChange, open, toolbarResetView, toolbarZoomIn, toolbarZoomOut]);

  useEffect(() => {
    if (!open) return;
    resetSketchView();
    resetOutputView();
    resetSharedView();
  }, [open, resetKey, resetOutputView, resetSharedView, resetSketchView]);

  const bindZoom = (side: 'left' | 'right') => {
    const zoom = syncZoom ? sharedZoom : side === 'left' ? sketchZoom : outputZoom;
    return {
      scale: side === 'left' ? leftScale : rightScale,
      position: side === 'left' ? leftPosition : rightPosition,
      bindZoomContainer: zoom.bindZoomContainer,
      onPointerDown: zoom.handlePointerDown,
      onPointerMove: zoom.handlePointerMove,
      onPointerUp: zoom.handlePointerUp,
      onDoubleClick: zoom.toggleZoom,
      isZoomed: (side === 'left' ? leftScale : rightScale) > 1,
    };
  };

  const leftBind = bindZoom('left');
  const rightBind = bindZoom('right');

  useEffect(() => {
    if (!open) setRenderSingleOpen(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-lead-ai-render-fullscreen=""
        overlayClassName="z-[60]"
        className={cn(
          'fixed left-0 top-0 z-[60] flex h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0',
          'sm:left-1/2 sm:top-1/2 sm:h-[min(96dvh,940px)] sm:w-[min(1400px,calc(100vw-1rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border',
          'border-gold-border-subtle/30 bg-mahogany-panel shadow-2xl shadow-black/60',
          'overflow-visible [&>button.absolute]:hidden',
        )}
      >
        <div className="relative shrink-0 border-b border-gold-border-subtle/30 bg-gradient-to-r from-mahogany-elevated via-mahogany-card to-mahogany-elevated px-4 py-3.5 sm:px-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/55 to-transparent" />
          <DialogHeader className="space-y-0.5 pr-4 text-left sm:pr-52">
            <div className="flex items-center gap-2 text-gold">
              <Wand2 className="h-4 w-4" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">
                Comparação visual
              </span>
            </div>
            <DialogTitle className="font-display text-xl uppercase tracking-wide text-primary sm:text-2xl">
              Antes &amp; Depois
            </DialogTitle>
            <DialogDescription className="text-xs text-cream-muted sm:text-sm">
              Esboço original ao lado da renderização fotorrealista · arraste a divisória para ajustar
            </DialogDescription>
          </DialogHeader>

          <div className="absolute right-3 top-3 flex flex-wrap items-center justify-end gap-1 sm:right-4 sm:top-3.5">
            <div className="mr-1 flex items-center gap-0.5 rounded-lg border border-gold-border-subtle/30 bg-mahogany-panel/90 p-0.5 backdrop-blur-md">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toolbarZoom.zoomOut}
                disabled={!toolbarZoom.canZoomOut}
                className="h-8 w-8 text-cream-muted hover:text-gold"
                aria-label="Diminuir zoom"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <button
                type="button"
                onClick={toolbarZoom.resetView}
                className="min-w-[3rem] px-1 text-center text-[11px] tabular-nums text-cream-secondary hover:text-gold"
                aria-label="Restaurar zoom"
              >
                {Math.round(toolbarZoom.scale * 100)}%
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toolbarZoom.zoomIn}
                disabled={!toolbarZoom.canZoomIn}
                className="h-8 w-8 text-cream-muted hover:text-gold"
                aria-label="Aumentar zoom"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              {toolbarZoom.isZoomed && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toolbarZoom.resetView}
                  className="h-8 w-8 text-cream-muted hover:text-gold"
                  aria-label="Restaurar visualização"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggleSync}
              className={cn(
                'h-9 text-xs',
                syncZoom ? 'text-gold hover:text-gold' : 'text-cream-muted hover:text-primary',
              )}
              title={syncZoom ? 'Zoom sincronizado nas duas imagens' : 'Zoom independente em cada painel'}
            >
              {syncZoom ? (
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Link2Off className="mr-1.5 h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{syncZoom ? 'Sincronizado' : 'Independente'}</span>
            </Button>

            <LeadAIRenderDownloadMenu
              outputUrl={outputUrl}
              sketchUrl={sketchUrl}
              sketchLabel={sketchLabel}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-cream-muted hover:text-foreground"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
          <div className="hidden h-full overflow-hidden rounded-xl border border-gold-border-subtle/25 md:block">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={50} minSize={25}>
                <ComparePanel
                  src={sketchUrl}
                  alt={sketchLabel}
                  label="Antes"
                  sublabel={sketchLabel}
                  variant="before"
                  {...leftBind}
                />
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="w-1.5 bg-gradient-to-b from-transparent via-gold/40 to-transparent after:w-2"
              />
              <ResizablePanel defaultSize={50} minSize={25}>
                <ComparePanel
                  src={outputUrl}
                  alt="Render fotorrealista"
                  label="Depois"
                  sublabel="Render fotorrealista"
                  variant="after"
                  onViewSingle={outputUrl ? () => setRenderSingleOpen(true) : undefined}
                  {...rightBind}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          <div className="flex h-full flex-col gap-2 overflow-hidden rounded-xl border border-gold-border-subtle/25 md:hidden">
            <div className="min-h-0 flex-1">
              <ComparePanel
                src={sketchUrl}
                alt={sketchLabel}
                label="Antes"
                sublabel={sketchLabel}
                variant="before"
                {...leftBind}
              />
            </div>
            <div className="h-px shrink-0 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
            <div className="min-h-0 flex-1">
              <ComparePanel
                src={outputUrl}
                alt="Render fotorrealista"
                label="Depois"
                sublabel="Render fotorrealista"
                variant="after"
                onViewSingle={outputUrl ? () => setRenderSingleOpen(true) : undefined}
                {...rightBind}
              />
            </div>
          </div>
        </div>

        <p className="shrink-0 border-t border-gold-border-subtle/20 px-4 py-2 text-center text-[10px] text-cream-faint sm:text-[11px]">
          Pinça ou scroll para zoom · duplo toque/clique para ampliar · arraste quando ampliado · Esc para fechar
        </p>
      </DialogContent>

      <LeadAIImageFullscreenDialog
        open={renderSingleOpen}
        onOpenChange={setRenderSingleOpen}
        src={outputUrl}
        alt="Render fotorrealista"
        title="Render fotorrealista"
        subtitle="Somente a imagem renderizada"
        outputUrl={outputUrl}
        sketchUrl={sketchUrl}
        sketchLabel={sketchLabel}
      />
    </Dialog>
  );
}

function FrameToolbarButton({
  label,
  icon,
  onClick,
  iconOnly = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  iconOnly?: boolean;
}) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size={iconOnly ? 'icon' : 'sm'}
      onClick={onClick}
      aria-label={label}
      title={iconOnly ? label : undefined}
      className={cn(
        iconOnly
          ? 'h-8 w-8 shrink-0 text-cream-muted hover:bg-gold/10 hover:text-gold'
          : 'h-8 shrink-0 px-2.5 text-xs text-cream-muted hover:bg-gold/10 hover:text-gold',
      )}
    >
      {icon}
      {!iconOnly && <span className="ml-1.5">{label}</span>}
    </Button>
  );

  if (!iconOnly) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function RenderImageFrame({
  src,
  alt,
  label,
  variant,
  onExpand,
  onExpandSingle,
  onEdit,
  onDelete,
  onUseAsSketch,
  headerAction,
  toolbarCompact = false,
  /** Quadro menor para caber Antes/Depois na mesma vista. */
  compact = false,
  className,
}: {
  src: string | null;
  alt: string;
  label: string;
  variant: 'before' | 'after';
  onExpand?: () => void;
  onExpandSingle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Coloca esta renderização de volta na grade “Selecione uma imagem”. */
  onUseAsSketch?: () => void;
  headerAction?: ReactNode;
  /** Ícones compactos na barra de ações (melhor em cards estreitos). */
  toolbarCompact?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const isAfter = variant === 'after';
  const hasToolbar = Boolean(
    (onExpandSingle && src) || onEdit || onDelete || (onUseAsSketch && src) || headerAction,
  );

  return (
    <div
      className={cn(
        'group/frame overflow-hidden rounded-xl transition-shadow duration-300',
        isAfter
          ? 'border border-gold/30 bg-gold/5 shadow-inner shadow-gold/5'
          : 'border border-gold-border-subtle/30 bg-mahogany-card/50',
        onExpand && 'hover:shadow-lg hover:shadow-gold/10',
        className,
      )}
    >
      <div
        className={cn(
          'border-b',
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2.5 sm:px-4',
          isAfter ? 'border-gold/20 bg-mahogany-elevated/20' : 'border-gold-border-subtle/20',
        )}
      >
        <span
          className={cn(
            'block truncate font-semibold uppercase tracking-[0.16em]',
            compact ? 'text-[10px]' : 'text-[11px]',
            isAfter ? 'text-gold' : 'text-cream-muted',
          )}
          title={label}
        >
          {label}
        </span>
        {hasToolbar && (
          <div
            className={cn(
              'flex flex-wrap items-center gap-1 rounded-lg p-1',
              compact ? 'mt-1' : 'mt-2',
              isAfter && 'border border-gold/20 bg-mahogany-base/60',
            )}
          >
            {onExpandSingle && src && (
              <FrameToolbarButton
                label="Tela cheia"
                icon={<Maximize2 className="h-3.5 w-3.5" />}
                onClick={onExpandSingle}
                iconOnly={toolbarCompact}
              />
            )}
            {onUseAsSketch && src && isAfter && (
              <FrameToolbarButton
                label="Usar como esboço"
                icon={<Layers className="h-3.5 w-3.5" />}
                onClick={onUseAsSketch}
                iconOnly={toolbarCompact}
              />
            )}
            {onEdit && isAfter && (
              <FrameToolbarButton
                label="Editar por pontos"
                icon={<Pencil className="h-3.5 w-3.5" />}
                onClick={onEdit}
                iconOnly={toolbarCompact}
              />
            )}
            {onDelete && isAfter && (
              <FrameToolbarButton
                label="Excluir"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={onDelete}
                iconOnly={toolbarCompact}
              />
            )}
            {headerAction}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onExpand}
        disabled={!src || !onExpand}
        className={cn(
          'relative w-full bg-mahogany-base',
          compact
            ? 'h-[min(168px,28vh)]'
            : 'aspect-[4/3]',
          onExpand && src && 'cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
          (!src || !onExpand) && 'cursor-default',
        )}
        aria-label={src && onExpand ? `Ampliar ${alt}` : undefined}
      >
        {src ? (
          <>
            <img src={src} alt={alt} className="h-full w-full object-contain" />
            {onExpand && (
              <div
                className={cn(
                  'absolute inset-0 flex items-center justify-center',
                  'bg-mahogany-base/0 transition-all duration-300',
                  'group-hover/frame:bg-mahogany-base/55 group-focus-visible/frame:bg-mahogany-base/55',
                )}
              >
                <span
                  className={cn(
                    'flex items-center gap-2 rounded-full border border-gold/40 bg-mahogany-panel/90 px-3 py-1.5',
                    'text-[11px] font-medium uppercase tracking-wider text-gold shadow-lg shadow-black/30',
                    'translate-y-2 opacity-0 backdrop-blur-sm transition-all duration-300',
                    'group-hover/frame:translate-y-0 group-hover/frame:opacity-100',
                    'group-focus-visible/frame:translate-y-0 group-focus-visible/frame:opacity-100',
                  )}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Ampliar
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-cream-faint">
            {isAfter ? (
              <p className="text-sm italic text-cream-muted">A renderização aparecerá aqui</p>
            ) : (
              <>
                <ImageIcon className="h-10 w-10 opacity-40" />
                <p className="max-w-[16rem] text-[11px] leading-relaxed text-cream-muted">
                  A montagem desta versão não foi guardada. Gere um novo render para ver o antes ao lado do depois.
                </p>
              </>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
