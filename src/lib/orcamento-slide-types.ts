export type OrcamentoSlideStatus = 'rascunho' | 'pronto' | 'enviado';

export type BlocoTipo =
  | 'capa'
  | 'valorizacao'
  | 'comparativo_ferragens'
  | 'galeria_projetos'
  | 'antes_depois'
  | 'imagem_interativa'
  | 'comparativo_mdf'
  | 'precificacao'
  | 'precos_fracionados'
  | 'prazos'
  | 'garantia'
  | 'script'
  | 'solicitar_fotos'
  | 'texto_livre'
  | 'dados_projeto'
  | 'imagens_orcamento'
  | 'analise_ia';

export type PerguntaTipo = 'texto' | 'select' | 'multi' | 'imagem' | 'numero' | 'toggle' | 'data';

export type CatalogCategoria = 'ferragem' | 'mdf' | 'usinagem';

export type MidiaTipo = 'projeto' | 'antes' | 'depois' | 'ambiente_cliente' | 'capa' | 'anexo';

export type MidiaOrigem =
  | 'upload'
  | 'lead_anexo'
  | 'lead_whiteboard'
  | 'lead_ai_render'
  | 'biblioteca';

export type FotoPosicao = 'esquerda' | 'direita';
export type OrdemMobile = 'texto_primeiro' | 'imagem_primeiro';
/** Desktop: texto antes, depois ou centralizado sobre a imagem. */
export type TextoPosicaoImagem = 'antes' | 'depois' | 'sobre_imagem';
export type AlinhamentoLayout = 'esquerda' | 'centro' | 'direita';
export type FotoAlturaMobile = 'compacta' | 'media' | 'grande';
/** Altura mínima do slide do bloco na apresentação. */
export type BlocoAlturaVisual = 'padrao' | 'grande' | 'maxima';
/** Escala do texto e cards (Ferragens / Investimento). */
export type BlocoEscalaVisual = 'normal' | 'grande' | 'maxima';

export interface BlocoLayoutViewport {
  foto_posicao?: FotoPosicao;
  /** Posição da imagem no bloco (esquerda / centro / direita). */
  imagem_alinhamento?: AlinhamentoLayout;
  painel_largura_pct?: number;
  /** Largura da imagem em % do espaço do bloco (20–100). */
  foto_largura_pct?: number;
  ordem_mobile?: OrdemMobile;
  /** Desktop: posição do texto em relação à imagem. */
  texto_posicao_imagem?: TextoPosicaoImagem;
  colunas?: 1 | 2 | 3;
  alinhamento?: AlinhamentoLayout;
  padding_x?: number;
  foto_altura?: FotoAlturaMobile;
  altura_visual?: BlocoAlturaVisual;
  escala_visual?: BlocoEscalaVisual;
}

export interface BlocoLayoutConfig {
  desktop?: BlocoLayoutViewport;
  mobile?: BlocoLayoutViewport;
}

export interface BlocoFerragemItem {
  titulo: string;
  descricao: string;
  imagem_url?: string;
}

