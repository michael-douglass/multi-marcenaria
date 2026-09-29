export const EVENTO_TIPOS = ['festa_fim_ano', 'arquitetos', 'outro'] as const
export type EventoTipo = (typeof EVENTO_TIPOS)[number]

/** Slug legado nas folhas (antes dos cadernos separados). Ainda gravado em `secao` por compatibilidade. */
export const EVENTO_SECOES = ['detalhes', 'discurso', 'palestra'] as const
export type EventoSecao = (typeof EVENTO_SECOES)[number]

/** Cadernos padrão ao criar uma pasta nova (cada um = um tipo de conteúdo). */
export const EVENTO_CADERNOS_PADRAO = [
  { titulo: 'Detalhes', dica: 'Roteiro, horários e observações do dia', secao: 'detalhes' as const },
  { titulo: 'Discursos', dica: 'Textos para quem vai falar', secao: 'discurso' as const },
  { titulo: 'Palestras', dica: 'Pauta e anotações de palco', secao: 'palestra' as const },
] as const

export const EVENTO_UNIDADES = ['un', 'L', 'kg', 'g'] as const
export type EventoUnidade = (typeof EVENTO_UNIDADES)[number]

export const EVENTO_PDF_COLUNAS = [
  { id: 'participantes', label: 'Participantes' },
  { id: 'itens', label: 'Itens e preços' },
  { id: 'caderno', label: 'Caderno (texto e fotos da folha)' },
  { id: 'anexos', label: 'Anexos (imagens e PDF convertidos)' },
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

export interface EventoCaderno {
  id: string
  evento_id: string
  titulo: string
  dica: string | null
  ordem: number
  criado_em: string
  atualizado_em: string
}

export interface EventoPagina {
  id: string
  evento_id: string
  caderno_id: string
  /** Legado: detalhes | discurso | palestra | livre (cadernos novos). */
  secao: EventoSecao | 'livre'
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
  /** Espelho na agenda pessoal (crm_multiempresas_agenda_pessoal_tarefas). */
  agenda_tarefa_id: string | null
}

export interface EventoBoard {
  evento: EventoPasta
  participantes: EventoParticipante[]
  itens: EventoItem[]
  cadernos: EventoCaderno[]
  paginas: EventoPagina[]
  tarefas: EventoTarefa[]
  /** Fotos/PDF convertidos anexados na pasta (não ligados a pessoa/item). */
  galeria: EventoMidia[]
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

export function dicaDoCaderno(caderno: Pick<EventoCaderno, 'titulo' | 'dica'>): string {
  const dica = caderno.dica?.trim()
  if (dica) return dica
  return `Conteúdo do caderno “${caderno.titulo.trim() || 'Sem nome'}”`
}
