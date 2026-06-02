import { Minus, Plus, RotateCcw } from 'lucide-react'
import { PAGE_ZOOM_DEFAULT } from '@/lib/page-zoom'
import { PAGE_ZOOM_MAX, PAGE_ZOOM_MIN, usePageZoom } from './PageZoomProvider'

interface PageZoomControlsProps {
  className?: string
}

export function KanbanPageZoomControls({ className = '' }: PageZoomControlsProps) {
  const { zoom, loading, zoomIn, zoomOut, resetZoom } = usePageZoom()

  const atMin = zoom <= PAGE_ZOOM_MIN
  const atMax = zoom >= PAGE_ZOOM_MAX
  const isDefault = zoom === PAGE_ZOOM_DEFAULT

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg border border-[rgba(212,168,83,0.2)] bg-[rgba(0,0,0,0.25)] p-1 ${className}`}
      aria-label="Controles de zoom da página"
    >
      <button
        type="button"
        className="rounded-md p-1.5 text-[#d4a853] transition hover:bg-[rgba(212,168,83,0.12)] disabled:cursor-not-allowed disabled:opacity-35"
        onClick={zoomOut}
        disabled={loading || atMin}
        aria-label="Diminuir zoom"
      >
        <Minus size={14} />
      </button>

      <span
        className="min-w-[3.25rem] text-center text-xs font-bold tabular-nums text-[#d4a853]"
        aria-live="polite"
      >
        {loading ? '…' : `${zoom}%`}
      </span>

      <button
        type="button"
        className="rounded-md p-1.5 text-[#d4a853] transition hover:bg-[rgba(212,168,83,0.12)] disabled:cursor-not-allowed disabled:opacity-35"
        onClick={zoomIn}
        disabled={loading || atMax}
        aria-label="Aumentar zoom"
      >
        <Plus size={14} />
      </button>

      {!isDefault && (
        <button
          type="button"
          className="rounded-md p-1.5 text-[#8a6a55] transition hover:bg-[rgba(212,168,83,0.12)] hover:text-[#d4a853] disabled:opacity-35"
          onClick={resetZoom}
          disabled={loading}
          aria-label="Restaurar zoom padrão"
          title="Restaurar 100%"
        >
          <RotateCcw size={13} />
        </button>
      )}
    </div>
  )
}

/** Alias semântico para páginas que não são kanban. */
export const PageZoomControls = KanbanPageZoomControls
