import type { ObraFull } from '@/types'

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function startOfWeekISO(anchor: Date): string {
  const d = new Date(anchor)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function getWeekDayISOs(anchor: Date): string[] {
  const start = startOfWeekISO(anchor)
  return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i))
}

export function obraVisivelNoCalendarioChegada(obra: ObraFull): boolean {
  return obra.status_kanban !== 'cancelada'
}

export function formatWeekRangeLabel(weekDays: string[]): string {
  if (weekDays.length === 0) return ''
  const start = new Date(`${weekDays[0]}T12:00:00`)
  const end = new Date(`${weekDays[6]}T12:00:00`)
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} de ${months[start.getMonth()]} ${start.getFullYear()}`
  }
  return `${start.getDate()}/${months[start.getMonth()]} – ${end.getDate()}/${months[end.getMonth()]} ${end.getFullYear()}`
}

export function obrasParaDiaChegada(
  obras: ObraFull[],
  iso: string,
): ObraFull[] {
  return obras
    .filter(o =>
      obraVisivelNoCalendarioChegada(o)
      && o.pedido_material_feito
      && o.data_entrega_pedido === iso,
    )
    .sort((a, b) => a.cliente_nome.localeCompare(b.cliente_nome))
}

export function getChegadaCardColor(obra: ObraFull, hoje = todayISO()): string {
  if (!obra.data_entrega_pedido) return '#edd9c4'
  if (obra.data_entrega_pedido < hoje && obra.status_kanban !== 'concluida') return '#ef4444'
  if (obra.status_kanban === 'concluida') return '#10b981'
  return '#34d399'
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addMonthsToDate(d: Date, months: number): Date {
  const next = new Date(d)
  next.setMonth(next.getMonth() + months)
  return next
}

export function getMonthGrid(anchor: Date): Date[] {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days: Date[] = []

  for (let i = first.getDay(); i > 0; i--) {
    days.push(new Date(year, month, 1 - i))
  }
  for (let i = 1; i <= last.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i))
  }

  return days
}

const MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function formatCalendarRangeLabel(view: 'week' | 'month', anchor: Date, weekDays: string[]): string {
  if (view === 'week') return formatWeekRangeLabel(weekDays)
  return `${MONTHS_FULL[anchor.getMonth()]} ${anchor.getFullYear()}`
}
