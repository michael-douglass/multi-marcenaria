import { CalendarRange, ChevronDown, ChevronUp, LayoutGrid } from 'lucide-react'
import {
  mesAnoFromOffset,
  mesAnoKey,
  type MesAnoRef,
} from '@/components/caixa/CaixaMesFilterBar'
import { describeAgendaMesFiltro, describeAgendaMesFiltroShort } from '@/lib/obra-mes-filtro'
import { cn } from '@/lib/utils'
import type { AgendaMesFiltro } from '@/lib/agenda-mes-filtro-storage'

const QUICK_OFFSETS = [
  { offset: 0, label: 'Este mês' },
  { offset: 1, label: 'Próx. mês' },
  { offset: 2, label: '+2 meses' },
  { offset: 3, label: '+3 meses' },
]

function monthLabel(mes: number, ano: number): string {
  const date = new Date(ano, mes - 1, 1)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

function buildMonthOptions(past = 3, future = 14): MesAnoRef[] {
  const total = past + future + 1
  return Array.from({ length: total }, (_, i) => mesAnoFromOffset(i - past))
}

interface AgendaMesFilterBarProps {
  value: AgendaMesFiltro
  onChange: (value: AgendaMesFiltro) => void
  minimized: boolean
  onMinimizedChange: (minimized: boolean) => void
}

export function AgendaMesFilterBar({
  value,
  onChange,
  minimized,
  onMinimizedChange,
}: AgendaMesFilterBarProps) {
  const monthOptions = buildMonthOptions(3, 14)
  const isAll = value.mode === 'all'
  const selectedKey = value.mode === 'month' ? mesAnoKey(value.mes, value.ano) : ''
  const summary = describeAgendaMesFiltro(value)
  const summaryShort = describeAgendaMesFiltroShort(value)

  const isQuickActive = value.mode === 'month' && QUICK_OFFSETS.some(q => {
    const ref = mesAnoFromOffset(q.offset)
    return value.mes === ref.mes && value.ano === ref.ano
  })

  return (
    <div
      className={cn('agenda-mes-filter', minimized && 'agenda-mes-filter--minimized')}
      role="group"
      aria-label="Filtrar obras por mês de entrega"
    >
      <div className="agenda-mes-filter__head">
        <div className="agenda-mes-filter__head-main">
          <CalendarRange size={minimized ? 12 : 14} className="agenda-mes-filter__head-icon" aria-hidden />
          {!minimized ? (
            <span className="agenda-mes-filter__head-label">Prazo de entrega</span>
          ) : null}
          {minimized ? (
            <span className="agenda-mes-filter__summary capitalize" title={summary}>
              {summaryShort}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="agenda-mes-filter__toggle"
          onClick={() => onMinimizedChange(!minimized)}
          aria-expanded={!minimized}
          aria-label={minimized ? 'Expandir filtro de prazo' : 'Minimizar filtro de prazo'}
          title={minimized ? 'Expandir filtro' : 'Minimizar filtro'}
        >
          {minimized ? <ChevronDown size={14} aria-hidden /> : <ChevronUp size={14} aria-hidden />}
        </button>
      </div>

      {!minimized ? (
        <>
          <div className="agenda-mes-filter__row">
            <button
              type="button"
              className={cn(
                'agenda-mes-filter__pill agenda-mes-filter__pill--all',
                isAll && 'agenda-mes-filter__pill--active',
              )}
              onClick={() => onChange({ mode: 'all' })}
              aria-pressed={isAll}
            >
              <LayoutGrid size={13} className="shrink-0" aria-hidden />
              Todas
            </button>

            <span className="agenda-mes-filter__divider" aria-hidden />

            {QUICK_OFFSETS.map(q => {
              const ref = mesAnoFromOffset(q.offset)
              const active = value.mode === 'month' && value.mes === ref.mes && value.ano === ref.ano
              return (
                <button
                  key={q.offset}
                  type="button"
                  className={cn('agenda-mes-filter__pill', active && 'agenda-mes-filter__pill--active')}
                  onClick={() => onChange({ mode: 'month', mes: ref.mes, ano: ref.ano })}
                  aria-pressed={active}
                >
                  {q.label}
                </button>
              )
            })}

            <select
              className={cn(
                'agenda-mes-filter__select glass-input',
                value.mode === 'month' && !isQuickActive && 'agenda-mes-filter__select--highlight',
              )}
              value={isAll ? '' : selectedKey}
              onChange={e => {
                const key = e.target.value
                if (!key) return
                const [y, m] = key.split('-').map(Number)
                if (m && y) onChange({ mode: 'month', mes: m, ano: y })
              }}
              title="Escolher mês pelo prazo final da obra"
            >
              <option value="" disabled={!isAll}>
                {isAll ? 'Escolher mês…' : monthLabel(value.mes, value.ano)}
              </option>
              {monthOptions.map(opt => {
                const key = mesAnoKey(opt.mes, opt.ano)
                return (
                  <option key={key} value={key}>
                    {monthLabel(opt.mes, opt.ano)}
                  </option>
                )
              })}
            </select>
          </div>

          <p className="agenda-mes-filter__hint">
            {isAll
              ? 'Exibindo todas as obras, sem filtro de mês.'
              : 'O mês considera a data final da obra. Obras em aberto, sem prazo, continuam visíveis.'}
          </p>
        </>
      ) : null}
    </div>
  )
}
