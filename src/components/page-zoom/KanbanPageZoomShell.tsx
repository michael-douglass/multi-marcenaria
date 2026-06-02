import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { usePageZoom } from './PageZoomProvider'
import { KanbanFloatingScrollBar } from './KanbanFloatingScrollBar'
import { useFloatingScrollMetrics } from './useFloatingScrollBar'

interface PageZoomShellProps {
  children: ReactNode
  showScrollArrows?: boolean
  showFloatingScrollbar?: boolean
  horizontalScrollbar?: boolean
  verticalScrollbar?: boolean
  onZoomApplied?: () => void
  className?: string
  /** Recalcula barra quando conteúdo muda (ex.: lista de obras). */
  contentSignal?: unknown
}

export function KanbanPageZoomShell({
  children,
  showScrollArrows = true,
  showFloatingScrollbar = true,
  horizontalScrollbar = true,
  verticalScrollbar = true,
  onZoomApplied,
  className = '',
  contentSignal,
}: PageZoomShellProps) {
  const { zoom } = usePageZoom()
  const scrollRef = useRef<HTMLDivElement>(null)

  const { horizontalMetrics, verticalMetrics, computeMetrics } = useFloatingScrollMetrics(
    scrollRef,
    {
      enabled: showFloatingScrollbar,
      horizontal: horizontalScrollbar,
      vertical: verticalScrollbar,
      zoom,
      contentSignal,
    },
  )

  const handleScroll = useCallback(() => {
    computeMetrics()
  }, [computeMetrics])

  const handleZoomApplied = useCallback(() => {
    computeMetrics()
    onZoomApplied?.()
  }, [computeMetrics, onZoomApplied])

  useEffect(() => {
    handleZoomApplied()
  }, [zoom, handleZoomApplied])

  return (
    <div className={`relative flex min-h-0 min-w-0 w-full flex-1 flex-col ${className}`}>
      <div
        ref={scrollRef}
        className="kanban-scroll-host min-h-0 min-w-0 w-full flex-1 overflow-auto"
        style={{ paddingBottom: horizontalMetrics.visible ? 36 : 8 }}
        onScroll={handleScroll}
      >
        <div
          data-zoom-content
          className="inline-block w-max min-w-full origin-top-left"
          style={{ zoom: zoom / 100 }}
        >
          {children}
        </div>
      </div>

      {showFloatingScrollbar && (
        <KanbanFloatingScrollBar
          scrollRef={scrollRef}
          horizontalMetrics={horizontalMetrics}
          verticalMetrics={verticalMetrics}
          onMetricsChange={computeMetrics}
          showScrollArrows={showScrollArrows}
        />
      )}
    </div>
  )
}

/** Alias semântico para páginas que não são kanban. */
export const PageZoomShell = KanbanPageZoomShell
