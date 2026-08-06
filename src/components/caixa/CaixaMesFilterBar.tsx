import { addMonths, todayISO } from '@/lib/utils'

export interface MesAnoRef {
  mes: number
  ano: number
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
  whiteSpace: 'nowrap' as const,
})

export function mesAnoFromOffset(offset: number): MesAnoRef {
  const shifted = addMonths(`${todayISO().slice(0, 7)}-01`, offset)
  return {
    mes: Number(shifted.slice(5, 7)),
    ano: Number(shifted.slice(0, 4)),
  }
}

export function mesAnoKey(mes: number, ano: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`
}

function monthLabel(mes: number, ano: number): string {
  const date = new Date(ano, mes - 1, 1)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

function buildMonthOptions(past = 2, future = 12): MesAnoRef[] {
  const first = `${todayISO().slice(0, 7)}-01`
  const total = past + future + 1
  return Array.from({ length: total }, (_, i) => {
    const shifted = addMonths(first, i - past)
    return {
      mes: Number(shifted.slice(5, 7)),
      ano: Number(shifted.slice(0, 4)),
    }
  })
}

const QUICK_OFFSETS = [
  { offset: 0, label: 'Este mês' },
  { offset: 1, label: 'Próx. mês' },
  { offset: 2, label: '+2 meses' },
  { offset: 3, label: '+3 meses' },
  { offset: 6, label: '+6 meses' },
]

interface CaixaMesFilterBarProps {
  mes: number
  ano: number
  onChange: (mes: number, ano: number) => void
  /** No popup: uma linha só, com rolagem horizontal se precisar. */
  compact?: boolean
}

export function CaixaMesFilterBar({ mes, ano, onChange, compact = false }: CaixaMesFilterBarProps) {
  const monthOptions = buildMonthOptions(2, 12)
  const selectedKey = mesAnoKey(mes, ano)

  const isQuickActive = QUICK_OFFSETS.some(q => {
    const ref = mesAnoFromOffset(q.offset)
    return mes === ref.mes && ano === ref.ano
  })

  return (
    <div
      className={
        compact
          ? 'flex max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'flex flex-wrap items-center gap-2'
      }
      data-caixa-mes-filter={compact ? 'compact' : 'default'}
    >
      {QUICK_OFFSETS.map(q => {
        const ref = mesAnoFromOffset(q.offset)
        const active = mes === ref.mes && ano === ref.ano
        return (
          <button
            key={q.offset}
            type="button"
            style={
              compact
                ? { ...pillStyle(active), padding: '.25rem .7rem', fontSize: '.7rem' }
                : pillStyle(active)
            }
            onClick={() => onChange(ref.mes, ref.ano)}
            className={compact ? 'shrink-0' : undefined}
          >
            {q.label}
          </button>
        )
      })}

      <span className="text-[#edd9c4] text-xs hidden sm:inline shrink-0">|</span>

      <select
        className={
          compact
            ? 'glass-input !h-8 !text-xs min-w-[10rem] shrink-0'
            : 'glass-input !h-9 !text-xs min-w-[11rem]'
        }
        value={selectedKey}
        onChange={e => {
          const [y, m] = e.target.value.split('-').map(Number)
          if (m && y) onChange(m, y)
        }}
        title="Ver outros meses (passados e próximos)"
        style={{
          borderColor: !isQuickActive ? 'rgba(240,210,140,.5)' : undefined,
          background: !isQuickActive ? 'rgba(240,210,140,.07)' : undefined,
        }}
      >
        <optgroup label="Próximos e anteriores">
          {monthOptions.map(opt => {
            const key = mesAnoKey(opt.mes, opt.ano)
            return (
              <option key={key} value={key}>
                {monthLabel(opt.mes, opt.ano)}
              </option>
            )
          })}
        </optgroup>
      </select>
    </div>
  )
}
