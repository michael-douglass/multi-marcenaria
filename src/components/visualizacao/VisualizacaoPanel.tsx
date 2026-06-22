import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface VisualizacaoPanelProps {
  title: string
  subtitle?: string
  accent?: string
  badge?: string | number
  headerEnd?: ReactNode
  headerExtra?: ReactNode
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export function VisualizacaoPanel({
  title,
  subtitle,
  accent = '#f2d892',
  badge,
  headerEnd,
  headerExtra,
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
      <header
        className={cn(
          'viz-panel__header',
          headerExtra && 'viz-panel__header--with-extra',
        )}
      >
        <div className="viz-panel__header-start min-w-0">
          <h2 className="viz-panel__title">{title}</h2>
          {subtitle ? <p className="viz-panel__subtitle">{subtitle}</p> : null}
        </div>
        {headerExtra ? (
          <div className="viz-panel__header-center">{headerExtra}</div>
        ) : null}
        {headerEnd ? (
          <div className="viz-panel__header-end">{headerEnd}</div>
        ) : badge !== undefined ? (
          <span className="viz-panel__header-end">
            <span className="viz-panel__badge">{badge}</span>
          </span>
        ) : null}
      </header>
      <div className="viz-panel__body">{children}</div>
    </section>
  )
}
