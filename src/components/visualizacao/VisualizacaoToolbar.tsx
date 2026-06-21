import { LayoutGrid, Pause, Play } from 'lucide-react'
import { KanbanPageZoomControls } from '@/components/page-zoom'
import { AppRefreshButton } from '@/components/ui/AppRefreshButton'

interface VisualizacaoToolbarProps {
  autoScroll: boolean
  onToggleAutoScroll: () => void
  canConfigPaineis?: boolean
  onOpenPaineisConfig?: () => void
}

export function VisualizacaoToolbar({
  autoScroll,
  onToggleAutoScroll,
  canConfigPaineis = false,
  onOpenPaineisConfig,
}: VisualizacaoToolbarProps) {
  return (
    <div className="viz-toolbar flex flex-wrap items-center justify-end gap-2">
      {canConfigPaineis && onOpenPaineisConfig ? (
        <button
          type="button"
          className="btn btn-outline btn-sm gap-1.5"
          onClick={onOpenPaineisConfig}
        >
          <LayoutGrid size={14} />
          Painéis do visualizador
        </button>
      ) : null}
      <KanbanPageZoomControls className="shrink-0" />
      <button
        type="button"
        className={`btn btn-sm gap-1.5 ${autoScroll ? 'btn-gold' : 'btn-outline'}`}
        onClick={onToggleAutoScroll}
        aria-pressed={autoScroll}
      >
        {autoScroll ? <Pause size={14} /> : <Play size={14} />}
        {autoScroll ? 'Pausar rolagem' : 'Rolagem automática'}
      </button>
      <AppRefreshButton variant="toolbar" showLabel />
    </div>
  )
}
