export const EVENTO_TIPOS = ['festa_fim_ano', 'arquitetos', 'outro'] as const
export type EventoTipo = (typeof EVENTO_TIPOS)[number]

export const EVENTO_SECOES = ['detalhes', 'discurso', 'palestra'] as const
export type EventoSecao = (typeof EVENTO_SECOES)[number]

export const EVENTO_UNIDADES = ['un', 'L', 'kg', 'g'] as const
export type EventoUnidade = (typeof EVENTO_UNIDADES)[number]

export const EVENTO_PDF_COLUNAS = [
  { id: 'participantes', label: 'Participantes' },
  { id: 'itens', label: 'Itens e preços' },
  { id: 'caderno', label: 'Caderno' },
  { id: 'totais', label: 'Totais' },
  { id: 'tarefas', label: 'Tarefas' },
] as const

export type EventoPdfColunaId = (typeof EVENTO_PDF_COLUNAS)[number]['id']

export const EVENTO_LAPIS_CORES = ['#f0d28c', '#ffffff', '#e85d4c', '#4aa3ff', '#2a1812'] as const

export interface EventoDesenho {
  id: string
  path_data: string
  cor: string
  stroke_width: number
}

export interface EventoPasta {
  id: string
  titulo: string
  data_evento: string
  tipo: EventoTipo
  tipo_custom: string | null
  observacoes: string | null
  fixado: boolean
  ordem_topo: number | null
  criado_por: string | null
  criado_em: string
  atualizado_em: string
}

export interface EventoPastaCard extends EventoPasta {
  pessoas: number
  itens: number
  valor_estimado: number
  tarefas_pendentes: number
}

export interface EventoMidia {
  id: string
  file_url: string
  storage_path: string | null
  file_name: string | null
  anotacoes: EventoDesenho[]
  ordem: number
  criado_em: string
}

export interface EventoParticipante {
  id: string
  evento_id: string
  lead_id: number | null
  nome: string
  telefone: string | null
  email: string | null
  ordem: number
  criado_em: string
  midias: EventoMidia[]
}

export interface EventoItem {
  id: string
  evento_id: string
  catalogo_item_id: string | null
  nome: string
  quantidade: number
  unidade: EventoUnidade
  preco_unitario: number
  fornecedor: string | null
  telefone_fornecedor: string | null
  ordem: number
  criado_em: string
  atualizado_em: string
  midias: EventoMidia[]
}

export interface EventoCatalogoItem {
  id: string
  nome: string
  nome_normalizado: string
  preco_unitario: number
  unidade_padrao: EventoUnidade
  fornecedor: string | null
  telefone_fornecedor: string | null
}

export interface EventoPagina {
  id: string
  evento_id: string
  secao: EventoSecao
  titulo: string
  corpo: string
  ordem: number
  criado_em: string
  atualizado_em: string
}

export interface EventoTarefa {
  id: string
  evento_id: string
  titulo: string
  concluida: boolean
  ordem: number
  criado_em: string
  atualizado_em: string
}

export interface EventoBoard {
  evento: EventoPasta
  participantes: EventoParticipante[]
  itens: EventoItem[]
  paginas: EventoPagina[]
  tarefas: EventoTarefa[]
}

export interface EventoTotais {
  pessoas: number
  itens: number
  total: number
}

export const EVENTO_SECAO_DICAS: Record<EventoSecao, { aba: string; dica: string }> = {
  detalhes: { aba: 'Detalhes', dica: 'Roteiro, horários e observações do dia' },
  discurso: { aba: 'Discursos', dica: 'Textos para quem vai falar' },
  palestra: { aba: 'Palestras', dica: 'Pauta e anotações de palco' },
}