export interface OrcamentoSlideTemplate {
  id: string;
  nome: string;
  cor_primaria: string;
  cor_secundaria: string;
  cor_texto: string;
  cor_fundo: string;
  fonte_titulo: string;
  fonte_corpo: string;
  logo_url: string | null;
  fundo_url: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface OrcamentoSlideBloco {
  id: string;
  template_id: string;
  tipo: BlocoTipo;
  ordem: number;
  config: Record<string, unknown>;
  ativo: boolean;
  criado_em: string;
}

export interface OrcamentoPergunta {
  id: string;
  label: string;
  tipo: PerguntaTipo;
  obrigatorio: boolean;
  ordem: number;
  ativo: boolean;
  criado_em: string;
  opcoes?: OrcamentoPerguntaOpcao[];
}

export interface OrcamentoPerguntaOpcao {
  id: string;
  pergunta_id: string;
  label: string;
  valor: string;
  ordem: number;
}

export interface OrcamentoCatalogoItem {
  id: string;
  categoria: CatalogCategoria;
  titulo: string;
  descricao: string | null;
  imagem_url: string | null;
  destaque: boolean;
  ativo: boolean;
  ordem: number;
  criado_em: string;
}

export interface OrcamentoScript {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  ativo: boolean;
  criado_em: string;
}

export type FormaPagamentoTipo = 'a_vista' | 'parcelado' | 'entrada_entrega';

export interface OrcamentoFormaPagamento {
  id: string;
  tipo: FormaPagamentoTipo;
  nome: string;
  descricao: string | null;
  parcelas_padrao: number;
  entrada_percent: number;
  entrega_percent: number;
  ativo: boolean;
  ordem: number;
  criado_em: string;
}

export interface PrecoFracionadoItem {
  label: string;
  valor: number;
}

/**
 * Ocorrência selecionada de uma forma do catálogo.
 * Permite duplicar a mesma forma (ex.: 2× à vista) com descontos/parcelas distintos —
 * `id` é a chave dos Records; `forma_id` aponta para o catálogo.
 */
export interface FormaPagamentoSelecao {
  id: string;
  forma_id: string;
}

/** Bloco independente de preços fracionados (pode haver vários no mesmo orçamento). */
export interface GrupoPrecosFracionados {
  id: string;
  /** Título opcional exibido no slide (ex.: “Por ambiente”). */
  titulo?: string;
  itens: PrecoFracionadoItem[];
  /** Quando false, oculta a soma deste grupo no slide. Padrão: true. */
  exibir_total?: boolean;
}

/** Composição resumida do markup (sem detalhar linhas). */
export interface MarkupComposicaoPrecificacao {
  materiais: number;
  servicos: number;
  despesas: number;
  /** Preço calculado: custos + sobras + frete + imposto + taxas + margem. */
  resumo?: number;
  /** % de sobras aplicado sobre materiais. */
  fator_sobras?: number;
  /** % de margem de lucro. */
  margem_lucro?: number;
  /** % de imposto. */
  percentual_imposto?: number;
  /** % de taxas financeiras. */
  taxas_financeiras?: number;
  /** Frete em R$. */
  custo_frete?: number;
}

export interface OrcamentoPrecificacao {
  valor_integral: number;
  parcelas: number;
  valor_parcela: number;
  desconto_percent: number;
  /** Acréscimo (%) da forma principal (ex.: juros no parcelado). */
  acrescimo_percent?: number;
  valor_final: number;
  /** @deprecated Preferir formas_pagamento_ids — mantido para compatibilidade. */
  forma_pagamento_id?: string | null;
  forma_pagamento_tipo?: FormaPagamentoTipo | null;
  valor_entrada?: number;
  valor_entrega?: number;
  /**
   * Formas exibidas no slide (instâncias).
   * Preferir este campo — permite duplicar a mesma forma do catálogo.
   */
  formas_pagamento_selecoes?: FormaPagamentoSelecao[];
  /**
   * IDs das formas selecionadas (legado / espelho dos ids de seleção).
   * Com seleções novas, cada id é o `FormaPagamentoSelecao.id` (não necessariamente o do catálogo).
   */
  formas_pagamento_ids?: string[];
  /** Parcelas customizadas por ocorrência (chave = id da seleção). */
  formas_pagamento_parcelas?: Record<string, number>;
  /** Desconto (%) por ocorrência — o valor final é calculado a partir do valor integral. */
  formas_pagamento_descontos?: Record<string, number>;
  /** Acréscimo (%) por ocorrência — somado ao valor integral (ex.: taxa no parcelado). */
  formas_pagamento_acrescimos?: Record<string, number>;
  /** @deprecated Valores manuais legados — preferir formas_pagamento_descontos. */
  formas_pagamento_valores?: Record<string, number>;
  /**
   * Observação livre por ocorrência — aparece no slide, PDF e filmagem.
   * Chave = id da seleção; valor vazio é tratado como “sem observação”.
   */
  formas_pagamento_observacoes?: Record<string, string>;
  /** Quando true, exibe o(s) bloco(s) de preços fracionados na apresentação. */
  fracionar_precos?: boolean;
  /**
   * Um ou mais cards de fracionamento (fonte da verdade quando presente).
   * Orçamentos antigos usam só `itens_fracionados`.
   */
  grupos_fracionados?: GrupoPrecosFracionados[];
  /** Itens do primeiro grupo (legado / espelho). Preferir `grupos_fracionados`. */
  itens_fracionados?: PrecoFracionadoItem[];
  /** Quando true (padrão), exibe a soma do primeiro grupo no slide (legado). */
  exibir_total_fracionado?: boolean;
  /** Quando true, exibe a composição de markup antes do preço no slide. */
  adicionar_markup?: boolean;
  /** Valores editáveis (materiais, serviços, despesas) — total = soma. */
  markup_composicao?: MarkupComposicaoPrecificacao;
  /** Markup do lead que originou a composição (cópia editável; só rastreio). */
  markup_orcamento_id?: string | null;
}

/** Opção de markup do lead para importar na precificação do slide. */
export interface MarkupOrcamentoOpcaoSeed {
  id: string;
  titulo: string;
  precoFinal: number;
  materiais: number;
  servicos: number;
  despesas: number;
}

export interface OrcamentoDadosMeta {
  etapa?: 1 | 2 | 3 | 4;
  /** Quando true, o link público deixa de exibir a apresentação para visitantes. */
  link_publico_oculto?: boolean;
  /** Quando true, o slide de Análise de IA não aparece neste orçamento. */
  ocultar_analise_ia?: boolean;
  /** Origem do orçamento (ex.: formulário público do lead, orcamentos_ia). */
  origem?: string;
  /** Pasta quote_projects de origem (quando origem = orcamentos_ia). */
  orcamentos_ia_project_id?: string;
  /** Lote quote_analyses de origem (quando origem = orcamentos_ia). */
  orcamentos_ia_analysis_id?: string;
  /** Campos de contrato preenchidos pelo cliente no formulário público. */
  campos_contrato_preenchidos?: Record<string, string>;
}

export interface OrcamentoDados {
  respostas: Record<string, string | string[]>;
  precificacao: OrcamentoPrecificacao;
  prazo_entrega: string;
  inicio_execucao: string;
  garantia_meses: string;
  textos_blocos: Record<string, string>;
  /** Metadados internos (etapa do formulário, etc.) — não usados na apresentação. */
  _meta?: OrcamentoDadosMeta;
}

export interface OrcamentoSlide {
  id: string;
  identificador: string;
  lead_id: number | null;
  cliente_nome: string;
  status: OrcamentoSlideStatus;
  dados: OrcamentoDados;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface OrcamentoSlideMidia {
  id: string;
  orcamento_id: string;
  tipo: MidiaTipo;
  file_url: string;
  file_name: string;
  hotspots: Hotspot[];
  origem: MidiaOrigem;
  source_id: string | null;
  ordem: number;
  criado_em: string;
}

export interface Hotspot {
  id: string;
  x: number;
  y: number;
  label: string;
  descricao?: string;
}

export interface LeadMidiaDisponivel {
  id: string;
  origem: 'lead_anexo' | 'lead_whiteboard' | 'lead_ai_render';
  file_url: string;
  file_name: string;
  criado_em: string;
  preview_label: string;
  /** Anexo PDF do lead — ao importar, cada página vira uma imagem do projeto. */
  tipo_arquivo?: 'imagem' | 'pdf';
  folder_id?: string | null;
}

export const BLOCO_LABELS: Record<BlocoTipo, string> = {
  capa: 'Capa',
  valorizacao: 'Valorização',
  comparativo_ferragens: 'Comparativo de Ferragens',
  galeria_projetos: 'Galeria de Projetos',
  antes_depois: 'Antes e Depois',
  imagem_interativa: 'Imagem Interativa',
  comparativo_mdf: 'Comparativo de MDF',
  precificacao: 'Precificação',
  precos_fracionados: 'Preços fracionados',
  prazos: 'Prazos',
  garantia: 'Garantia',
  script: 'Script',
  solicitar_fotos: 'Solicitar Fotos',
  texto_livre: 'Texto Livre',
  dados_projeto: 'Dados do Projeto',
  imagens_orcamento: 'Imagens do Orçamento',
  analise_ia: 'Análise de IA',
};

export const PALETA_PADRAO = {
  corPrimaria: '#2a1812',
  corSecundaria: '#f2d892',
  corTexto: '#FFFFFF',
  corFundo: '#2a1812',
} as const;
