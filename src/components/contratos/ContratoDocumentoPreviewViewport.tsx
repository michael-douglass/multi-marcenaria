import { type ReactNode, useCallback, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  clampContratoPreviewZoom,
  CONTRATO_PREVIEW_ZOOM_DEFAULT,
  CONTRATO_PREVIEW_ZOOM_MAX,
  CONTRATO_PREVIEW_ZOOM_MIN,
  CONTRATO_PREVIEW_ZOOM_STEP,
  contratoPreviewZoomToScale,
} from '@/lib/contrato-preview-zoom';
import { cn } from '@/lib/utils';

interface ContratoDocumentoPreviewViewportProps {
  children: ReactNode;
  className?: string;
}

/**
 * Área rolável (vertical e horizontal) com zoom para preview de contrato em modais.
 */
export function ContratoDocumentoPreviewViewport({
  children,
  className,
}: ContratoDocumentoPreviewViewportProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoomPercent, setZoomPercent] = useState(CONTRATO_PREVIEW_ZOOM_DEFAULT);
  const scale = contratoPreviewZoomToScale(zoomPercent);

  const zoomIn = useCallback(() => {
    setZoomPercent((p) => clampContratoPreviewZoom(p + CONTRATO_PREVIEW_ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomPercent((p) => clampContratoPreviewZoom(p - CONTRATO_PREVIEW_ZOOM_STEP));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomPercent(CONTRATO_PREVIEW_ZOOM_DEFAULT);
  }, []);

  const canZoomIn = zoomPercent < CONTRATO_PREVIEW_ZOOM_MAX;
  const canZoomOut = zoomPercent > CONTRATO_PREVIEW_ZOOM_MIN;

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -CONTRATO_PREVIEW_ZOOM_STEP : CONTRATO_PREVIEW_ZOOM_STEP;
      setZoomPercent((p) => clampContratoPreviewZoom(p + delta));
    },
    [],
  );

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div
        className="flex shrink-0 items-center justify-center gap-0.5 border-b border-border/60 bg-muted/30 px-3 py-2"
        role="group"
        aria-label="Zoom da pré-visualização do contrato"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-amber-500/15"
              onClick={zoomOut}
              disabled={!canZoomOut}
              aria-label="Diminuir zoom"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Diminuir zoom</TooltipContent>
        </Tooltip>

        <span
          className="min-w-[3rem] select-none text-center font-mono text-[11px] font-semibold tabular-nums text-muted-foreground"
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
              className="h-8 w-8 rounded-full hover:bg-amber-500/15"
              onClick={zoomIn}
              disabled={!canZoomIn}
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Aumentar zoom</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-amber-500/15"
              onClick={resetZoom}
              disabled={zoomPercent === CONTRATO_PREVIEW_ZOOM_DEFAULT}
              aria-label="Restaurar zoom"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zoom 100%</TooltipContent>
        </Tooltip>

        <span className="ml-2 hidden text-[10px] text-muted-foreground sm:inline">
          Ctrl + scroll para zoom
        </span>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto overscroll-contain bg-muted/25"
        onWheel={handleWheel}
        tabIndex={0}
        role="region"
        aria-label="Pré-visualização do contrato — role para ver o documento completo"
      >
        <div className="inline-flex min-h-full min-w-full justify-center p-4 md:p-8">
          <div
            className="contrato-preview-zoom-layer shrink-0 transition-[zoom] duration-150 ease-out"
            style={{ zoom: scale }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
