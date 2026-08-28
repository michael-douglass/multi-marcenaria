import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useInlineImageZoom, useZoomContainerBinding } from '@/components/leads/use-inline-image-zoom';
import { LeadAIRenderDownloadMenu } from '@/components/leads/LeadAIRenderDownloadMenu';
import { cn } from '@/lib/utils';
import { ImageIcon, Minus, Plus, RotateCcw, X } from 'lucide-react';

interface LeadAIImageFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  alt: string;
  title?: string;
  subtitle?: string;
  outputUrl?: string | null;
  sketchUrl?: string | null;
  sketchLabel?: string;
}

export function LeadAIImageFullscreenDialog({
  open,
  onOpenChange,
  src,
  alt,
  title = 'Visualização',
  subtitle,
  outputUrl,
  sketchUrl = null,
  sketchLabel = 'Esboço',
}: LeadAIImageFullscreenDialogProps) {
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
  } = useInlineImageZoom(open ? src : null);

  const containerRef = useZoomContainerBinding(bindZoomContainer, open && !!src);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      }
      if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
      if (e.key === '0') {
        e.preventDefault();
        resetView();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenChange, open, resetView, zoomIn, zoomOut]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'fixed left-0 top-0 z-[60] flex h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0',
          'sm:left-1/2 sm:top-1/2 sm:h-[min(96dvh,940px)] sm:w-[min(1200px,calc(100vw-1rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border',
          'border-gold-border-subtle/30 bg-mahogany-panel shadow-2xl shadow-black/60',
          '[&>button.absolute]:hidden',
        )}
      >
        <div className="relative shrink-0 border-b border-gold-border-subtle/30 bg-gradient-to-r from-mahogany-elevated via-mahogany-card to-mahogany-elevated px-4 py-3.5 sm:px-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/55 to-transparent" />
          <DialogHeader className="space-y-0.5 pr-4 text-left sm:pr-48">
            <DialogTitle className="font-display text-xl uppercase tracking-wide text-primary sm:text-2xl">
              {title}
            </DialogTitle>
            {subtitle && (
              <DialogDescription className="text-xs text-cream-muted sm:text-sm">
                {subtitle}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="absolute right-3 top-3 flex flex-wrap items-center justify-end gap-1 sm:right-4 sm:top-3.5">
            <div className="mr-1 flex items-center gap-0.5 rounded-lg border border-gold-border-subtle/30 bg-mahogany-panel/90 p-0.5 backdrop-blur-md">
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

            {src && (
              <LeadAIRenderDownloadMenu
                outputUrl={outputUrl ?? src}
                sketchUrl={sketchUrl}
                sketchLabel={sketchLabel}
                menuTitle="Exportar render"
                triggerClassName="h-9"
              />
            )}

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

        <div
          ref={containerRef}
          className={cn(
            'relative min-h-0 flex-1 overflow-hidden touch-none',
            'bg-[radial-gradient(ellipse_at_center,_rgba(242,216,146,0.06)_0%,_transparent_55%)] bg-mahogany-base',
            src && !isZoomed ? 'cursor-zoom-in' : '',
            isZoomed ? 'cursor-grab active:cursor-grabbing' : '',
          )}
          onPointerDown={src ? handlePointerDown : undefined}
          onPointerMove={src ? handlePointerMove : undefined}
          onPointerUp={src ? handlePointerUp : undefined}
          onPointerCancel={src ? handlePointerUp : undefined}
          onDoubleClick={src ? toggleZoom : undefined}
        >
          <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
            {src ? (
              <img
                src={src}
                alt={alt}
                draggable={false}
                className={cn(
                  'max-h-full max-w-full select-none object-contain',
                  'animate-in fade-in zoom-in-95 duration-500 fill-mode-both',
                  'rounded-sm border border-white/5 shadow-2xl shadow-black/60 ring-1 ring-gold/20',
                  'transition-transform duration-150 ease-out will-change-transform',
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
        </div>

        <p className="shrink-0 border-t border-gold-border-subtle/20 px-4 py-2 text-center text-[10px] text-cream-faint sm:text-[11px]">
          Pinça ou scroll para zoom · duplo toque/clique para ampliar · arraste quando ampliado · Esc para fechar
        </p>
      </DialogContent>
    </Dialog>
  );
}
