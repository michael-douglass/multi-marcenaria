import type { ObraFull } from '@/types'

export type ChegadaMaterialColKey =
  | 'sem_pedido'
  | 'sem_data'
  | 'atrasada'
  | 'outras_datas'
  | `dia:${string}`

export interface ChegadaMaterialColuna {
  key: ChegadaMaterialColKey
  label: string
  short: string
  cor: string
}

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

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

function fmtDayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  const day = d.getDate()
  const month = d.getMonth() + 1
  return `${WEEKDAYS_SHORT[d.getDay()]} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
}

export function buildChegadaMaterialColunas(weekDays: string[]): ChegadaMaterialColuna[] {
  const base: ChegadaMaterialColuna[] = [
    { key: 'sem_pedido', label: 'Sem Pedido', short: 'Sem Pedido', cor: '#6b7280' },
    { key: 'sem_data', label: 'Aguardando Data', short: 'Sem Data', cor: '#a855f7' },
    { key: 'atrasada', label: 'Chegada Atrasada', short: 'Atrasada', cor: '#ef4444' },
  ]

  const dias = weekDays.map(iso => ({
    key: `dia:${iso}` as ChegadaMaterialColKey,
    label: fmtDayLabel(iso),
    short: fmtDayLabel(iso),
    cor: '#3b82f6',
  }))

  return [
    ...base,
    ...dias,
    { key: 'outras_datas', label: 'Outras Datas', short: 'Outras', cor: '#8a6a55' },
  ]
}

export function obraVisivelNoCalendarioChegada(obra: ObraFull): boolean {
  return obra.status_kanban !== 'cancelada'
}

export function computeChegadaMaterialColKey(
  obra: ObraFull,
  weekDays: string[],
  hoje = todayISO(),
): ChegadaMaterialColKey {
  if (!obra.pedido_material_feito) return 'sem_pedido'
  if (!obra.data_entrega_pedido) return 'sem_data'

  const data = obra.data_entrega_pedido
  if (data < hoje && obra.status_kanban !== 'concluida') return 'atrasada'
  if (weekDays.includes(data)) return `dia:${data}`
  return 'outras_datas'
}

export function groupObrasPorChegadaMaterial(
  obras: ObraFull[],
  weekDays: string[],
): Record<string, ObraFull[]> {
  const map: Record<string, ObraFull[]> = {
    sem_pedido: [],
    sem_data: [],
    atrasada: [],
    outras_datas: [],
  }
  for (const iso of weekDays) map[`dia:${iso}`] = []

  for (const obra of obras) {
    if (!obraVisivelNoCalendarioChegada(obra)) continue
    const key = computeChegadaMaterialColKey(obra, weekDays)
    map[key].push(obra)
  }

  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => {
      const da = a.data_entrega_pedido ?? ''
      const db = b.data_entrega_pedido ?? ''
      if (da !== db) return da.localeCompare(db)
      return a.cliente_nome.localeCompare(b.cliente_nome)
    })
  }

  return map
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

export function colKeyFromDropTarget(key: ChegadaMaterialColKey): {
  pedido_material_feito?: boolean
  data_entrega_pedido?: string | null
} | null {
  if (key === 'sem_pedido') {
    return { pedido_material_feito: false, data_entrega_pedido: null }
  }
  if (key === 'sem_data') {
    return { pedido_material_feito: true, data_entrega_pedido: null }
  }
  if (key.startsWith('dia:')) {
    return { pedido_material_feito: true, data_entrega_pedido: key.slice(4) }
  }
  return null
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
  if (!obra.data_entrega_pedido) return '#8a6a55'
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
