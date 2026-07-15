import { Package, Filter } from 'lucide-react'
import { fmtCur } from '@/lib/utils'
import type { MarkupCustosFiltro } from '@/types'

interface ObraMarkupCustosToolbarProps {
  totalPedidoAFazer: number
  filtro: MarkupCustosFiltro
  onFiltroChange: (next: MarkupCustosFiltro) => void
  loading?: boolean
}

const FILTRO_OPTS: Array<{ key: keyof MarkupCustosFiltro; label: string }> = [
  { key: 'materiais', label: 'Materiais' },
  { key: 'servicos', label: 'Serviços' },
  { key: 'despesas', label: 'Despesas' },
]

/** Total “pedido a fazer” + filtro de categorias de custo (somente Administrador). */
export function ObraMarkupCustosToolbar({
  totalPedidoAFazer,
  filtro,
  onFiltroChange,
  loading = false,
}: ObraMarkupCustosToolbarProps) {
  return (
    <div className="flex flex-col items-start gap-1.5 min-w-0">
      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(74,222,128,0.38)] bg-[rgba(34,197,94,0.12)] px-2.5 py-1 text-[0.68rem] font-semibold text-[#4ade80]"
        title="Soma dos custos ligados no filtro (materiais, serviços e/ou despesas) das obras ativas sem pedido de material feito"
        role="status"
      >
        <Package size={14} className="shrink-0" aria-hidden />
        <span className="whitespace-nowrap">
          Pedido a fazer:{' '}
          {loading ? '…' : fmtCur(totalPedidoAFazer)}
        </span>
      </div>

      <div
        className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[rgba(240,210,140,0.22)] bg-[rgba(255,255,255,0.03)] px-2 py-1"
        role="group"
        aria-label="Filtrar custos do markup nos cards"
      >
        <Filter size={12} className="shrink-0 text-[#c4a882]" aria-hidden />
        {FILTRO_OPTS.map(opt => {
          const checked = filtro[opt.key]
          return (
            <label
              key={opt.key}
              className={[
                'inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide transition-colors',
                checked
                  ? 'bg-[rgba(240,210,140,0.16)] text-[#f2d892]'
                  : 'text-[#d4bc9f] hover:bg-[rgba(255,255,255,0.04)]',
              ].join(' ')}
            >
              <input
                type="checkbox"
                className="accent-[#f2d892] scale-90"
                checked={checked}
                onChange={e => onFiltroChange({ ...filtro, [opt.key]: e.target.checked })}
              />
              {opt.label}
            </label>
          )
        })}
      </div>
    </div>
  )
}
