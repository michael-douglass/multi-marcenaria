import {
  buildMarkupCustoOpcoes,
  MARKUP_CUSTOS_FILTRO_DEFAULT,
  sumCustosComFiltro,
} from '@/lib/obra-markup-custos'
import { fmtCur } from '@/lib/utils'
import type { MarkupCustosFiltro, MarkupOrcamentoCustos } from '@/types'

interface ObraMarkupCustosBlockProps {
  custos: MarkupOrcamentoCustos | null | undefined
  filtro?: MarkupCustosFiltro
  onFiltroChange?: (next: MarkupCustosFiltro) => void
  /** compact = card do kanban; default = modal de detalhe */
  variant?: 'compact' | 'default'
}

/** Bloco de custos do markup: cada card escolhe Mat./Serv./Desp. para o total. */
export function ObraMarkupCustosBlock({
  custos,
  filtro = MARKUP_CUSTOS_FILTRO_DEFAULT,
  onFiltroChange,
  variant = 'compact',
}: ObraMarkupCustosBlockProps) {
  if (!custos) return null

  const opcoes = buildMarkupCustoOpcoes(custos)
  const total = sumCustosComFiltro(custos, filtro)
  const compact = variant === 'compact'
  const editavel = typeof onFiltroChange === 'function'

  return (
    <div
      className={[
        'rounded-md border border-[rgba(240,210,140,0.2)] bg-[rgba(255,255,255,0.03)]',
        compact ? 'px-1.5 py-1' : 'px-3 py-2',
      ].join(' ')}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <p
        className={[
          'font-bold uppercase tracking-wide text-[#c4a882] m-0 mb-0.5',
          compact ? 'text-[0.52rem]' : 'text-[0.65rem]',
        ].join(' ')}
      >
        Custos markup
        {editavel && (
          <span className="ml-1 font-medium normal-case tracking-normal text-[#c4a882]/75">
            · marque o que entra no total
          </span>
        )}
      </p>

      <ul className="m-0 flex flex-col gap-0.5 p-0 list-none" role="group" aria-label="Categorias deste card">
        {opcoes.map(opt => {
          const checked = filtro[opt.key]
          const label = compact ? opt.labelCurto : opt.label

          if (editavel) {
            return (
              <li key={opt.key}>
                <label
                  className={[
                    'flex cursor-pointer items-center justify-between gap-2 min-w-0 rounded px-0.5',
                    compact ? 'text-[0.62rem]' : 'text-[0.78rem]',
                    checked ? 'text-[#edd9c4]' : 'text-[#edd9c4]/45',
                    'hover:bg-[rgba(255,255,255,0.04)]',
                  ].join(' ')}
                >
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <input
                      type="checkbox"
                      className="accent-[#f2d892] scale-90 shrink-0"
                      checked={checked}
                      onChange={e =>
                        onFiltroChange({ ...filtro, [opt.key]: e.target.checked })
                      }
                    />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{fmtCur(opt.valor)}</span>
                </label>
              </li>
            )
          }

          if (!checked) return null

          return (
            <li
              key={opt.key}
              className={[
                'flex items-center justify-between gap-2 min-w-0',
                compact ? 'text-[0.62rem]' : 'text-[0.78rem]',
                'text-[#edd9c4]',
              ].join(' ')}
            >
              <span className="truncate">{label}</span>
              <span className="shrink-0 tabular-nums">{fmtCur(opt.valor)}</span>
            </li>
          )
        })}

        <li
          className={[
            'flex items-center justify-between gap-2 min-w-0 mt-0.5 pt-0.5 border-t border-[rgba(240,210,140,0.18)] font-semibold text-[#f2d892]',
            compact ? 'text-[0.62rem]' : 'text-[0.78rem]',
          ].join(' ')}
        >
          <span className="truncate">Total</span>
          <span className="shrink-0 tabular-nums">{fmtCur(total)}</span>
        </li>
      </ul>
    </div>
  )
}
