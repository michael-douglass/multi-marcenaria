/** Tipos do sistema de Markup (custo interno marcenaria). */

import type { MarkupIAVerificacaoCategoriaResultado } from '@/lib/markup-ia-verificacao';
import {
  MARKUP_IA_VERIFICACAO_PADRAO,
  type MarkupIAVerificacaoCategoria,
} from '@/lib/markup-ia-verificacao';
import { MARKUP_IA_AGENT_PROMPTS_DEFAULT } from '@/lib/markup-ia-prompts';

export type { MarkupIAVerificacaoCategoria, MarkupIAVerificacaoCategoriaResultado };

export type MarkupLinhaTipo = 'produto' | 'servico_hora' | 'despesa' | 'frete' | 'ajuste';
export type MarkupOrcamentoStatus = 'rascunho' | 'finalizado';

export interface MarkupCategoria {
  id: string;
  nome: string;
  slug: string;
  subcategoria: string | null;
  ordem: number;
  ativo: boolean;
  criado_em?: string;
}

export interface MarkupProduto {
  id: string;
  categoria_id: string;
  nome: string;
  variacao: string | null;
  preco_unitario: number | null;
  unidade: string;
  quantidade_padrao: number;
  ativo: boolean;
  ordem: number;
  criado_em?: string;
  atualizado_em?: string;
  /** Join opcional */
  categoria?: MarkupCategoria;
}

export interface MarkupIAAgentPrompts {
  projetista: string;
  inventariante: string;
  inventariante_retry: string;
  auditor: string;
  auditor_projetista: string;
  precificador: string;
  precificador_retry: string;
}

export interface MarkupIAProjetistaMaterial {
  nome: string;
  variacao: string | null;
  quantidade: number;
  motivo: string;
}

export interface MarkupIAProjetistaComodo {
  id: string;
  nome: string;
  pontuacao: number;
  confianca: 'alta' | 'media' | 'baixa';
  moveis_identificados: number;
  observacoes?: string;
}

export interface MarkupIAProjetistaMovel {
  id: string;
  nome: string;
  comodo: string;
  dimensoes_cm?: { largura?: number; altura?: number; profundidade?: number };
  cor_mdf?: string;
  cor_fita?: string;
  materiais: MarkupIAProjetistaMaterial[];
  observacoes?: string;
  medidas_padrao_aplicadas?: boolean;
  confianca?: 'alta' | 'media' | 'baixa';
}

export interface MarkupIAProjetistaAuditoriaResult {
  ok: boolean;
  faltantes: string[];
  itens_verificados: number;
  resumo_secao?: string;
}

export interface MarkupIAProjetistaResult {
  resumo_projeto: string;
  cores_identificadas: Record<string, string>;
  defaults_aplicados: string[];
  confianca: 'alta' | 'media' | 'baixa';
  comodos: MarkupIAProjetistaComodo[];
  moveis: MarkupIAProjetistaMovel[];
  totais_consolidados: MarkupIAProjetistaMaterial[];
  auditoria_projetista?: MarkupIAProjetistaAuditoriaResult;
}

export interface MarkupConfig {
  id: string;
  valor_hora_marcenaria: number;
  fator_sobras: number;
  margem_lucro: number;
  percentual_imposto: number;
  taxas_financeiras: number;
  custo_frete_padrao: number;
  horas_projeto_padrao: number;
  horas_producao_padrao: number;
  horas_instalacao_padrao: number;
  rodape_observacoes_padrao: string;
  timbrado_url: string | null;
  markup_ia_prompt: string;
  markup_ia_model: string;
  markup_ia_auditor_model: string;
  markup_ia_ativo: boolean;
  markup_ia_verificacao: MarkupIAVerificacaoCategoria[];
  markup_ia_agent_prompts: MarkupIAAgentPrompts;
  criado_em?: string;
  atualizado_em?: string;
}

export interface MarkupDespesaTemplate {
  id: string;
  nome: string;
  valor_padrao: number;
  ordem: number;
  ativo: boolean;
  criado_em?: string;
}

