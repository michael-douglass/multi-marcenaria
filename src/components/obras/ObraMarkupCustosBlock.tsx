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
        'obra-paper-inset rounded-md',
        compact ? 'px-1.5 py-1' : 'px-3 py-2',
      ].join(' ')}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      <p
        className={[
          'obra-field-label m-0 mb-0.5',
          compact ? 'text-[0.52rem]' : 'text-[0.65rem]',
        ].join(' ')}
      >
        Custos markup
        {editavel && (
          <span className="ml-1 font-medium normal-case tracking-normal text-[var(--color-text-muted)]">
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
                    checked ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-faint)]',
                    'hover:bg-[rgba(42,24,18,0.04)]',
                  ].join(' ')}
                >
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <input
                      type="checkbox"
                      className="accent-[#8d5e22] scale-90 shrink-0"
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
                'text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              <span className="truncate">{label}</span>
              <span className="shrink-0 tabular-nums">{fmtCur(opt.valor)}</span>
            </li>
          )
        })}

        <li
          className={[
            'flex items-center justify-between gap-2 min-w-0 mt-0.5 pt-0.5 border-t border-[var(--color-gold-border)] font-semibold text-[var(--color-gold-muted)]',
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
