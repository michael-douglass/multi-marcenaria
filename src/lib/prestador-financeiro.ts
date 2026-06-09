import { supabase } from '@/lib/supabase'
import type { PrestadorFinanceiroItem } from '@/types'

export const PRESTADOR_MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const

export const PRESTADOR_MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
] as const

export async function fetchPrestadorMes(
  mes: number,
  ano: number,
): Promise<PrestadorFinanceiroItem[]> {
  const { data: rows, error } = await supabase.rpc('movelaria_prestador_financeiro', {
    p_mes: mes,
    p_ano: ano,
  })
  if (error) throw error
  return (rows ?? []) as PrestadorFinanceiroItem[]
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
