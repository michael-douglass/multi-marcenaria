import { supabase } from '@/lib/supabase'

export type MontadorComissaoSituacao = 'concluida' | 'em_aberto'

export interface MontadorComissaoObra {
  obra_id: string
  cliente_nome: string
  tipo_obra_nome: string | null
  status_kanban: string
  comissao_valor: number
  situacao: MontadorComissaoSituacao
  oculto_prestador?: boolean
}

export interface MetricasComissaoPeriodo {
  mes: number
  ano: number
}

/** Obras concluídas e previsão (em andamento) do montador no mês. */
export async function fetchMontadorComissaoObras(
  periodo: MetricasComissaoPeriodo,
  montadorId: string,
): Promise<MontadorComissaoObra[]> {
  const { data, error } = await supabase.rpc('movelaria_metricas_comissao_obras_montador', {
    p_mes: periodo.mes,
    p_ano: periodo.ano,
    p_montador_id: montadorId,
  })

  if (error) throw error

  return ((data ?? []) as Array<{
    obra_id: string
    cliente_nome: string
    tipo_obra_nome: string | null
    status_kanban: string
    comissao_valor: number
    situacao: string
    oculto_prestador?: boolean
  }>).map(row => ({
    obra_id: row.obra_id,
    cliente_nome: row.cliente_nome,
    tipo_obra_nome: row.tipo_obra_nome,
    status_kanban: row.status_kanban,
    comissao_valor: Number(row.comissao_valor),
    situacao: row.situacao === 'concluida' ? 'concluida' : 'em_aberto',
    oculto_prestador: !!row.oculto_prestador,
  }))
}

export function sumMontadorComissaoObras(obras: MontadorComissaoObra[], situacao?: MontadorComissaoSituacao): number {
  return obras
    .filter(o => !situacao || o.situacao === situacao)
    .reduce((acc, o) => acc + o.comissao_valor, 0)
}
