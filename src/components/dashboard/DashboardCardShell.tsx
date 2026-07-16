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
    bar: 'linear-gradient(180deg, #f2d892 0%, rgba(242,216,146,0.12) 100%)',
    glow: 'radial-gradient(circle, rgba(242,216,146,0.26) 0%, transparent 70%)',
    icon: 'text-[#f2d892]',
    value: 'text-[#f2d892]',
  },
  emerald: {
    bar: 'linear-gradient(180deg, #34d399 0%, rgba(52,211,153,0.12) 100%)',
    glow: 'radial-gradient(circle, rgba(52,211,153,0.22) 0%, transparent 70%)',
    icon: 'text-emerald-400',
    value: 'text-emerald-400',
  },
  rose: {
    bar: 'linear-gradient(180deg, #f87171 0%, rgba(248,113,113,0.12) 100%)',
    glow: 'radial-gradient(circle, rgba(248,113,113,0.28) 0%, transparent 70%)',
    icon: 'text-red-400',
    value: 'text-red-400',
  },
  sky: {
    bar: 'linear-gradient(180deg, #67e8f9 0%, rgba(103,232,249,0.12) 100%)',
    glow: 'radial-gradient(circle, rgba(103,232,249,0.2) 0%, transparent 70%)',
    icon: 'text-cyan-300',
    value: 'text-cyan-300',
  },
  amber: {
    bar: 'linear-gradient(180deg, #fbbf24 0%, rgba(251,191,36,0.12) 100%)',
    glow: 'radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 70%)',
    icon: 'text-amber-400',
    value: 'text-amber-400',
  },
}

interface DashboardCardShellProps {
  children: ReactNode
  accent?: DashboardAccent
  className?: string
  onClick?: () => void
  style?: CSSProperties
}

/** Casca visual compartilhada dos cards do dashboard (Movelaria: escuro + ouro). */
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
        'group relative h-full overflow-hidden border-[rgba(240,210,140,0.16)] bg-[rgba(15,8,5,0.72)] backdrop-blur-md',
        'transition-[border-color,box-shadow,transform] duration-300 ease-out',
        'hover:border-[rgba(240,210,140,0.34)] hover:shadow-[0_14px_36px_rgba(0,0,0,0.38)]',
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
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#edd9c4]">
            {title}
          </CardTitle>
        </div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(240,210,140,0.18)] bg-[rgba(0,0,0,0.2)]"
          aria-hidden
        >
          <Icon className={cn('h-3.5 w-3.5', a.icon)} />
        </div>
      </CardHeader>
      <CardContent className="relative space-y-2 px-5 pb-5 pt-0">
        <div className={cn('font-display text-[1.7rem] leading-none tracking-[0.04em] tabular-nums', a.value)}>
          {value}
        </div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#edd9c4]/70">
          {subtitle}
        </p>
      </CardContent>
    </DashboardCardShell>
  )
}
