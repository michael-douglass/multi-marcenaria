import { addMonths, endOfMonth, isOverdue, todayISO } from '@/lib/utils'
import type { ContaPagar } from '@/types'

export type PeriodMode =
  | 'all'
  | 'month'
  | 'next-month'
  | 'next-6m'
  | 'fixed-month'
  | 'fixed-day'
  | 'date-range'

export interface PeriodFilter {
  mode: PeriodMode
  month?: string  // fixed-month
  day?: string    // fixed-day (YYYY-MM-DD)
  from?: string   // date-range start (YYYY-MM-DD)
  to?: string     // date-range end (YYYY-MM-DD)
}

export const DEFAULT_PERIOD: PeriodFilter = { mode: 'all' }

/** Período "Tudo": lista completa, sem recorte por calendário. */
export function isSemDatasDefinidas(period: PeriodFilter): boolean {
  return period.mode === 'all'
}

/** 0 = atrasada, 1 = pendente no mês atual, 2 = pendente em meses futuros, 3 = paga */
export function contasPagarSortGroup(vencimento: string, status: string): number {
  if (status === 'pago') return 3
  if (isOverdue(vencimento)) return 0
  const today = todayISO()
  const monthStart = `${today.slice(0, 7)}-01`
  const monthEnd = endOfMonth(today)
  if (vencimento >= monthStart && vencimento <= monthEnd) return 1
  return 2
}

export function sortContasPagarSemDatas<T extends Pick<ContaPagar, 'data_vencimento' | 'status'>>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const ga = contasPagarSortGroup(a.data_vencimento, a.status)
    const gb = contasPagarSortGroup(b.data_vencimento, b.status)
    if (ga !== gb) return ga - gb
    return a.data_vencimento.localeCompare(b.data_vencimento)
  })
}

export function applyPeriodFilter<T extends Pick<ContaPagar, 'data_vencimento'>>(
  items: T[],
  period: PeriodFilter,
): T[] {
  const today = todayISO()

  switch (period.mode) {
    case 'all':
      return items

    case 'fixed-month': {
      const month = period.month
      if (!month) return items
      const start = `${month}-01`
      const end = endOfMonth(start)
      return items.filter(
        p => !!p.data_vencimento && p.data_vencimento >= start && p.data_vencimento <= end,
      )
    }

    case 'month': {
      const start = today.slice(0, 7) + '-01'
      const end = endOfMonth(today)
      return items.filter(
        p => !!p.data_vencimento && p.data_vencimento >= start && p.data_vencimento <= end,
      )
    }

    case 'next-month': {
      const firstOfNext = addMonths(today.slice(0, 7) + '-01', 1)
      const start = firstOfNext.slice(0, 7) + '-01'
      const end = endOfMonth(firstOfNext)
      return items.filter(
        p => !!p.data_vencimento && p.data_vencimento >= start && p.data_vencimento <= end,
      )
    }

    case 'next-6m': {
      const end = addMonths(today, 6)
      return items.filter(
        p => !!p.data_vencimento && p.data_vencimento >= today && p.data_vencimento <= end,
      )
    }

    case 'fixed-day': {
      const day = period.day
      if (!day) return items
      return items.filter(p => !!p.data_vencimento && p.data_vencimento === day)
    }

    case 'date-range': {
      const { from, to } = period
      if (!from && !to) return items
      return items.filter(p => {
        if (!p.data_vencimento) return false
        if (from && p.data_vencimento < from) return false
        if (to && p.data_vencimento > to) return false
        return true
      })
    }
  }
}

const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: '.3rem .9rem',
  borderRadius: '9999px',
  fontSize: '.75rem',
  fontWeight: 600,
  border: active ? '1px solid #f2d892' : '1px solid rgba(240,210,140,.2)',
  background: active ? 'rgba(240,210,140,.14)' : 'transparent',
  color: active ? '#f2d892' : '#edd9c4',
  cursor: 'pointer',
  transition: 'all .15s',
  fontFamily: 'Raleway, sans-serif',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  whiteSpace: 'nowrap' as const,
})

