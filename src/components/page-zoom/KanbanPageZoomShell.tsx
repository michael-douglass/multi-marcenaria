import { useCallback, useEffect, useRef, type ReactNode, type Ref } from 'react'
import { usePageZoom } from './PageZoomProvider'
import { KanbanFloatingScrollBar } from './KanbanFloatingScrollBar'
import { useFloatingScrollMetrics } from './useFloatingScrollBar'

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (value: T | null) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') ref(value)
      else (ref as React.MutableRefObject<T | null>).current = value
    }
  }
}

interface PageZoomShellProps {
  children: ReactNode
  showScrollArrows?: boolean
  showFloatingScrollbar?: boolean
  horizontalScrollbar?: boolean
  verticalScrollbar?: boolean
  onZoomApplied?: () => void
  className?: string
  scrollHostRef?: Ref<HTMLDivElement>
  /**
   * fluid — cards/listas ocupam 100% da tela (Calendário dia, métricas).
   * kanban — permite largura expandida para colunas horizontais (Agenda).
   */
  contentLayout?: 'fluid' | 'kanban'
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
  contentLayout = 'kanban',
  contentSignal,
  scrollHostRef,
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
    <div className={`kanban-page-zoom-shell relative flex min-h-0 min-w-0 w-full max-w-full flex-none flex-col overflow-visible md:flex-1 md:overflow-hidden ${className}`}>
      <div
        ref={mergeRefs(scrollRef, scrollHostRef)}
        className="kanban-scroll-host min-h-0 min-w-0 w-full max-w-full flex-none overflow-x-auto overflow-y-visible overscroll-x-contain touch-pan-x touch-pan-y max-md:overflow-x-auto max-md:overflow-y-visible md:flex-1 md:overflow-auto"
        style={{ paddingBottom: horizontalMetrics.visible ? 36 : 8 }}
        onScroll={handleScroll}
      >
        <div
          data-zoom-content
          data-content-layout={contentLayout}
          className={
            contentLayout === 'fluid'
              ? 'zoom-content-fluid block w-full max-w-full min-w-0 origin-top-left'
              : 'inline-block w-max min-w-full origin-top-left'
          }
          style={{ zoom: zoom / 100 }}
        >
          {children}
        </div>
      </div>

      {showFloatingScrollbar && (
        <div className="kanban-floating-scroll contents">
          <KanbanFloatingScrollBar
            scrollRef={scrollRef}
            horizontalMetrics={horizontalMetrics}
            verticalMetrics={verticalMetrics}
            onMetricsChange={computeMetrics}
            showScrollArrows={showScrollArrows}
          />
        </div>
      )}
    </div>
  )
}

/** Alias semântico para páginas que não são kanban. */
export const PageZoomShell = KanbanPageZoomShell
