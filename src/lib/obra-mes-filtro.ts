import { endOfMonth } from '@/lib/utils'
import type { ObraFull } from '@/types'

function monthBounds(mes: number, ano: number): { start: string; end: string } {
  const start = `${ano}-${String(mes).padStart(2, '0')}-01`
  return { start, end: endOfMonth(start) }
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && aEnd >= bStart
}

/** Obra aparece no mês se o período previsto cruza o mês ou ainda não tem datas definidas. */
export function obraIntersectsMes(
  obra: Pick<ObraFull, 'data_prevista_inicio' | 'data_prevista_fim'>,
  mes: number,
  ano: number,
): boolean {
  if (!obra.data_prevista_inicio && !obra.data_prevista_fim) return true

  const { start, end } = monthBounds(mes, ano)
  const obraStart = obra.data_prevista_inicio ?? obra.data_prevista_fim!
  const obraEnd = obra.data_prevista_fim ?? obra.data_prevista_inicio!

  return rangesOverlap(obraStart, obraEnd, start, end)
}

export function filterObrasPorMes(obras: ObraFull[], mes: number, ano: number): ObraFull[] {
  return obras.filter(obra => obraIntersectsMes(obra, mes, ano))
}

export function formatObraMesAnoLabel(mes: number, ano: number): string {
  const date = new Date(ano, mes - 1, 1)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}
