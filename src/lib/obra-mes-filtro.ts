import type { AgendaMesFiltro } from '@/lib/agenda-mes-filtro-storage'
import type { ObraFull } from '@/types'

/** Mês/ano da data de entrega (último prazo) da obra. */
export function mesAnoFromDataEntrega(data: string): { mes: number; ano: number } {
  const [ano, mes] = data.slice(0, 10).split('-').map(Number)
  return { mes, ano }
}

/**
 * Obra pertence ao mês pela data prevista de fim (entrega).
 * Ex.: 20/06 → 05/07 entra em julho, não em junho.
 */
export function obraPertenceAoMesPorEntrega(
  obra: Pick<ObraFull, 'data_prevista_fim'>,
  mes: number,
  ano: number,
): boolean {
  if (!obra.data_prevista_fim) return false
  const ref = mesAnoFromDataEntrega(obra.data_prevista_fim)
  return ref.mes === mes && ref.ano === ano
}

export function filterObrasPorMesEntrega(obras: ObraFull[], mes: number, ano: number): ObraFull[] {
  return obras.filter(obra => obraPertenceAoMesPorEntrega(obra, mes, ano))
}

export function applyAgendaMesFiltro(obras: ObraFull[], filtro: AgendaMesFiltro): ObraFull[] {
  if (filtro.mode === 'all') return obras
  return filterObrasPorMesEntrega(obras, filtro.mes, filtro.ano)
}

export function formatObraMesAnoLabel(mes: number, ano: number): string {
  const date = new Date(ano, mes - 1, 1)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

export function describeAgendaMesFiltro(filtro: AgendaMesFiltro): string {
  if (filtro.mode === 'all') return 'Todas as obras'
  return `Entrega em ${formatObraMesAnoLabel(filtro.mes, filtro.ano)}`
}

/** Rótulo curto para o chip minimizado do filtro. */
export function describeAgendaMesFiltroShort(filtro: AgendaMesFiltro): string {
  if (filtro.mode === 'all') return 'Todas'
  const date = new Date(filtro.ano, filtro.mes - 1, 1)
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(date)
}
