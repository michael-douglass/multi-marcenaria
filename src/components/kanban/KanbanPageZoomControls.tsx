import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePageZoomContext } from '@/contexts/PageZoomContext';
import {
  isMarkupCalculatorOpenFlag,
  MARKUP_CALCULATOR_OPEN_ATTR,
} from '@/lib/markup-ui';
import { cn } from '@/lib/utils';

interface KanbanPageZoomControlsProps {
  className?: string;
  /** fixed = flutuante na tela; inline = na barra de ferramentas da página */
  variant?: 'fixed' | 'inline';
  /**
   * Força transparência. Também fica transparente automaticamente quando a
   * calculadora de markup está aberta (qualquer origem: card, modal, pipeline).
   */
  transparent?: boolean;
}

function useMarkupCalculatorOpen(): boolean {
  const [open, setOpen] = useState(isMarkupCalculatorOpenFlag);

  useEffect(() => {
    const sync = () => setOpen(isMarkupCalculatorOpenFlag());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [MARKUP_CALCULATOR_OPEN_ATTR],
    });
    return () => observer.disconnect();
  }, []);

  return open;
}

function ZoomControlsBar({
  className,
  compact,
  transparent = false,
}: {
  className?: string;
  compact?: boolean;
  transparent?: boolean;
}) {
  const { zoomPercent, zoomIn, zoomOut, canZoomIn, canZoomOut, ready } = usePageZoomContext();

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-background/95 p-0.5 shadow-md backdrop-blur-md',
        'ring-1 ring-inset ring-amber-500/10',
        'transition-opacity duration-300',
        !ready && 'opacity-60',
        transparent && 'opacity-0 pointer-events-none',
        className,
      )}
      role="group"
      aria-label="Zoom da tela do Kanban"
      aria-hidden={transparent || undefined}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'rounded-full text-foreground/90 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300',
              compact ? 'h-8 w-8' : 'h-9 w-9',
            )}
            onClick={zoomOut}
            disabled={!canZoomOut || !ready || transparent}
            aria-label="Diminuir zoom da tela"
          >
            <ZoomOut className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.25} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Diminuir zoom</TooltipContent>
      </Tooltip>

      <span
        className={cn(
          'min-w-[2.5rem] select-none text-center font-mono font-semibold tabular-nums tracking-tight text-muted-foreground',
          compact ? 'text-[10px]' : 'text-[11px]',
        )}
        aria-live="polite"
      >
        {zoomPercent}%
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'rounded-full text-foreground/90 hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300',
              compact ? 'h-8 w-8' : 'h-9 w-9',
            )}
            onClick={zoomIn}
            disabled={!canZoomIn || !ready || transparent}
            aria-label="Aumentar zoom da tela"
          >
            <ZoomIn className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.25} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Aumentar zoom</TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * Controles de zoom (lupa + / lupa −) para boards Kanban.
 */
export function KanbanPageZoomControls({
  className,
  variant = 'fixed',
  transparent = false,
}: KanbanPageZoomControlsProps) {
  const markupOpen = useMarkupCalculatorOpen();
  const hideZoom = transparent || markupOpen;

  if (variant === 'inline') {
    return (
      <div className={cn('flex shrink-0 items-center', className)}>
        <ZoomControlsBar compact transparent={hideZoom} />
      </div>
    );
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn(
        'fixed bottom-14 right-4 z-[55] flex items-center md:bottom-16 md:right-5',
        'transition-opacity duration-300',
        hideZoom && 'pointer-events-none opacity-0',
        className,
      )}
      aria-hidden={hideZoom || undefined}
    >
      <ZoomControlsBar transparent={hideZoom} />
    </div>,
    document.body,
  );
}
