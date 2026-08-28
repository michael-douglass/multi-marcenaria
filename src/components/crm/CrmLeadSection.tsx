import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CrmLeadSectionProps {
  title: string
  icon?: LucideIcon
  badge?: ReactNode
  actions?: ReactNode
  description?: string
  variant?: 'default' | 'accent'
  children: ReactNode
}

export function CrmLeadSection({
  title,
  icon: Icon,
  badge,
  actions,
  description,
  variant = 'default',
  children,
}: CrmLeadSectionProps) {
  return (
    <section
      className={cn(
        'relative mb-3 overflow-hidden rounded-xl border shadow-sm shadow-black/5 last:mb-0',
        variant === 'accent'
          ? 'border-gold/30 bg-gradient-to-br from-gold/8 via-mahogany-card/40 to-mahogany-elevated/30'
          : 'border-gold-border-subtle/25 bg-gradient-to-b from-mahogany-card/50 to-mahogany-elevated/20',
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/35 to-transparent" />
      <header className="flex items-start justify-between gap-3 border-b border-gold-border-subtle/15 px-4 py-3 sm:px-5">
        <div className="min-w-0 space-y-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-gold" aria-hidden />}
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream-secondary">
              {title}
            </h3>
            {badge}
          </div>
          {description && <p className="text-xs leading-relaxed text-cream-muted">{description}</p>}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="px-4 py-3 sm:px-5">{children}</div>
    </section>
  )
}
