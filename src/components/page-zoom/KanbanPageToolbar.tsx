import type { ReactNode } from 'react'

interface KanbanPageToolbarProps {
  children: ReactNode
  className?: string
}

/** Barra superior fixa — título, zoom e ações permanecem visíveis ao rolar ou dar zoom no kanban. */
export function KanbanPageToolbar({ children, className = '' }: KanbanPageToolbarProps) {
  return (
    <div className={`kanban-page-toolbar shrink-0 ${className}`.trim()}>
      {children}
    </div>
  )
}
