import { Minus, Plus, RotateCcw } from 'lucide-react'
import { useMobileLayout } from '@/hooks/useMobileLayout'
import { PAGE_ZOOM_DEFAULT } from '@/lib/page-zoom'
import { PAGE_ZOOM_MAX, PAGE_ZOOM_MIN, usePageZoom } from './PageZoomProvider'

interface PageZoomControlsProps {
  className?: string
  /** Versão reduzida para toolbars densas (ex.: Agenda de Obras). */
  compact?: boolean
}

export function KanbanPageZoomControls({ className = '', compact = false }: PageZoomControlsProps) {
  const isMobile = useMobileLayout()
  const { zoom, loading, zoomIn, zoomOut, resetZoom } = usePageZoom()

  if (isMobile) return null

  const atMin = zoom <= PAGE_ZOOM_MIN
  const atMax = zoom >= PAGE_ZOOM_MAX
  const isDefault = zoom === PAGE_ZOOM_DEFAULT

  const iconSize = compact ? 12 : 14
  const resetIconSize = compact ? 11 : 13

  return (
    <div
      className={[
        'obra-toolbar-zoom inline-flex shrink items-center gap-0.5 rounded-lg border border-[rgba(240,210,140,0.2)] bg-[rgba(0,0,0,0.25)]',
        compact ? 'obra-toolbar-zoom--compact p-0.5' : 'max-w-full p-1',
        className,
      ].join(' ')}
      aria-label="Controles de zoom da página"
    >
      <button
        type="button"
        className={[
          'rounded-md text-[#f2d892] transition hover:bg-[rgba(240,210,140,0.12)] disabled:cursor-not-allowed disabled:opacity-35',
          compact ? 'p-1' : 'p-1.5',
        ].join(' ')}
        onClick={zoomOut}
        disabled={loading || atMin}
        aria-label="Diminuir zoom"
      >
        <Minus size={iconSize} />
      </button>

      <span
        className={[
          'shrink text-center font-bold tabular-nums text-[#f2d892]',
          compact
            ? 'min-w-[2.15rem] text-[0.6rem]'
            : 'min-w-[2.5rem] max-w-[3rem] sm:min-w-[3.25rem] text-[0.65rem] sm:text-xs',
        ].join(' ')}
        aria-live="polite"
      >
        {loading ? '…' : `${zoom}%`}
      </span>

      <button
        type="button"
        className={[
          'rounded-md text-[#f2d892] transition hover:bg-[rgba(240,210,140,0.12)] disabled:cursor-not-allowed disabled:opacity-35',
          compact ? 'p-1' : 'p-1.5',
        ].join(' ')}
        onClick={zoomIn}
        disabled={loading || atMax}
        aria-label="Aumentar zoom"
      >
        <Plus size={iconSize} />
      </button>

      {!isDefault && (
        <button
          type="button"
          className={[
            'rounded-md text-[#edd9c4] transition hover:bg-[rgba(240,210,140,0.12)] hover:text-[#f2d892] disabled:opacity-35',
            compact ? 'p-1' : 'p-1.5',
          ].join(' ')}
          onClick={resetZoom}
          disabled={loading}
          aria-label="Restaurar zoom padrão"
          title="Restaurar 100%"
        >
          <RotateCcw size={resetIconSize} />
        </button>
      )}
    </div>
  )
}

/** Alias semântico para páginas que não são kanban. */
export const PageZoomControls = KanbanPageZoomControls
