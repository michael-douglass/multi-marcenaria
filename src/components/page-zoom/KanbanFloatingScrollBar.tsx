import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import {
  SCROLLBAR_HEIGHT,
  type HorizontalScrollMetrics,
  type VerticalScrollMetrics,
  useScrollbarDrag,
} from './useFloatingScrollBar'

interface KanbanFloatingScrollBarProps {
  scrollRef: React.RefObject<HTMLElement | null>
  horizontalMetrics: HorizontalScrollMetrics
  verticalMetrics: VerticalScrollMetrics
  onMetricsChange: () => void
  showScrollArrows?: boolean
}

const SCROLL_STEP = 320

export function KanbanFloatingScrollBar({
  scrollRef,
  horizontalMetrics,
  verticalMetrics,
  onMetricsChange,
  showScrollArrows = true,
}: KanbanFloatingScrollBarProps) {
  const horizontalDrag = useScrollbarDrag(scrollRef, 'x', onMetricsChange)
  const verticalDrag = useScrollbarDrag(scrollRef, 'y', onMetricsChange)

  const scrollBy = (axis: 'x' | 'y', delta: number) => {
    const el = scrollRef.current
    if (!el) return
    if (axis === 'x') el.scrollBy({ left: delta, behavior: 'smooth' })
    else el.scrollBy({ top: delta, behavior: 'smooth' })
    window.setTimeout(onMetricsChange, 180)
  }

  return (
    <>
      {horizontalMetrics.visible && (
        <div
          className="pointer-events-none absolute inset-x-3 bottom-2 z-50 flex items-center gap-2"
          aria-hidden={false}
        >
          {showScrollArrows && (
            <button
              type="button"
              aria-label="Rolar para a esquerda"
              className="pointer-events-auto shrink-0 rounded-full border border-[rgba(240,210,140,0.45)] bg-[rgba(8,3,1,0.95)] p-1.5 text-[#f2d892] shadow-[0_4px_20px_rgba(0,0,0,0.45)] transition hover:bg-[rgba(240,210,140,0.18)]"
              onClick={() => scrollBy('x', -SCROLL_STEP)}
            >
              <ChevronLeft size={16} />
            </button>
          )}

          <div
            role="scrollbar"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            className="pointer-events-auto relative flex-1 cursor-pointer rounded-full border border-[rgba(240,210,140,0.35)] bg-[rgba(12,6,3,0.95)] shadow-[0_4px_20px_rgba(0,0,0,0.45)]"
            style={{ height: SCROLLBAR_HEIGHT }}
            onPointerDown={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              const thumbPx = (horizontalMetrics.thumbWidthPercent / 100) * rect.width
              horizontalDrag.onTrackPointerDown(
                e,
                rect.width,
                thumbPx,
                rect.left,
              )
            }}
          >
            <div
              data-scrollbar-thumb="true"
              className="absolute top-0.5 h-[calc(100%-4px)] rounded-full bg-[#f2d892] shadow-[0_0_12px_rgba(240,210,140,0.45)]"
              style={{
                width: `${horizontalMetrics.thumbWidthPercent}%`,
                left: `${horizontalMetrics.thumbLeftPercent}%`,
              }}
              onPointerDown={e => {
                const track = e.currentTarget.parentElement
                if (!track) return
                const travel = track.clientWidth * (1 - horizontalMetrics.thumbWidthPercent / 100)
                horizontalDrag.onThumbPointerDown(e, travel)
              }}
              onPointerMove={e => {
                const track = e.currentTarget.parentElement
                if (!track) return
                const travel = track.clientWidth * (1 - horizontalMetrics.thumbWidthPercent / 100)
                horizontalDrag.onThumbPointerMove(e, travel)
              }}
              onPointerUp={horizontalDrag.onThumbPointerUp}
              onPointerCancel={horizontalDrag.onThumbPointerUp}
            />
          </div>

          {showScrollArrows && (
            <button
              type="button"
              aria-label="Rolar para a direita"
              className="pointer-events-auto shrink-0 rounded-full border border-[rgba(240,210,140,0.45)] bg-[rgba(8,3,1,0.95)] p-1.5 text-[#f2d892] shadow-[0_4px_20px_rgba(0,0,0,0.45)] transition hover:bg-[rgba(240,210,140,0.18)]"
              onClick={() => scrollBy('x', SCROLL_STEP)}
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      {verticalMetrics.visible && (
        <div
          className="pointer-events-none absolute bottom-3 right-2 top-3 z-40 flex w-[14px] flex-col items-center gap-2"
        >
          <button
            type="button"
            aria-label="Rolar para cima"
            className="pointer-events-auto shrink-0 rounded-full border border-[rgba(240,210,140,0.45)] bg-[rgba(8,3,1,0.95)] p-1.5 text-[#f2d892] shadow-[0_4px_20px_rgba(0,0,0,0.45)] transition hover:bg-[rgba(240,210,140,0.18)]"
            onClick={() => scrollBy('y', -SCROLL_STEP)}
          >
            <ChevronUp size={14} />
          </button>

          <div
            role="scrollbar"
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            className="pointer-events-auto relative flex-1 cursor-pointer rounded-full border border-[rgba(240,210,140,0.35)] bg-[rgba(12,6,3,0.95)] shadow-[0_4px_20px_rgba(0,0,0,0.45)]"
            style={{ width: SCROLLBAR_HEIGHT }}
            onPointerDown={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              const thumbPx = (verticalMetrics.thumbHeightPercent / 100) * rect.height
              verticalDrag.onTrackPointerDown(
                e,
                rect.height,
                thumbPx,
                rect.top,
              )
            }}
          >
            <div
              data-scrollbar-thumb="true"
              className="absolute left-0.5 w-[calc(100%-4px)] rounded-full bg-[#f2d892] shadow-[0_0_12px_rgba(240,210,140,0.45)]"
              style={{
                height: `${verticalMetrics.thumbHeightPercent}%`,
                top: `${verticalMetrics.thumbTopPercent}%`,
              }}
              onPointerDown={e => {
                const track = e.currentTarget.parentElement
                if (!track) return
                const travel = track.clientHeight * (1 - verticalMetrics.thumbHeightPercent / 100)
                verticalDrag.onThumbPointerDown(e, travel)
              }}
              onPointerMove={e => {
                const track = e.currentTarget.parentElement
                if (!track) return
                const travel = track.clientHeight * (1 - verticalMetrics.thumbHeightPercent / 100)
                verticalDrag.onThumbPointerMove(e, travel)
              }}
              onPointerUp={verticalDrag.onThumbPointerUp}
              onPointerCancel={verticalDrag.onThumbPointerUp}
            />
          </div>

          <button
            type="button"
            aria-label="Rolar para baixo"
            className="pointer-events-auto shrink-0 rounded-full border border-[rgba(240,210,140,0.45)] bg-[rgba(8,3,1,0.95)] p-1.5 text-[#f2d892] shadow-[0_4px_20px_rgba(0,0,0,0.45)] transition hover:bg-[rgba(240,210,140,0.18)]"
            onClick={() => scrollBy('y', SCROLL_STEP)}
          >
            <ChevronDown size={14} />
          </button>
        </div>
      )}
    </>
  )
}