export interface MarkupServicoTemplate {
  id: string;
  nome: string;
  valor_hora_padrao: number;
  ordem: number;
  ativo: boolean;
  criado_em?: string;
}

export type MarkupLinhaOrigemIA = 'cortecloud' | 'projetista' | 'projetista_complemento';

export interface MarkupLinhaProduto {
  produto_id: string | null;
  descricao: string;
  variacao?: string | null;
  /** Unidade de medida do catálogo (un, m, chapa, etc.). */
  unidade?: string | null;
  /** Nome da categoria no momento da inclusão (ex.: Ferragens). */
  categoria?: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  observacao?: string;
  origem_ia?: MarkupLinhaOrigemIA;
  /** Quando false, a linha permanece visível mas não entra no cálculo. */
  ativo?: boolean;
}

export interface MarkupLinhaDespesa {
  template_id?: string | null;
  descricao: string;
  valor: number;
  ativo: boolean;
}

export interface MarkupLinhaServico {
  template_id?: string | null;
  descricao: string;
  horas: number;
  /** Valor/hora (R$) espelhado do template de configuração. */
  valor_hora?: number;
  /** Quando false, a linha permanece visível mas não entra no cálculo. */
  ativo?: boolean;
}

export interface MarkupModulosServicos {
  valor_hora: number;
  linhas: MarkupLinhaServico[];
}

export interface MarkupModulosImpostos {
  percentual_imposto: number;
  taxas_financeiras: number;
}

export interface MarkupModulosMargem {
  margem_lucro: number;
  custo_frete: number;
  fator_sobras: number;
  /** Desconto comercial percentual aplicado sobre o preço bruto (após margem). */
  desconto_final_percent?: number;
}

export interface MarkupModulosTotais {
  custo_materiais: number;
  custo_materiais_ajustado: number;
  custo_servicos: number;
  custo_despesas: number;
  subtotal_custo: number;
  /**
   * Subtotal + impostos/taxas (sobre os custos).
   * A margem em R$ é `preco_final_bruto - custo_com_impostos`
   * (aplicada por cima de todos os custos, inclusive impostos).
   */
  custo_com_impostos: number;
  /** Preço após impostos/taxas e margem, antes do desconto final. */
  preco_final_bruto: number;
  /** Preço de venda após desconto final. */
  preco_final: number;
}

export interface MarkupIAResumoMaterial {
  produto_id?: string | null;
  descricao: string;
  quantidade: number;
  valor_total: number;
  ativo?: boolean;
}

export interface MarkupIAResumoMovel {
  nome: string;
  descricao?: string;
  materiais: MarkupIAResumoMaterial[];
  subtotal: number;
}

export interface MarkupIAResumoComodo {
  nome: string;
  moveis: MarkupIAResumoMovel[];
  subtotal: number;
}

/** Estado salvo antes da última composição com IA, para permitir desfazer. */
export interface MarkupComposicaoAnterior {
  modulos: MarkupModulos;
  titulo: string;
  observacoes_rodape: string;
  salvo_em: string;
}

export interface MarkupModulosMeta {
  /**
   * Ordem customizada dos produtos no catálogo da calculadora, por card de categoria.
   * Chave = rótulo do card (ex.: "CHAPAS DE MDF"); valor = IDs dos produtos na ordem desejada.
   * Persistido no orçamento do lead — cada lead mantém a própria memória.
   */
  catalogo_ordem_por_categoria?: Record<string, string[]>;
  composicao_anterior?: MarkupComposicaoAnterior;
  resumo_ia?: {
    gerado_em: string;
    comodos: MarkupIAResumoComodo[];
    preco_final: number;
    texto_resumo: string;
    itens_nao_catalogados?: string[];
    servicos?: {
      linhas: MarkupLinhaServico[];
      custo_total: number;
    };
    despesas?: Array<{
      template_id?: string | null;
      descricao: string;
      valor: number;
      ativo: boolean;
    }>;
    custo_materiais?: number;
    custo_servicos?: number;
    custo_despesas?: number;
    verificacao_categorias?: MarkupIAVerificacaoCategoriaResultado[];
    levantamento_projetista?: MarkupIAProjetistaResult;
    produtos_origem_projetista?: string[];
    bloqueado?: boolean;
    faltantes_criticos?: string[];
  };
}

