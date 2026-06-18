import { Pause, Play } from 'lucide-react'
import { KanbanPageZoomControls } from '@/components/page-zoom'
import { AppRefreshButton } from '@/components/ui/AppRefreshButton'

interface VisualizacaoToolbarProps {
  autoScroll: boolean
  onToggleAutoScroll: () => void
}

export function VisualizacaoToolbar({
  autoScroll,
  onToggleAutoScroll,
}: VisualizacaoToolbarProps) {
  return (
    <div className="viz-toolbar flex flex-wrap items-center justify-end gap-2">
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
