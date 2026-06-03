import type { ContaPagar } from '../types'

function mesmaParcelaLancamento(a: ContaPagar, b: ContaPagar): boolean {
  if (a.total_parcelas <= 1 || b.total_parcelas <= 1) return false
  if (a.total_parcelas !== b.total_parcelas) return false
  if (a.valor_total != null && b.valor_total != null && a.valor_total !== b.valor_total) {
    return false
  }
  const mesmoFornecedor =
    (a.fornecedor_id && a.fornecedor_id === b.fornecedor_id)
    || (a.fornecedor_nome && a.fornecedor_nome === b.fornecedor_nome)
  if (!mesmoFornecedor) return false
  return (a.descricao ?? '') === (b.descricao ?? '')
}

/** Parcelas do mesmo lançamento (grupo parcelado ou recorrência). */
export function getContasRelacionadas(conta: ContaPagar, all: ContaPagar[]): ContaPagar[] {
  if (conta.grupo_lancamento_id) {
    return all
      .filter(c => c.grupo_lancamento_id === conta.grupo_lancamento_id)
      .sort((a, b) => a.numero_parcela - b.numero_parcela)
  }
  if (conta.recorrente && conta.recorrencia_id) {
    return all
      .filter(c => c.recorrencia_id === conta.recorrencia_id)
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
  }
  if (conta.total_parcelas > 1) {
    const irmaos = all.filter(c => mesmaParcelaLancamento(conta, c))
    if (irmaos.length > 1) {
      return irmaos.sort((a, b) => a.numero_parcela - b.numero_parcela)
    }
  }
  return [conta]
}

/** ID do grupo de anexos compartilhado entre parcelas do mesmo lançamento. */
export function resolveGrupoLancamentoId(
  conta: ContaPagar,
  all: ContaPagar[],
): string | null {
  if (conta.grupo_lancamento_id) return conta.grupo_lancamento_id
  const relacionadas = getContasRelacionadas(conta, all)
  return relacionadas.find(c => c.grupo_lancamento_id)?.grupo_lancamento_id ?? null
}

export function lancamentoCompartilhaAnexos(conta: ContaPagar): boolean {
  return (
    !!conta.grupo_lancamento_id
    || conta.total_parcelas > 1
    || !!(conta.recorrente && conta.recorrencia_id)
  )
}

export function getParcelasEmAberto(conta: ContaPagar, all: ContaPagar[]): ContaPagar[] {
  return getContasRelacionadas(conta, all).filter(c => c.status !== 'pago')
}

export function getTituloLancamento(conta: ContaPagar): string {
  if (conta.grupo_lancamento_id && conta.total_parcelas > 1) {
    return `Lançamento parcelado (${conta.total_parcelas} parcelas)`
  }
  if (conta.recorrente && conta.recorrencia_id) {
    return 'Cobrança recorrente'
  }
  return 'Lançamento'
}