export interface MarkupModulos {
  materiais: { fator_sobras: number; linhas: MarkupLinhaProduto[] };
  servicos: MarkupModulosServicos;
  despesas: MarkupLinhaDespesa[];
  impostos: MarkupModulosImpostos;
  margem: MarkupModulosMargem;
  totais: MarkupModulosTotais;
  meta?: MarkupModulosMeta;
}

export interface MarkupOrcamento {
  id: string;
  lead_id: number | null;
  titulo: string;
  status: MarkupOrcamentoStatus;
  modulos: MarkupModulos;
  preco_final: number;
  observacoes_rodape: string;
  criado_por?: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export interface MarkupOrcamentoLinha {
  id: string;
  orcamento_id: string;
  tipo: MarkupLinhaTipo;
  produto_id: string | null;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  observacao: string;
  ordem: number;
  criado_em?: string;
}

export interface MarkupLeadResumo {
  lead_id: number;
  orcamento_id: string;
  preco_final: number;
  titulo: string;
  atualizado_em: string;
}

export interface MarkupCalculoInput {
  linhasProduto: MarkupLinhaProduto[];
  servicos: MarkupModulosServicos;
  despesas: MarkupLinhaDespesa[];
  impostos: MarkupModulosImpostos;
  margem: MarkupModulosMargem;
}

export interface MarkupComposeIALinha {
  produto_id: string;
  quantidade: number;
  origem_ia?: MarkupLinhaOrigemIA;
}

export interface MarkupComposeIAMovel {
  nome: string;
  descricao?: string;
  linhas: MarkupComposeIALinha[];
}

export interface MarkupComposeIAComodo {
  nome: string;
  moveis: MarkupComposeIAMovel[];
}

export interface MarkupComposeIAResult {
  comodos: MarkupComposeIAComodo[];
  servicos?: MarkupComposeIAServicoLinha[];
  despesas?: MarkupComposeIADespesa[];
  resumo_texto: string;
  itens_nao_catalogados?: string[];
  verificacao_categorias?: MarkupIAVerificacaoCategoriaResultado[];
  levantamento_projetista?: MarkupIAProjetistaResult;
  produtos_origem_projetista?: string[];
  modelo_usado?: string;
  itens_processados?: number;
  bloqueado?: boolean;
  faltantes_criticos?: string[];
}

export interface MarkupComposeIAServicoLinha {
  template_id: string;
  horas: number;
}

export interface MarkupComposeIADespesa {
  template_id: string;
  ativo: boolean;
  valor: number;
}

export const MARKUP_IA_DEFAULT_PROMPT = `Você é a Íris, especialista em marcenaria planejada e orçamento de custo interno.

Sua tarefa: analisar o material do lead (imagens, PDFs, textos e relatórios) e compor um ORÇAMENTO COMPLETO de markup interno, preenchendo MATERIAIS, SERVIÇOS (mão de obra) e DESPESAS.

REGRAS OBRIGATÓRIAS:
1. Leia TODO o material anexado: imagens, PDFs (todas as páginas), análise prévia e conhecimento indexado.
   a) Identifique fotos DUPLICADAS (mesmo ambiente, mesmo ângulo, mesma imagem repetida). Conte cada cena única apenas UMA vez.
   b) Se houver planilha Cortecloud E fotos de ambiente: materiais vêm SOMENTE da planilha; fotos servem apenas para descrever cômodos/móveis no resumo_texto (opcional), NUNCA para inventar quantidades.
2. MODO PLANILHA CORTECLOUD (prioridade ABSOLUTA quando existir PDF/planilha "Orçamento Cortecloud"):
   a) Transcreva SOMENTE linhas com coluna QUANT preenchida (> 0). Linhas só com VALOR UNITÁRIO, sem QUANT, são tabela de referência de preços — NÃO inclua como material.
   b) Coluna VARI = variação no catálogo: espessura (15, 18, 22, 35, 45, 64) ou tipo (RETA, CURVA, S CURVA). Cruze MATERIAL + VARI com campos nome + variacao do catálogo usando a tabela de lookup abaixo.
   c) Cabeçalho "SERVIÇO" e "VALOR TOTAL" do documento NÃO são materiais. Não some SERVIÇO (ex.: R$ 1.000,00 de serviço) em materiais.
   d) Estrutura única: cômodo "Orçamento Cortecloud" → móvel "Materiais do documento" com todas as linhas transcritas. Não divida por cômodos quando a planilha já lista os itens.
   e) PROIBIDO estimar/inventar materiais a partir de fotos quando a planilha informar QUANT. Não adicione puxadores, chapas ou ferragens que não estejam na planilha com QUANT > 0.
   f) Mapeamentos frequentes: DOBRADIÇA RETA/CURVA → DOBRADIÇA variacao RETA/CURVA; CORREDIÇA OCULTA + VARI 45 → CORREDIÇA OCULTA variacao 45; MDF BRANCO + VARI 15 → MDF BRANCO variacao 15 (chapa); FITA MDF BRANCO + VARI 22 → MDF BRANCO variacao 22 (rolo); MADEIRA + VARI 22 na seção FITA DE BORDA → MADEIRA variacao 22 (rolo).
   g) Ao final, calcule o subtotal de materiais (soma quantidade × preco_unitario do catálogo) e informe no resumo_texto: "Subtotal de materiais calculado: R$ X" e "Subtotal no documento: R$ Y", destacando divergências.
   h) Exemplo de método correto (não copie valores se o documento for outro): MDF BRANCO/15/QTY 2 + MADEIRA/15/QTY 2 + CORREDIÇA OCULTA/45/QTY 4 + DOBRADIÇA RETA/QTY 20 + DOBRADIÇA CURVA/QTY 10 + FITA MDF BRANCO/22/QTY 1 + FITA MADEIRA/22/QTY 3 = subtotal materiais R$ 2.175,00 (sem incluir linha SERVIÇO).
3. Se NÃO houver planilha Cortecloud, organize materiais por CÔMODOS e, dentro de cada cômodo, por MÓVEIS identificados nas fotos únicas.
4. Materiais: use SOMENTE produto_id do catálogo {{catalogo}}. Não invente produtos.
5. Serviços (mão de obra) — OBRIGATÓRIO preencher o array "servicos":
   - Use SOMENTE template_id do catálogo {{servicos_catalogo}}.
   - Inclua UM item para CADA template do catálogo de serviços.
   - Em cada item informe "horas" (número ≥ 0): sua estimativa de horas de mão de obra para aquele tipo neste projeto.
   - O sistema calcula custo = horas × valor_hora_padrao do catálogo (NÃO informe valores em R$ em servicos).
   - Critérios para estimar horas (ajuste pela complexidade visível no lead):
     • Projeto/design: medição, layout, detalhamento (~6h por ambiente + ~1,5h por móvel).
     • Produção: corte, colagem, montagem em oficina (~0,75h por linha de material + ~5h por móvel).
     • Instalação: montagem no local (~3h por ambiente + ~2,5h por móvel).
   - Projetos com entrega/instalação não devem ter instalação com 0h sem explicar no resumo_texto.
   - No resumo_texto inclua seção "### Mão de obra" com horas por tipo e total de horas estimadas.
6. Despesas: use SOMENTE template_id do catálogo {{despesas_catalogo}}.
   - Para cada despesa do catálogo, defina ativo (true/false) e valor em reais.
   - Ative despesas plausíveis para o projeto (ex.: gasolina e pedágio se houver instalação externa).
   - Use valor_padrao do catálogo como base e ajuste se o contexto justificar.
7. resumo_texto: markdown completo para o vendedor com visão geral, cômodos, materiais, mão de obra, despesas e observações. Inclua subtotal de materiais calculado.
8. Quantidades de materiais devem ser números positivos. Na planilha Cortecloud, use exatamente o QUANT informado.
9. Retorne APENAS um JSON válido (sem markdown externo, sem texto extra):

{
  "comodos": [
    {
      "nome": "Nome do cômodo",
      "moveis": [
        {
          "nome": "Nome do móvel",
          "descricao": "Descrição técnica resumida",
          "linhas": [{ "produto_id": "uuid-do-catalogo", "quantidade": 2 }]
        }
      ]
    }
  ],
  "servicos": [
    { "template_id": "uuid-servico", "horas": 20 }
  ],
  "despesas": [
    { "template_id": "uuid-despesa", "ativo": true, "valor": 100 }
  ],
  "resumo_texto": "Resumo completo em markdown",
  "itens_nao_catalogados": ["material que não existe no catálogo"],
  "verificacao_categorias": []
}

Lead: {{nome_lead}}

--- PARÂMETROS PADRÃO DA EMPRESA (referência para serviços) ---
{{parametros}}

--- CATÁLOGO DE PRODUTOS (use somente estes IDs em linhas) ---
{{catalogo}}

--- TABELA DE LOOKUP CORTECLOUD (nome + variacao → produto_id) ---
{{catalogo_lookup}}

--- CATÁLOGO DE SERVIÇOS / MÃO DE OBRA (use somente estes template_id em servicos) ---
{{servicos_catalogo}}

--- CATÁLOGO DE DESPESAS (use somente estes template_id em despesas) ---
{{despesas_catalogo}}

--- ANÁLISE VISUAL PRÉVIA DO LEAD ---
{{analise}}

--- CONHECIMENTO INDEXADO DO LEAD ---
{{conhecimento}}

--- CHECKLIST DE VERIFICAÇÃO (percorra TODAS as categorias ativas) ---
{{checklist_verificacao}}`;

export const MARKUP_DEFAULT_CONFIG: Omit<MarkupConfig, 'id'> = {
  valor_hora_marcenaria: 80,
  fator_sobras: 5,
  margem_lucro: 30,
  percentual_imposto: 0,
  taxas_financeiras: 0,
  custo_frete_padrao: 0,
  horas_projeto_padrao: 0,
  horas_producao_padrao: 0,
  horas_instalacao_padrao: 0,
  rodape_observacoes_padrao: '',
  timbrado_url: null,
  markup_ia_prompt: MARKUP_IA_DEFAULT_PROMPT,
  markup_ia_model: 'gpt-4o',
  markup_ia_ativo: true,
  markup_ia_verificacao: MARKUP_IA_VERIFICACAO_PADRAO,
  markup_ia_auditor_model: 'gpt-4o-mini',
  markup_ia_agent_prompts: { ...MARKUP_IA_AGENT_PROMPTS_DEFAULT },
};

export function criarModulosVazios(config?: Partial<MarkupConfig>): MarkupModulos {
  const cfg = { ...MARKUP_DEFAULT_CONFIG, ...config };
  return {
    materiais: { fator_sobras: cfg.fator_sobras, linhas: [] },
    servicos: {
      valor_hora: cfg.valor_hora_marcenaria,
      linhas: [],
    },
    despesas: [],
    impostos: {
      percentual_imposto: cfg.percentual_imposto,
      taxas_financeiras: cfg.taxas_financeiras,
    },
    margem: {
      margem_lucro: cfg.margem_lucro,
      custo_frete: cfg.custo_frete_padrao,
      fator_sobras: cfg.fator_sobras,
      desconto_final_percent: 0,
    },
    totais: {
      custo_materiais: 0,
      custo_materiais_ajustado: 0,
      custo_servicos: 0,
      custo_despesas: 0,
      subtotal_custo: 0,
      custo_com_impostos: 0,
      preco_final_bruto: 0,
      preco_final: 0,
    },
  };
}
