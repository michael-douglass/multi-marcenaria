import { Filter } from 'lucide-react'

export const CONTAS_PAGAR_STATUS_FILTER_OPTIONS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pago', label: 'Pagas' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'vencido', label: 'Vencidos' },
  { key: 'parcialmente_pago', label: 'Parc. Pagas' },
] as const

export type ContasPagarStatusFilterKey = (typeof CONTAS_PAGAR_STATUS_FILTER_OPTIONS)[number]['key']

interface ContasPagarPanelStatusFilterProps {
  activeKeys: Set<string>
  onToggle: (key: string) => void
}

/** Chips de status no painel Exportar / Ocultar — tema claro do papel Garbo. */
export function ContasPagarPanelStatusFilter({ activeKeys, onToggle }: ContasPagarPanelStatusFilterProps) {
  return (
    <div className="cobrancas-action-panel__section cobrancas-action-panel__section--filters">
      <p className="cobrancas-action-panel__label">
        <Filter className="h-3 w-3 shrink-0 text-[#6b3f12]" aria-hidden />
        Filtrar lista por status
      </p>
      <div className="cobrancas-status-chips" role="group" aria-label="Filtrar lista por status">
        {CONTAS_PAGAR_STATUS_FILTER_OPTIONS.map(opt => {
          const active = activeKeys.has(opt.key)
          return (
            <button
              key={opt.key}
              type="button"
              className={`cobrancas-status-chip${active ? ' cobrancas-status-chip--active' : ''}`}
              aria-pressed={active}
              onClick={() => onToggle(opt.key)}
            >
              {active ? '✕ ' : ''}
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
