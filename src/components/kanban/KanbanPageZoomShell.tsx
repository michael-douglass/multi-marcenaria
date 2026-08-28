import { type CSSProperties, type ReactNode, useEffect } from 'react';
import { usePageZoomContext } from '@/contexts/PageZoomContext';
import { pageZoomToScale } from '@/lib/page-zoom-preferences';
import { cn } from '@/lib/utils';

interface KanbanPageZoomShellProps {
  children: ReactNode;
  className?: string;
  /** Recalcula layout do scroll horizontal após mudar o zoom (ex.: setas e scrollbar flutuante). */
  onZoomApplied?: () => void;
}

/**
 * Envolve a área do board Kanban aplicando o zoom salvo do usuário
 * e exibe os botões de lupa (+ / −).
 */
export function KanbanPageZoomShell({ children, className, onZoomApplied }: KanbanPageZoomShellProps) {
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
    <div className={cn('relative flex min-h-0 min-w-0 max-w-full flex-1 flex-col', className)}>
      <div
        className="kanban-page-zoom-viewport flex min-h-0 min-w-0 max-w-full flex-1 flex-col transition-[zoom] duration-200 ease-out"
        style={zoomStyle}
      >
        {children}
      </div>
    </div>
  );
}
