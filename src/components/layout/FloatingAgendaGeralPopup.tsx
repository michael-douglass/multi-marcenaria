import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Calendar, GripVertical, Minimize2, PanelLeft, PanelRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AgendaGeralContent } from '@/components/agenda/AgendaGeralContent';
import { FloatingAgendaZoomControls } from '@/components/layout/FloatingAgendaZoomControls';
import { useHorizontalSnapDrag } from '@/hooks/useHorizontalSnapDrag';
import { useFloatingAgendaZoom } from '@/hooks/useFloatingAgendaZoom';
import { floatingAgendaPanelWidthPx } from '@/lib/floating-agenda-zoom-preferences';
import { floatingAgendaPanelClass } from '@/lib/overlay-z-index';
import type { FloatingAgendaSide } from '@/hooks/useUiPreferences';

interface FloatingAgendaGeralPopupProps {
  isOpen: boolean;
  onClose: () => void;
  side: FloatingAgendaSide;
  onSideChange: (side: FloatingAgendaSide) => void;
  pendingCount?: number;
}

export function FloatingAgendaGeralPopup({
  isOpen,
  onClose,
  side,
  onSideChange,
  pendingCount = 0,
}: FloatingAgendaGeralPopupProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );
  const { zoomPercent, ready, zoomIn, zoomOut, canZoomIn, canZoomOut } = useFloatingAgendaZoom();
  const { dragOffsetX, isDragging, dragHandleProps } = useHorizontalSnapDrag({
    side,
    onSideChange,
    panelRef,
  });

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!isOpen) return null;

  const toggleSide = () => {
    onSideChange(side === 'right' ? 'left' : 'right');
  };

  const panelWidthPx = floatingAgendaPanelWidthPx(zoomPercent, viewportWidth);

  const panelStyle: CSSProperties = {
    width: panelWidthPx,
    maxWidth: viewportWidth >= 640 ? '92vw' : 'calc(100vw - 1rem)',
    transform: dragOffsetX !== 0 ? `translateX(${dragOffsetX}px)` : undefined,
    transition: isDragging ? 'none' : undefined,
  };

  return (
    <div
      ref={panelRef}
      data-floating-agenda-root
      data-floating-agenda-panel=""
      className={cn(
        'fixed top-0 bottom-0 pointer-events-auto',
        floatingAgendaPanelClass,
        'flex flex-col overflow-hidden bg-background/95 backdrop-blur-md border shadow-2xl',
        side === 'right' ? 'right-0 border-l rounded-l-xl' : 'left-0 border-r rounded-r-xl',
        !isDragging &&
          (side === 'right'
            ? 'origin-top-right animate-in zoom-in-95 slide-in-from-right-4 fade-in duration-300'
            : 'origin-top-left animate-in zoom-in-95 slide-in-from-left-4 fade-in duration-300'),
        ready && 'transition-[width] duration-200 ease-out',
      )}
      style={panelStyle}
      role="dialog"
      aria-label="Agenda Geral"
    >
      <div
        {...dragHandleProps}
        data-floating-agenda-chrome=""
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 border-b bg-muted/20 shrink-0 select-none',
          'cursor-grab active:cursor-grabbing touch-none',
          side === 'right' ? 'rounded-tl-xl' : 'rounded-tr-xl',
          isDragging && 'cursor-grabbing',
        )}
        title="Arraste para mover o painel"
      >
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground"
          aria-hidden
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        <div className="flex items-center gap-1 min-w-0 flex-1 pointer-events-none">
          <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
          <h3 className="font-semibold text-xs truncate">Agenda Geral</h3>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="h-4 px-1 text-[9px] shrink-0">
              {pendingCount > 99 ? '99+' : pendingCount}
            </Badge>
          )}
        </div>

        <FloatingAgendaZoomControls
          zoomPercent={zoomPercent}
          ready={ready}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
        />

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={toggleSide}
          data-no-drag
          title={side === 'right' ? 'Fixar à esquerda' : 'Fixar à direita'}
        >
          {side === 'right' ? (
            <PanelLeft className="h-3.5 w-3.5" />
          ) : (
            <PanelRight className="h-3.5 w-3.5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 shrink-0"
          data-no-drag
          title="Minimizar agenda"
          aria-label="Minimizar agenda"
        >
          <Minimize2 className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 shrink-0"
          data-no-drag
          title="Fechar agenda"
          aria-label="Fechar agenda"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <AgendaGeralContent
          compact
          zoomPercent={zoomPercent}
          className="flex-1 min-h-0 flex flex-col px-2 pb-2 pt-1.5"
        />
      </div>
    </div>
  );
}
