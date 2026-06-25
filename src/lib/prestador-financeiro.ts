import { supabase } from '@/lib/supabase'
import type { PrestadorFinanceiroCategoria, PrestadorFinanceiroItem } from '@/types'

export const PRESTADOR_MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const

export const PRESTADOR_MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
] as const

export function normalizePrestadorItem(item: PrestadorFinanceiroItem): PrestadorFinanceiroItem {
  if (item.categoria !== 'fixo' || item.tipo === 'pagamento') return item
  return {
    ...item,
    tipo: 'pagamento',
    status: item.status === 'pago' ? 'pago' : 'pendente',
  }
}

export function dedupeFixoPrestadorItens(data: PrestadorFinanceiroItem[]): PrestadorFinanceiroItem[] {
  const nonFixo = data.filter(i => i.categoria !== 'fixo')
  const fixoByMes = new Map<string, PrestadorFinanceiroItem>()

  for (const item of data.filter(i => i.categoria === 'fixo')) {
    const key = item.data_referencia?.slice(0, 7) ?? item.conta_pagar_id ?? item.descricao ?? 'fixo'
    const existing = fixoByMes.get(key)
    if (!existing) {
      fixoByMes.set(key, item)
      continue
    }
    const rank = (i: PrestadorFinanceiroItem) => {
      if (i.status === 'pago') return 3
      if (i.conta_pagar_id) return 2
      return 1
    }
    if (rank(item) >= rank(existing)) fixoByMes.set(key, item)
  }

  return [...nonFixo, ...fixoByMes.values()]
}

export function normalizePrestadorItens(data: PrestadorFinanceiroItem[]): PrestadorFinanceiroItem[] {
  return dedupeFixoPrestadorItens(data.map(normalizePrestadorItem))
}

export async function fetchPrestadorMes(
  mes: number,
  ano: number,
): Promise<PrestadorFinanceiroItem[]> {
  const { data: rows, error } = await supabase.rpc('movelaria_prestador_financeiro', {
    p_mes: mes,
    p_ano: ano,
  })
  if (error) throw error
  return normalizePrestadorItens(
    (rows ?? []).map((row: Record<string, unknown>) => ({
      tipo: row.tipo as PrestadorFinanceiroItem['tipo'],
      obra_id: row.obra_id ? String(row.obra_id) : null,
      conta_pagar_id: row.conta_pagar_id ? String(row.conta_pagar_id) : null,
      cliente_nome: String(row.cliente_nome ?? ''),
      descricao: row.descricao ? String(row.descricao) : null,
      valor: Number(row.valor) || 0,
      status: String(row.status ?? ''),
      data_referencia: row.data_referencia ? String(row.data_referencia) : null,
      categoria: (row.categoria as PrestadorFinanceiroCategoria) ?? 'comissao',
    })),
  )
}

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

export function isPrestadorItemAReceber(i: PrestadorFinanceiroItem): boolean {
  return i.tipo === 'previsto' || (i.tipo === 'pagamento' && i.status !== 'pago')
}

export function sumPrestadorItens(
  itens: PrestadorFinanceiroItem[],
  filter: (i: PrestadorFinanceiroItem) => boolean,
): number {
  return itens.filter(filter).reduce((acc, i) => acc + (Number(i.valor) || 0), 0)
}

export function resumoFromItens(data: PrestadorFinanceiroItem[]) {
  const { aReceber, recebidas } = splitPrestadorItens(data)
  const totalPrevisto = sumPrestadorItens(
    data,
    i => i.tipo === 'previsto' && i.categoria !== 'fixo',
  )
  const totalPendente = sumPrestadorItens(
    data,
    i => i.tipo === 'pagamento' && i.status !== 'pago',
  )
  const totalPago = sumPrestadorItens(
    data,
    i => i.tipo === 'pagamento' && i.status === 'pago',
  )
  const totalFixo = sumPrestadorItens(
    data,
    i => i.categoria === 'fixo' && isPrestadorItemAReceber(i),
  )
  const totalComissao = sumPrestadorItens(
    data,
    i => (i.categoria ?? 'comissao') === 'comissao' && isPrestadorItemAReceber(i),
  )
  const totalFixoMes = sumPrestadorItens(data, i => i.categoria === 'fixo')
  const totalComissaoMes = sumPrestadorItens(
    data,
    i => (i.categoria ?? 'comissao') === 'comissao',
  )
  const totalMes = totalFixoMes + totalComissaoMes
  return {
    aReceber,
    recebidas,
    totalPrevisto,
    totalPendente,
    totalPago,
    totalFixo,
    totalComissao,
    totalFixoMes,
    totalComissaoMes,
    totalAReceber: totalPrevisto + totalPendente,
    totalCombinado: totalFixo + totalComissao,
    totalMes,
  }
}
