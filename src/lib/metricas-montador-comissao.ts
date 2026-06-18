import type { MetricaObraDetalhe } from '@/types'

export type MontadorComissaoSituacao = 'concluida' | 'em_aberto'

export interface MontadorComissaoObra {
  obra_id: string
  cliente_nome: string
  tipo_obra_nome: string | null
  status_kanban: string
  comissao_valor: number
  situacao: MontadorComissaoSituacao
}

/** Obras com comissão configurada para o montador no período carregado. */
export function getMontadorComissaoObras(
  porObra: MetricaObraDetalhe[],
  montadorId: string,
): MontadorComissaoObra[] {
  return porObra
    .filter(row =>
      row.montador_id === montadorId
      && row.comissao_habilitada
      && Number(row.comissao_valor) > 0,
    )
    .map(row => ({
      obra_id: row.obra_id,
      cliente_nome: row.cliente_nome,
      tipo_obra_nome: row.tipo_obra_nome,
      status_kanban: row.status_kanban,
      comissao_valor: Number(row.comissao_valor),
      situacao: row.status_kanban === 'concluida' ? 'concluida' : 'em_aberto',
    }))
    .sort((a, b) => {
      if (a.situacao !== b.situacao) {
        return a.situacao === 'concluida' ? -1 : 1
      }
      return a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR')
    })
}

export function sumMontadorComissaoObras(obras: MontadorComissaoObra[], situacao?: MontadorComissaoSituacao): number {
  return obras
    .filter(o => !situacao || o.situacao === situacao)
    .reduce((acc, o) => acc + o.comissao_valor, 0)
}
