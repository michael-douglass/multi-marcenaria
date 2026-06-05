import type { ReactNode } from 'react'

interface KanbanPageToolbarProps {
  children: ReactNode
  className?: string
}

/** Barra superior — sticky no desktop; no mobile rola junto com a página (.obra-page-shell). */
export function KanbanPageToolbar({ children, className = '' }: KanbanPageToolbarProps) {
  return (
    <div className={`kanban-page-toolbar ${className}`.trim()}>
      {children}
    </div>
  )
}
