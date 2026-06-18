import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface VisualizacaoPanelProps {
  title: string
  subtitle?: string
  accent?: string
  badge?: string | number
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export function VisualizacaoPanel({
  title,
  subtitle,
  accent = '#f2d892',
  badge,
  children,
  className,
  style,
}: VisualizacaoPanelProps) {
  return (
    <section
      className={cn('viz-panel glass-card overflow-hidden', className)}
      style={{
        ...style,
        ['--viz-accent' as string]: accent,
      }}
    >
      <header className="viz-panel__header">
        <div className="min-w-0">
          <h2 className="viz-panel__title">{title}</h2>
          {subtitle ? <p className="viz-panel__subtitle">{subtitle}</p> : null}
        </div>
        {badge !== undefined ? (
          <span className="viz-panel__badge">{badge}</span>
        ) : null}
      </header>
      <div className="viz-panel__body">{children}</div>
    </section>
  )
}
