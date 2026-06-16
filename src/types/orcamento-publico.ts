export interface OrcamentoSlideDados {
  _meta?: { etapa?: number }
  respostas?: Record<string, string | string[]>
  precificacao?: OrcamentoPrecificacao
  prazo_entrega?: string
  inicio_execucao?: string
  garantia_meses?: string
  textos_blocos?: Record<string, string>
}

export interface OrcamentoPrecificacao {
  parcelas?: number
  valor_final?: number
  valor_entrada?: number
  valor_entrega?: number
  valor_parcela?: number
  valor_integral?: number
  desconto_percent?: number
  forma_pagamento_id?: string
  forma_pagamento_tipo?: string
}

export interface OrcamentoSlide {
  id: string
  identificador: string
  lead_id: string | null
  cliente_nome: string
  status: string
  dados: OrcamentoSlideDados
  criado_em: string
  atualizado_em: string
}

export interface OrcamentoSlideTemplate {
  id: string
  nome: string
  cor_primaria: string
  cor_secundaria: string
  cor_texto: string
  cor_fundo: string
  fonte_titulo: string | null
  fonte_corpo: string | null
  logo_url: string | null
  fundo_url: string | null
}

export interface OrcamentoSlideBloco {
  id: string
  template_id: string
  tipo: string
  ordem: number
  config: Record<string, unknown>
  ativo: boolean
}

export interface OrcamentoSlidePergunta {
  id: string
  label: string
  tipo: string
  ordem: number
}

export interface OrcamentoSlideOpcao {
  id: string
  pergunta_id: string
  label: string
  valor: string
  ordem: number
}

export interface OrcamentoSlideFormaPagamento {
  id: string
  tipo: string
  nome: string
  descricao: string | null
}

export interface OrcamentoSlideMidia {
  id: string
  orcamento_id: string
  tipo: string
  file_url: string
  file_name: string | null
  ordem: number
}

export interface OrcamentoPublicoPayload {
  slide: OrcamentoSlide
  template: OrcamentoSlideTemplate
  blocos: OrcamentoSlideBloco[]
  perguntas: OrcamentoSlidePergunta[]
  opcoes: OrcamentoSlideOpcao[]
  formasPagamento: OrcamentoSlideFormaPagamento[]
  midias: OrcamentoSlideMidia[]
}
