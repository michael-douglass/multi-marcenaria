import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FloatingAgendaZoomControlsProps {
  zoomPercent: number;
  ready: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  className?: string;
}

export function FloatingAgendaZoomControls({
  zoomPercent,
  ready,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  className,
}: FloatingAgendaZoomControlsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-full border border-border/60 bg-background/80 p-0.5 shrink-0',
        !ready && 'opacity-60',
        className,
      )}
      role="group"
      aria-label="Zoom do painel da Agenda Geral"
      data-no-drag
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-full"
            onClick={onZoomOut}
            disabled={!canZoomOut || !ready}
            aria-label="Diminuir zoom da agenda"
          >
            <ZoomOut className="h-3 w-3" strokeWidth={2.25} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Diminuir zoom</TooltipContent>
      </Tooltip>

      <span
        className="min-w-[2rem] select-none text-center font-mono text-[9px] font-semibold tabular-nums text-muted-foreground"
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
            className="h-5 w-5 rounded-full"
            onClick={onZoomIn}
            disabled={!canZoomIn || !ready}
            aria-label="Aumentar zoom da agenda"
          >
            <ZoomIn className="h-3 w-3" strokeWidth={2.25} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Aumentar zoom</TooltipContent>
      </Tooltip>
    </div>
  );
}
