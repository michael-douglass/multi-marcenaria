import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { reunioesDoDia, type CrmReuniao } from '@/lib/crm-agenda'
import { cn } from '@/lib/utils'

interface AgendaComercialCalendarProps {
  reunioes: CrmReuniao[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
}

export function AgendaComercialCalendar({ reunioes, selectedDate, onSelectDate }: AgendaComercialCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate)
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
  })
  const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

  const statusDoDia = (date: Date) => {
    const doDia = reunioesDoDia(reunioes, date)
    if (doDia.length === 0) return null
    const hasConcluida = doDia.some(r => r.status === 'concluido')
    const hasPendente = doDia.some(r => r.status === 'pendente' || r.status === 'confirmado')
    if (hasPendente && hasConcluida) return 'mixed'
    if (hasConcluida) return 'concluida'
    return 'pendente'
  }

  return (
    <div className="rounded-lg border border-border/80 bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <Button variant="ghost" size="icon" type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1">
        {diasSemana.map(dia => (
          <div key={dia} className="py-1 text-center text-xs font-medium text-muted-foreground">{dia}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
          const status = statusDoDia(day)
          const selected = isSameDay(day, selectedDate)
          const count = reunioesDoDia(reunioes, day).length
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                'relative h-9 w-full rounded-md text-sm font-medium transition-colors',
                'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/50',
                !isCurrentMonth && 'text-muted-foreground/40',
                isToday(day) && 'bg-primary text-primary-foreground hover:bg-primary/90',
                selected && !isToday(day) && 'bg-accent ring-2 ring-primary',
                status === 'pendente' && 'bg-amber-100 dark:bg-amber-900/30',
                status === 'concluida' && 'bg-green-100 dark:bg-green-900/30',
                status === 'mixed' && 'bg-gradient-to-br from-amber-100 to-green-100 dark:from-amber-900/30 dark:to-green-900/30',
              )}
            >
              {format(day, 'd')}
              {count > 0 && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-amber-700" />
          <span className="text-muted-foreground">Pendente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-green-700" />
          <span className="text-muted-foreground">Concluída</span>
        </div>
      </div>
    </div>
  )
}
