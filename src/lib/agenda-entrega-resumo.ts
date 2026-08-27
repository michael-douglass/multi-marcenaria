import { obraEmAberto } from '@/lib/obra-pedido-material'
import { formatObraMesAnoLabel, obraPertenceAoMesPorEntrega } from '@/lib/obra-mes-filtro'
import { getStatusEfetivo } from '@/lib/obra-progresso'
import type { ObraFull } from '@/types'

/** Recorte rápido do quadro: entrega deste mês, atrasos ou entrega do mês seguinte. */
export type AgendaEntregaDestaque = 'mes' | 'atraso' | 'proximo'

export interface AgendaMesAno {
  mes: number
  ano: number
}

export interface AgendaEntregaResumo {
  mesAtual: AgendaMesAno
  mesProximo: AgendaMesAno
  entregarMes: number
  emAtraso: number
  entregarProximo: number
}

export function mesAnoAtual(ref: Date = new Date()): AgendaMesAno {
  return { mes: ref.getMonth() + 1, ano: ref.getFullYear() }
}

export function mesAnoProximo(ref: Date = new Date()): AgendaMesAno {
  const d = new Date(ref.getFullYear(), ref.getMonth() + 1, 1)
  return { mes: d.getMonth() + 1, ano: d.getFullYear() }
}

/** Obra ainda aberta com prazo de entrega no mês informado. */
export function obraAEntregarNoMes(
  obra: ObraFull,
  mes: number,
  ano: number,
): boolean {
  if (!obraEmAberto(obra)) return false
  return obraPertenceAoMesPorEntrega(obra, mes, ano)
}

/** Prazo passou e a obra ainda não foi concluída nem cancelada. */
export function obraEmAtrasoEntrega(obra: ObraFull, refDate: Date = new Date()): boolean {
  return getStatusEfetivo(obra, refDate) === 'datas_em_atraso'
}

export function filterObrasPorEntregaDestaque(
  obras: ObraFull[],
  destaque: AgendaEntregaDestaque,
  refDate: Date = new Date(),
): ObraFull[] {
  const atual = mesAnoAtual(refDate)
  const proximo = mesAnoProximo(refDate)

  if (destaque === 'mes') {
    return obras.filter(obra => obraAEntregarNoMes(obra, atual.mes, atual.ano))
  }
  if (destaque === 'proximo') {
    return obras.filter(obra => obraAEntregarNoMes(obra, proximo.mes, proximo.ano))
  }
  return obras.filter(obra => obraEmAtrasoEntrega(obra, refDate))
}

/** Conta os três recortes em uma só passada pela lista. */
export function summarizeAgendaEntrega(
  obras: ObraFull[],
  refDate: Date = new Date(),
): AgendaEntregaResumo {
  const mesAtual = mesAnoAtual(refDate)
  const mesProximo = mesAnoProximo(refDate)
  let entregarMes = 0
  let emAtraso = 0
  let entregarProximo = 0

  for (const obra of obras) {
    if (obraAEntregarNoMes(obra, mesAtual.mes, mesAtual.ano)) entregarMes += 1
    if (obraAEntregarNoMes(obra, mesProximo.mes, mesProximo.ano)) entregarProximo += 1
    if (obraEmAtrasoEntrega(obra, refDate)) emAtraso += 1
  }

  return { mesAtual, mesProximo, entregarMes, emAtraso, entregarProximo }
}

export function describeAgendaEntregaDestaque(
  destaque: AgendaEntregaDestaque,
  refDate: Date = new Date(),
): string {
  if (destaque === 'atraso') return 'somente obras em atraso'
  if (destaque === 'proximo') {
    const proximo = mesAnoProximo(refDate)
    return `somente a entregar em ${formatObraMesAnoLabel(proximo.mes, proximo.ano)}`
  }
  const atual = mesAnoAtual(refDate)
  return `somente a entregar em ${formatObraMesAnoLabel(atual.mes, atual.ano)}`
}
