import type { PrestadorFinanceiroItem } from '@/types'

export function mesAnterior(mes: number, ano: number): { mes: number; ano: number } {
  if (mes <= 1) return { mes: 12, ano: ano - 1 }
  return { mes: mes - 1, ano }
}

export function splitPrestadorItens(data: PrestadorFinanceiroItem[]) {
  const aReceber = data.filter(
    i => i.tipo === 'previsto' || (i.tipo === 'pagamento' && i.status !== 'pago'),
  )
  const recebidas = data.filter(
    i => i.tipo === 'pagamento' && i.status === 'pago',
  )
  return { aReceber, recebidas }
}

export function sumPrestadorItens(
  itens: PrestadorFinanceiroItem[],
  filter: (i: PrestadorFinanceiroItem) => boolean,
): number {
  return itens.filter(filter).reduce((acc, i) => acc + (Number(i.valor) || 0), 0)
}

export function resumoFromItens(data: PrestadorFinanceiroItem[]) {
  const { aReceber, recebidas } = splitPrestadorItens(data)
  const totalPrevisto = sumPrestadorItens(data, i => i.tipo === 'previsto')
  const totalPendente = sumPrestadorItens(
    data,
    i => i.tipo === 'pagamento' && i.status !== 'pago',
  )
  const totalPago = sumPrestadorItens(
    data,
    i => i.tipo === 'pagamento' && i.status === 'pago',
  )
  return {
    aReceber,
    recebidas,
    totalPrevisto,
    totalPendente,
    totalPago,
    totalAReceber: totalPrevisto + totalPendente,
    totalMes: totalPrevisto + totalPendente + totalPago,
  }
}
