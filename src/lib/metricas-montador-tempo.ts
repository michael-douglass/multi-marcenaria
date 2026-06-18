import type { MetricaObraDetalhe } from '@/types'

export interface MontadorObraTempo {
  obra_id: string
  cliente_nome: string
  tipo_obra_nome: string | null
  duracao_horas: number
  duracao_em_andamento: boolean
  iniciado_em: string | null
  finalizado_em: string | null
}

export interface MontadorTempoResumo {
  montador_id: string
  montador_nome: string
  obras: MontadorObraTempo[]
  tempo_total_horas: number
  tempo_medio_horas: number
  obras_com_duracao: number
}

/** Agrupa duração por montador e ordena do menor tempo médio ao maior. */
export function buildMontadorTempoRanking(porObra: MetricaObraDetalhe[]): MontadorTempoResumo[] {
  const map = new Map<string, MontadorTempoResumo>()

  for (const row of porObra) {
    if (row.duracao_horas == null || Number.isNaN(Number(row.duracao_horas))) continue

    const horas = Number(row.duracao_horas)
    let entry = map.get(row.montador_id)
    if (!entry) {
      entry = {
        montador_id: row.montador_id,
        montador_nome: row.montador_nome,
        obras: [],
        tempo_total_horas: 0,
        tempo_medio_horas: 0,
        obras_com_duracao: 0,
      }
      map.set(row.montador_id, entry)
    }

    entry.obras.push({
      obra_id: row.obra_id,
      cliente_nome: row.cliente_nome,
      tipo_obra_nome: row.tipo_obra_nome,
      duracao_horas: horas,
      duracao_em_andamento: row.duracao_em_andamento,
      iniciado_em: row.iniciado_em,
      finalizado_em: row.finalizado_em,
    })
    entry.tempo_total_horas += horas
  }

  return Array.from(map.values())
    .map(entry => {
      const obras = [...entry.obras].sort((a, b) => a.duracao_horas - b.duracao_horas)
      const qtd = obras.length
      return {
        ...entry,
        obras,
        obras_com_duracao: qtd,
        tempo_medio_horas: qtd > 0 ? entry.tempo_total_horas / qtd : 0,
      }
    })
    .sort((a, b) => a.tempo_medio_horas - b.tempo_medio_horas)
}

export function fmtHorasChart(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}min`
  const horas = Math.floor(h)
  const mins = Math.round((h - horas) * 60)
  return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`
}
