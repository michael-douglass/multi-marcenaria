import { obraPertenceAoMesPorEntrega } from '@/lib/obra-mes-filtro'
import type { ObraFull } from '@/types'

export interface VisualizacaoObrasMesStats {
  total: number
  aFinalizarMes: number
  concluidasMes: number
}

/** Contagens para o painel Calendário de Obras na Visualização. */
export function getVisualizacaoObrasMesStats(
  obras: ObraFull[],
  mes: number,
  ano: number,
): VisualizacaoObrasMesStats {
  const ativas = obras.filter(o => o.status_kanban !== 'cancelada')
  const doMes = ativas.filter(o => obraPertenceAoMesPorEntrega(o, mes, ano))

  return {
    total: ativas.length,
    aFinalizarMes: doMes.length,
    concluidasMes: doMes.filter(o => o.status_kanban === 'concluida').length,
  }
}
