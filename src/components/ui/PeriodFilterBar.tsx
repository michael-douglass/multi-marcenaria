import { addMonths, endOfMonth, todayISO } from '@/lib/utils'
import type { ContaPagar } from '@/types'

export type PeriodMode = 'all' | 'month' | 'next-month' | 'next-6m' | 'fixed-month'

export interface PeriodFilter {
  mode: PeriodMode
  month?: string
}

export const DEFAULT_PERIOD: PeriodFilter = { mode: 'month' }

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
  }
}

const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: '.3rem .9rem',
  borderRadius: '9999px',
  fontSize: '.75rem',
  fontWeight: 600,
  border: active ? '1px solid #d4a853' : '1px solid rgba(212,168,83,.2)',
  background: active ? 'rgba(212,168,83,.14)' : 'transparent',
  color: active ? '#d4a853' : '#8a6a55',
  cursor: 'pointer',
  transition: 'all .15s',
  fontFamily: 'Raleway, sans-serif',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
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

  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {PRESETS.map(p => (
        <button
          key={p.mode}
          type="button"
          style={pillStyle(value.mode === p.mode)}
          onClick={() => onChange({ mode: p.mode })}
        >
          {p.label}
        </button>
      ))}

      <select
        className="glass-input !h-[30px] !min-h-[30px] !w-auto !px-3 !py-0 text-xs"
        value={value.mode === 'fixed-month' ? value.month ?? '' : ''}
        onChange={e => {
          const month = e.target.value
          if (!month) return
          onChange({ mode: 'fixed-month', month })
        }}
      >
        <option value="">Selecionar mês</option>
        {monthOptions.map(month => (
          <option key={month} value={month}>
            {monthLabel(month)}
          </option>
        ))}
      </select>
    </div>
  )
}
