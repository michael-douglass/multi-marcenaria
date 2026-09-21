import { normalizeObraDate } from '@/lib/date-br'
import type { ObraFull } from '@/types'

export interface AgendaDisponibilidadeResumo {
  /** Último `data_prevista_fim` entre obras ainda abertas. */
  ultimoDiaComObra: string | null
  /** Primeiro dia em que a agenda fica totalmente livre (dia seguinte ao último fim). */
  primeiraDataLivre: string
}

type ObraDisponibilidade = Pick<ObraFull, 'data_prevista_fim' | 'status_kanban'>

function hojeIsoLocal(ref: Date = new Date()): string {
  const y = ref.getFullYear()
  const m = String(ref.getMonth() + 1).padStart(2, '0')
  const d = String(ref.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Ultimo dia com obra marcada (maior data de entrega prevista
 * entre obras que ainda não foram concluídas nem canceladas).
 */
export function getUltimoDiaComObraMarcada(obras: ObraDisponibilidade[]): string | null {
  let max: string | null = null
  for (const obra of obras) {
    if (obra.status_kanban === 'concluida' || obra.status_kanban === 'cancelada') continue
    const fim = normalizeObraDate(obra.data_prevista_fim)
    if (!fim) continue
    if (!max || fim > max) max = fim
  }
  return max
}

/**
 * Primeira data a partir da qual a agenda fica totalmente disponível:
 * o dia seguinte ao ultimo fim previsto. Se não houver obras abertas
 * (ou o ultimo fim já passou), usa o dia de hoje.
 */
export function getPrimeiraDataTotalmenteDisponivel(
  obras: ObraDisponibilidade[],
  refDate: Date = new Date(),
): AgendaDisponibilidadeResumo {
  const hoje = hojeIsoLocal(refDate)
  const ultimoDiaComObra = getUltimoDiaComObraMarcada(obras)

  if (!ultimoDiaComObra) {
    return { ultimoDiaComObra: null, primeiraDataLivre: hoje }
  }

  const candidata = addDaysIso(ultimoDiaComObra, 1)
  return {
    ultimoDiaComObra,
    primeiraDataLivre: candidata < hoje ? hoje : candidata,
  }
}
