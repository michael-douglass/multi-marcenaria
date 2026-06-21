import { cn } from '@/lib/utils'
import { todayISO } from '@/lib/obra-chegada-material'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

interface VisualizacaoSemanaDiaProps {
  iso: string
  count: number
  children: React.ReactNode
  className?: string
}

export function VisualizacaoSemanaDia({ iso, count, children, className }: VisualizacaoSemanaDiaProps) {
  const hoje = todayISO()
  const day = new Date(`${iso}T12:00:00`)
  const isToday = iso === hoje

  return (
    <div
      className={cn(
        'viz-week-day glass-card flex flex-col p-2',
        count === 0 && 'min-h-[120px]',
        isToday && 'ring-1 ring-[#f2d892]/65',
        className,
      )}
    >
      <div className="viz-week-day__header shrink-0">
        <div className={cn('viz-week-day__title', isToday && 'text-[#f2d892]')}>
          <span>{WEEKDAYS[day.getDay()]}</span>
          {count > 0 ? <span className="viz-week-day__count">{count}</span> : null}
        </div>
        <span className="viz-week-day__date">
          {day.getDate()}/{MONTHS[day.getMonth()]}
          {isToday ? <span className="viz-week-day__hoje">hoje</span> : null}
        </span>
      </div>
      <div className="viz-week-day__cards">{children}</div>
    </div>
  )
}
