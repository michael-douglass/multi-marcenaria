import { Badge } from '@/components/ui/Badge'
import {
  getParcelasEmAberto,
  getTituloLancamento,
} from '@/lib/contas-pagar-grupo'
import { fmtCur, fmtDate, isOverdue } from '@/lib/utils'
import type { ContaPagar } from '@/types'

interface ContaPagarParcelasAbertasPanelProps {
  contaAtual: ContaPagar
  todasContas: ContaPagar[]
  onSelecionarParcela?: (conta: ContaPagar) => void
}

function statusParcela(conta: ContaPagar): string {
  if (conta.status === 'pago') return 'pago'
  if (isOverdue(conta.data_vencimento)) return 'vencido'
  return 'pendente'
}

export function ContaPagarParcelasAbertasPanel({
  contaAtual,
  todasContas,
  onSelecionarParcela,
}: ContaPagarParcelasAbertasPanelProps) {
  const parcelasAbertas = getParcelasEmAberto(contaAtual, todasContas)
  const totalAberto = parcelasAbertas.reduce((s, p) => s + p.valor_parcela, 0)
  const nome =
    contaAtual.fornecedor_nome ?? contaAtual.descricao ?? 'Sem nome'

  return (
    <div
      className="mb-5 rounded-lg border border-[rgba(240,210,140,.22)] bg-[rgba(240,210,140,.06)] p-4"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">
            {getTituloLancamento(contaAtual)}
          </p>
          <p className="text-base font-semibold text-[#fffaf4]">{nome}</p>
          <p className="mt-1 text-xs text-[#edd9c4]">
            Parcela em edição:{' '}
            <span className="text-[#f2d892] font-semibold">
              {contaAtual.numero_parcela}/{contaAtual.total_parcelas}
            </span>
            {' · '}
            Venc. {fmtDate(contaAtual.data_vencimento)}
            {' · '}
            {fmtCur(contaAtual.valor_parcela)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#edd9c4]">
            Total em aberto
          </p>
          <p className="text-lg font-bold text-[#fbbf24]">{fmtCur(totalAberto)}</p>
          <p className="text-xs text-[#edd9c4]">
            {parcelasAbertas.length} parcela{parcelasAbertas.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {parcelasAbertas.length === 0 ? (
        <p className="text-sm text-[#edd9c4]">
          Todas as parcelas deste lançamento estão pagas.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-white/5">
          <table className="w-full min-w-[480px] text-left text-[0.82rem]">
            <thead>
              <tr className="border-b border-white/5 text-[0.65rem] uppercase tracking-wider text-[#edd9c4]">
                <th className="px-3 py-2">Parcela</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-center">Status</th>
                {onSelecionarParcela ? (
                  <th className="px-3 py-2 text-right">Ação</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {parcelasAbertas.map(p => {
                const isAtual = p.id === contaAtual.id
                const s = statusParcela(p)
                return (
                  <tr
                    key={p.id}
                    className={
                      isAtual
                        ? 'bg-[rgba(240,210,140,.12)]'
                        : 'hover:bg-white/[0.02]'
                    }
                  >
                    <td className="px-3 py-2 font-medium text-[#fffaf4]">
                      {p.numero_parcela}/{p.total_parcelas}
                      {isAtual ? (
                        <span className="ml-1.5 text-[0.65rem] text-[#f2d892]">
                          (editando)
                        </span>
                      ) : null}
                    </td>
                    <td
                      className="px-3 py-2"
                      style={{ color: s === 'vencido' ? '#f87171' : '#edd9c4' }}
                    >
                      {fmtDate(p.data_vencimento)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-[#f2d892]">
                      {fmtCur(p.valor_parcela)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge status={s} />
                    </td>
                    {onSelecionarParcela ? (
                      <td className="px-3 py-2 text-right">
                        {!isAtual ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm text-xs"
                            onClick={() => onSelecionarParcela(p)}
                          >
                            Editar
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[rgba(240,210,140,.2)] bg-black/20">
                <td className="px-3 py-2 font-bold text-[#f2d892]" colSpan={2}>
                  Soma em aberto
                </td>
                <td className="px-3 py-2 text-right font-bold text-[#fbbf24]">
                  {fmtCur(totalAberto)}
                </td>
                <td colSpan={onSelecionarParcela ? 2 : 1} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
