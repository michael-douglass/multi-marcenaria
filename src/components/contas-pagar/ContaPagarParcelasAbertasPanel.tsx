import { Badge } from '@/components/ui/badge'
import {
  getContasRelacionadas,
  getTituloLancamento,
} from '@/lib/contas-pagar-grupo'
import { fmtCur, fmtDate, isOverdue, parseMoneyBr } from '@/lib/utils'
import type { ContaPagar } from '@/types'

export interface ParcelaRascunhoValor {
  valorParcela: string
  vencimento: string
}

interface ContaPagarParcelasAbertasPanelProps {
  contaAtual: ContaPagar
  todasContas: ContaPagar[]
  onSelecionarParcela?: (conta: ContaPagar) => void
  /** Valores digitados nesta sessão (ainda não salvos). */
  valoresRascunho?: Record<string, ParcelaRascunhoValor>
}

function statusParcela(conta: ContaPagar, vencimentoExibido: string): string {
  if (conta.status === 'pago') return 'pago'
  if (isOverdue(vencimentoExibido)) return 'vencido'
  return 'pendente'
}

function valorExibido(
  conta: ContaPagar,
  rascunho?: ParcelaRascunhoValor,
): number {
  if (rascunho?.valorParcela != null && rascunho.valorParcela !== '') {
    const parsed = parseMoneyBr(rascunho.valorParcela)
    if (parsed > 0) return parsed
  }
  return conta.valor_parcela
}

function vencimentoExibido(
  conta: ContaPagar,
  rascunho?: ParcelaRascunhoValor,
): string {
  return rascunho?.vencimento || conta.data_vencimento
}

function rascunhoAlterou(
  conta: ContaPagar,
  rascunho?: ParcelaRascunhoValor,
): boolean {
  if (!rascunho) return false
  const valor = parseMoneyBr(rascunho.valorParcela)
  const valorMudou =
    rascunho.valorParcela !== '' &&
    Number.isFinite(valor) &&
    Math.abs(valor - conta.valor_parcela) > 0.005
  const vencMudou =
    !!rascunho.vencimento &&
    rascunho.vencimento !== (conta.data_vencimento?.slice(0, 10) ?? '')
  return valorMudou || vencMudou
}

export function ContaPagarParcelasAbertasPanel({
  contaAtual,
  todasContas,
  onSelecionarParcela,
  valoresRascunho = {},
}: ContaPagarParcelasAbertasPanelProps) {
  const parcelas = getContasRelacionadas(contaAtual, todasContas)
  const parcelasAbertas = parcelas.filter(c => c.status !== 'pago')
  const totalAberto = parcelasAbertas.reduce(
    (s, p) => s + valorExibido(p, valoresRascunho[p.id]),
    0,
  )
  const nome =
    contaAtual.fornecedor_nome ?? contaAtual.descricao ?? 'Sem nome'
  const valorMensalRecorrente =
    contaAtual.recorrencia_valor_base ?? contaAtual.valor_parcela
  const rascunhoAtual = valoresRascunho[contaAtual.id]
  const vencAtual = vencimentoExibido(contaAtual, rascunhoAtual)
  const valorAtual = valorExibido(contaAtual, rascunhoAtual)

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
            Venc. {fmtDate(vencAtual)}
            {' · '}
            {fmtCur(valorAtual)}
          </p>
          {contaAtual.recorrente && contaAtual.recorrencia_id ? (
            <p className="mt-1 text-xs text-[#d4bc9f]">
              Valor mensal recorrente:{' '}
              <span className="text-[#fbbf24] font-semibold">{fmtCur(valorMensalRecorrente)}</span>
              {contaAtual.recorrencia_encerramento
                ? ` · encerra em ${fmtDate(contaAtual.recorrencia_encerramento)}`
                : ' · geração contínua (12 meses à frente)'}
            </p>
          ) : null}
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

      {parcelas.length === 0 ? (
        <p className="text-sm text-[#edd9c4]">
          Nenhuma parcela encontrada neste lançamento.
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
              {parcelas.map(p => {
                const isAtual = p.id === contaAtual.id
                const draft = valoresRascunho[p.id]
                const alterado = rascunhoAlterou(p, draft)
                const venc = vencimentoExibido(p, draft)
                const valor = valorExibido(p, draft)
                const s = statusParcela(p, venc)
                return (
                  <tr
                    key={p.id}
                    className={
                      isAtual
                        ? 'bg-[rgba(240,210,140,.12)]'
                        : alterado
                          ? 'bg-amber-500/10'
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
                      {alterado && !isAtual ? (
                        <span className="ml-1.5 text-[0.65rem] text-amber-300">
                          (alterado)
                        </span>
                      ) : null}
                    </td>
                    <td
                      className="px-3 py-2"
                      style={{
                        color: s === 'vencido'
                          ? '#f87171'
                          : alterado
                            ? '#fbbf24'
                            : '#edd9c4',
                      }}
                    >
                      {fmtDate(venc)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${
                        alterado ? 'text-amber-300' : 'text-[#f2d892]'
                      }`}
                    >
                      {fmtCur(valor)}
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
