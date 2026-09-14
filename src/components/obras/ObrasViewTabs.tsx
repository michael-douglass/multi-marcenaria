import {
  AGENDA_OBRA_VIEW_LABEL,
  AGENDA_OBRA_VIEWS,
  type AgendaObraView,
} from '@/lib/obra-views'
import { cn } from '@/lib/utils'

interface ObrasViewTabsProps {
  value: AgendaObraView
  onChange: (view: AgendaObraView) => void
  className?: string
}

/** Abas Filas | Kanban | Calendário no topo da página de obras. */
export function ObrasViewTabs({ value, onChange, className }: ObrasViewTabsProps) {
  return (
    <div
      className={cn('obra-page-view-tabs obra-page-header__action-buttons', className)}
      role="tablist"
      aria-label="Visualização de obras"
    >
      {AGENDA_OBRA_VIEWS.map(view => (
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={value === view}
          onClick={() => onChange(view)}
          className="obra-page-view-tab"
          data-active={value === view ? 'true' : undefined}
        >
          {AGENDA_OBRA_VIEW_LABEL[view]}
        </button>
      ))}
    </div>
  )
}