const dateInputStyle = (active: boolean): React.CSSProperties => ({
  height: 30,
  minHeight: 30,
  width: 'auto',
  minWidth: 130,
  padding: '0 .6rem',
  fontSize: '.75rem',
  borderRadius: 8,
  border: active ? '1px solid rgba(240,210,140,.5)' : '1px solid rgba(240,210,140,.2)',
  background: active ? 'rgba(240,210,140,.07)' : 'rgba(255,255,255,.03)',
  color: active ? '#fffaf4' : '#edd9c4',
  fontFamily: 'Raleway, sans-serif',
  outline: 'none',
  transition: 'all .15s',
  colorScheme: 'dark' as const,
})

const PRESETS: { mode: PeriodMode; label: string }[] = [
  { mode: 'all', label: 'Tudo' },
  { mode: 'month', label: 'Este Mês' },
  { mode: 'next-month', label: 'Próx. Mês' },
  { mode: 'next-6m', label: '6 Meses' },
]

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

function buildMonthOptions(count = 12): string[] {
  const first = todayISO().slice(0, 7) + '-01'
  return Array.from({ length: count }, (_, i) => addMonths(first, i).slice(0, 7))
}

interface PeriodFilterBarProps {
  value: PeriodFilter
  onChange: (v: PeriodFilter) => void
}

export function PeriodFilterBar({ value, onChange }: PeriodFilterBarProps) {
  const monthOptions = buildMonthOptions(12)

  const isDayActive = value.mode === 'fixed-day'
  const isRangeActive = value.mode === 'date-range'

  return (
    <div className="flex gap-2 flex-wrap mb-4" style={{ alignItems: 'center' }}>
      {PRESETS.map(p => (
        <button
          key={p.mode}
          type="button"
          style={pillStyle(value.mode === p.mode)}
          onClick={() => onChange({ ...value, mode: p.mode })}
        >
          {p.label}
        </button>
      ))}

      <select
        className="glass-input"
        style={{ height: 30, minHeight: 30, width: 'auto', padding: '0 .75rem', fontSize: '.75rem' }}
        value={value.mode === 'fixed-month' ? value.month ?? '' : ''}
        onChange={e => {
          const month = e.target.value
          if (!month) return
          onChange({ ...value, mode: 'fixed-month', month })
        }}
      >
        <option value="">Selecionar mês</option>
        {monthOptions.map(month => (
          <option key={month} value={month}>
            {monthLabel(month)}
          </option>
        ))}
      </select>

      {/* Separador visual */}
      <span style={{ color: 'rgba(240,210,140,.2)', fontSize: '.85rem', lineHeight: '30px' }}>|</span>

      {/* Dia específico */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}>
        <button
          type="button"
          style={pillStyle(isDayActive)}
          onClick={() => onChange({ ...value, mode: 'fixed-day', day: value.day || todayISO() })}
          title="Filtrar por dia específico"
        >
          Dia
        </button>
        <input
          type="date"
          style={dateInputStyle(isDayActive)}
          value={value.day ?? ''}
          onChange={e => {
            if (e.target.value) onChange({ ...value, mode: 'fixed-day', day: e.target.value })
          }}
          title="Selecione um dia específico"
        />
      </div>

      {/* Período personalizado */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={pillStyle(isRangeActive)}
          onClick={() => onChange({ ...value, mode: 'date-range' })}
          title="Filtrar por período personalizado"
        >
          Período
        </button>
        <input
          type="date"
          style={dateInputStyle(isRangeActive)}
          value={value.from ?? ''}
          onChange={e => onChange({ ...value, mode: 'date-range', from: e.target.value })}
          title="Data inicial do período"
        />
        <span style={{ color: '#edd9c4', fontSize: '.75rem', lineHeight: '30px' }}>→</span>
        <input
          type="date"
          style={dateInputStyle(isRangeActive)}
          value={value.to ?? ''}
          onChange={e => onChange({ ...value, mode: 'date-range', to: e.target.value })}
          title="Data final do período"
        />
      </div>
    </div>
  )
}
