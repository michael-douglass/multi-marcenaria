import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CrmPageFrameProps {
  children: ReactNode
  className?: string
  /** Contratos e listas longas usam o recuo do CRM antigo. */
  padded?: boolean
}

export function CrmPageFrame({ children, className, padded = false }: CrmPageFrameProps) {
  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-hidden',
        padded ? 'space-y-6 p-6 md:p-8 max-w-6xl' : 'space-y-2 px-0 pb-2 md:space-y-3 md:pb-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface CrmPageHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
  below?: ReactNode
}

export function CrmPageHeader({ title, subtitle, icon, actions, below }: CrmPageHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-foreground">
            {icon}
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {below}
    </div>
  )
}

export const CRM_TABLE_SHELL_CLASS =
  'overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm'
