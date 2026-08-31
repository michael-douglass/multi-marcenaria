import { type CSSProperties, type ReactNode, useEffect } from 'react';
import { usePageZoomContext } from '@/contexts/PageZoomContext';
import { pageZoomToScale } from '@/lib/page-zoom-preferences';
import { cn } from '@/lib/utils';

interface KanbanPageZoomShellProps {
  children: ReactNode;
  className?: string;
  /** Recalcula layout do scroll horizontal após mudar o zoom (ex.: setas e scrollbar flutuante). */
  onZoomApplied?: () => void;
  /**
   * Ateliê / telas que preenchem a janela e recortam o quadro.
   * No pipeline, deixe false: o quadro cresce com os cards e a página principal rola.
   */
  fillViewport?: boolean;
}

/**
 * Envolve a área do board Kanban aplicando o zoom salvo do usuário
 * e exibe os botões de lupa (+ / −).
 */
export function KanbanPageZoomShell({
  children,
  className,
  onZoomApplied,
  fillViewport = false,
}: KanbanPageZoomShellProps) {
  const { zoomPercent, ready } = usePageZoomContext();
  const scale = pageZoomToScale(zoomPercent);

  useEffect(() => {
    if (!ready) return;
    const id = requestAnimationFrame(() => {
      onZoomApplied?.();
    });
    return () => cancelAnimationFrame(id);
  }, [zoomPercent, ready, onZoomApplied]);

  const zoomStyle: CSSProperties = {
    zoom: scale,
  };

  return (
    <div
      className={cn(
        'relative flex min-w-0 max-w-full flex-col',
        fillViewport ? 'min-h-0 flex-1 overflow-hidden' : 'h-auto flex-none overflow-visible',
        className,
      )}
    >
      <div
        className={cn(
          'kanban-page-zoom-viewport flex min-w-0 max-w-full flex-col transition-[zoom] duration-200 ease-out',
          fillViewport ? 'min-h-0 flex-1 overflow-hidden' : 'h-auto overflow-visible',
        )}
        style={zoomStyle}
      >
        {children}
      </div>
    </div>
  );
}
