import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type DashboardAccent = 'gold' | 'emerald' | 'rose' | 'sky' | 'amber'

const ACCENT: Record<
  DashboardAccent,
  { bar: string; glow: string; icon: string; value: string }
> = {
  gold: {
    bar: 'linear-gradient(180deg, #c4963a 0%, rgba(196,150,58,0.12) 100%)',
    glow: 'radial-gradient(circle, rgba(196,150,58,0.22) 0%, transparent 70%)',
    icon: 'text-[#8d5e22]',
    value: 'text-[#8d5e22]',
  },
  emerald: {
    bar: 'linear-gradient(180deg, #059669 0%, rgba(5,150,105,0.12) 100%)',
    glow: 'radial-gradient(circle, rgba(5,150,105,0.18) 0%, transparent 70%)',
    icon: 'text-emerald-700',
    value: 'text-emerald-700',
  },
  rose: {
    bar: 'linear-gradient(180deg, #dc2626 0%, rgba(220,38,38,0.12) 100%)',
    glow: 'radial-gradient(circle, rgba(220,38,38,0.18) 0%, transparent 70%)',
    icon: 'text-red-700',
    value: 'text-red-700',
  },
  sky: {
    bar: 'linear-gradient(180deg, #0e7490 0%, rgba(14,116,144,0.12) 100%)',
    glow: 'radial-gradient(circle, rgba(14,116,144,0.16) 0%, transparent 70%)',
    icon: 'text-cyan-800',
    value: 'text-cyan-800',
  },
  amber: {
    bar: 'linear-gradient(180deg, #b45309 0%, rgba(180,83,9,0.12) 100%)',
    glow: 'radial-gradient(circle, rgba(180,83,9,0.16) 0%, transparent 70%)',
    icon: 'text-amber-800',
    value: 'text-amber-800',
  },
}

interface DashboardCardShellProps {
  children: ReactNode
  accent?: DashboardAccent
  className?: string
  onClick?: () => void
  style?: CSSProperties
}

/** Casca visual compartilhada dos cards do dashboard (papel creme + tinta). */
export function DashboardCardShell({
  children,
  accent = 'gold',
  className,
  onClick,
  style,
}: DashboardCardShellProps) {
  const a = ACCENT[accent]
  return (
    <Card
      onClick={onClick}
      style={style}
      className={cn(
        'group relative h-full overflow-hidden border-[rgba(42,24,18,0.10)] bg-[#fffcf8]',
        'transition-[border-color,box-shadow,transform] duration-300 ease-out',
        'hover:border-[rgba(42,24,18,0.18)] hover:shadow-[0_14px_36px_rgba(42,24,18,0.08)]',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-35 blur-2xl transition-opacity duration-500 group-hover:opacity-65"
        style={{ background: a.glow }}
      />
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: a.bar }}
      />
      {children}
    </Card>
  )
}

interface DashboardKpiCardProps {
  title: string
  subtitle: string
  value: string | number
  icon: LucideIcon
  accent?: DashboardAccent
  className?: string
  style?: CSSProperties
}

export function DashboardKpiCard({
  title,
  subtitle,
  value,
  icon: Icon,
  accent = 'gold',
  className,
  style,
}: DashboardKpiCardProps) {
  const a = ACCENT[accent]
  return (
    <DashboardCardShell accent={accent} className={className} style={style}>
      <CardHeader className="relative flex flex-row items-start justify-between space-y-0 px-5 pb-2 pt-5">
        <div className="min-w-0 pr-2">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6b5244]">
            {title}
          </CardTitle>
        </div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(42,24,18,0.12)] bg-[rgba(42,24,18,0.05)]"
          aria-hidden
        >
          <Icon className={cn('h-3.5 w-3.5', a.icon)} />
        </div>
      </CardHeader>
      <CardContent className="relative space-y-2 px-5 pb-5 pt-0">
        <div className={cn('font-display text-[1.7rem] leading-none tracking-[0.04em] tabular-nums', a.value)}>
          {value}
        </div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#8a7060]">
          {subtitle}
        </p>
      </CardContent>
    </DashboardCardShell>
  )
}
