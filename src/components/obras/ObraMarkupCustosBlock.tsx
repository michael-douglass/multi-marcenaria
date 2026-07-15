import { buildMarkupCustoLinhas } from '@/lib/obra-markup-custos'
import { fmtCur } from '@/lib/utils'
import type { MarkupCustosFiltro, MarkupOrcamentoCustos } from '@/types'

interface ObraMarkupCustosBlockProps {
  custos: MarkupOrcamentoCustos | null | undefined
  filtro: MarkupCustosFiltro
  /** compact = card do kanban; default = modal de detalhe */
  variant?: 'compact' | 'default'
}

/** Bloco de custos do markup abaixo do pedido de material (só Administrador). */
export function ObraMarkupCustosBlock({
  custos,
  filtro,
  variant = 'compact',
}: ObraMarkupCustosBlockProps) {
  if (!custos) return null

  const linhas = buildMarkupCustoLinhas(custos, filtro)
  if (linhas.length === 0) return null

  const compact = variant === 'compact'

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
      </p>
      <ul className="m-0 flex flex-col gap-0.5 p-0 list-none">
        {linhas.map(linha => {
          const isTotal = linha.key === 'total'
          return (
            <li
              key={linha.key}
              className={[
                'flex items-center justify-between gap-2 min-w-0',
                compact ? 'text-[0.62rem]' : 'text-[0.78rem]',
                isTotal ? 'mt-0.5 pt-0.5 border-t border-[rgba(240,210,140,0.18)] font-semibold text-[#f2d892]' : 'text-[#edd9c4]',
              ].join(' ')}
            >
              <span className="truncate">{linha.label}</span>
              <span className="shrink-0 tabular-nums">{fmtCur(linha.valor)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
