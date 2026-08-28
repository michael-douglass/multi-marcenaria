import type {
  FormaPagamentoSelecao,
  FormaPagamentoTipo,
  GrupoPrecosFracionados,
  MarkupComposicaoPrecificacao,
  MarkupOrcamentoOpcaoSeed,
  OrcamentoFormaPagamento,
  OrcamentoPrecificacao,
  PrecoFracionadoItem,
} from './orcamento-slide-types';
import {
  aplicarFatorSobras,
  aplicarImpostosETaxas,
  aplicarMargemLucro,
  calcularSubtotalCusto,
} from './markup-calculo';
import { MARKUP_DEFAULT_CONFIG, type MarkupOrcamento } from './markup-types';

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

function novoIdLocal(prefixo: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Nova ocorrência de forma de pagamento (permite duplicar o mesmo item do catálogo). */
export function criarFormaPagamentoSelecao(formaId: string, id?: string): FormaPagamentoSelecao {
  return { id: id ?? novoIdLocal('fp'), forma_id: formaId };
}

/** Novo card de preços fracionados. */
export function criarGrupoPrecosFracionados(
  patch?: Partial<Pick<GrupoPrecosFracionados, 'titulo' | 'itens' | 'exibir_total'>>,
): GrupoPrecosFracionados {
  return {
    id: novoIdLocal('gf'),
    titulo: patch?.titulo?.trim() || undefined,
    itens: patch?.itens ?? [],
    exibir_total: patch?.exibir_total !== false,
  };
}

/**
 * Despesas = total do orçamento − (materiais + serviços).
 * Todo o restante (margem, imposto, sobras, frete, despesas reais…) entra em Despesas
 * para a composição fechar no valor do card.
 */
export function calcularDespesasRestanteMarkup(options: {
  materiais: number;
  servicos: number;
  totalOrcamento: number;
}): number {
  const materiais = Math.max(0, Number(options.materiais) || 0);
  const servicos = Math.max(0, Number(options.servicos) || 0);
  const total = Math.max(0, Number(options.totalOrcamento) || 0);
  return arredondar(Math.max(0, total - materiais - servicos));
}

/** Monta composição com despesas preenchidas pelo restante do orçamento. */
export function montarComposicaoMarkupComDespesasRestante(options: {
  materiais: number;
  servicos: number;
  totalOrcamento: number;
}): MarkupComposicaoPrecificacao {
  const materiais = Math.max(0, Number(options.materiais) || 0);
  const servicos = Math.max(0, Number(options.servicos) || 0);
  const despesas = calcularDespesasRestanteMarkup({
    materiais,
    servicos,
    totalOrcamento: options.totalOrcamento,
  });
  return normalizarMarkupComposicao({ materiais, servicos, despesas });
}

/** Número >= 0; ignora null/undefined/NaN e segue para o próximo fallback. */
function coalesceParam(value: unknown, ...fallbacks: unknown[]): number {
  for (const candidate of [value, ...fallbacks]) {
    if (candidate === undefined || candidate === null || candidate === '') continue;
    const n = typeof candidate === 'number' ? candidate : Number(candidate);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

/** Remove chaves undefined para o spread não apagar defaults (ex.: imposto). */
export function limparUndefinedMarkup<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

export function normalizarMarkupComposicao(
  c?: MarkupComposicaoPrecificacao | null,
  defaults?: Partial<MarkupComposicaoPrecificacao> | null,
): MarkupComposicaoPrecificacao {
  const base: MarkupComposicaoPrecificacao = {
    materiais: coalesceParam(c?.materiais, 0),
    servicos: coalesceParam(c?.servicos, 0),
    despesas: coalesceParam(c?.despesas, 0),
    fator_sobras: coalesceParam(
      c?.fator_sobras,
      defaults?.fator_sobras,
      MARKUP_DEFAULT_CONFIG.fator_sobras,
    ),
    margem_lucro: coalesceParam(
      c?.margem_lucro,
      defaults?.margem_lucro,
      MARKUP_DEFAULT_CONFIG.margem_lucro,
    ),
    percentual_imposto: coalesceParam(
      c?.percentual_imposto,
      defaults?.percentual_imposto,
      MARKUP_DEFAULT_CONFIG.percentual_imposto,
    ),
    taxas_financeiras: coalesceParam(
      c?.taxas_financeiras,
      defaults?.taxas_financeiras,
      MARKUP_DEFAULT_CONFIG.taxas_financeiras,
    ),
    custo_frete: coalesceParam(
      c?.custo_frete,
      defaults?.custo_frete,
      MARKUP_DEFAULT_CONFIG.custo_frete_padrao,
    ),
  };
  return {
    ...base,
    resumo: calcularResumoMarkupComposicao(base),
  };
}

/**
 * Resumo = materiais(+sobras) + serviços + despesas + frete
 * → impostos/taxas → margem de lucro por cima de todos os custos.
 * Mesma lógica do motor de markup da empresa.
 */
export function calcularResumoMarkupComposicao(
  c?: MarkupComposicaoPrecificacao | null,
): number {
  const materiais = coalesceParam(c?.materiais, 0);
  const servicos = coalesceParam(c?.servicos, 0);
  const despesas = coalesceParam(c?.despesas, 0);
  const fatorSobras = coalesceParam(c?.fator_sobras, MARKUP_DEFAULT_CONFIG.fator_sobras);
  const margem = coalesceParam(c?.margem_lucro, MARKUP_DEFAULT_CONFIG.margem_lucro);
  const imposto = coalesceParam(c?.percentual_imposto, MARKUP_DEFAULT_CONFIG.percentual_imposto);
  const taxas = coalesceParam(c?.taxas_financeiras, MARKUP_DEFAULT_CONFIG.taxas_financeiras);
  const frete = coalesceParam(c?.custo_frete, MARKUP_DEFAULT_CONFIG.custo_frete_padrao);

  const materiaisAjustado = aplicarFatorSobras(materiais, fatorSobras);
  const subtotal = calcularSubtotalCusto(materiaisAjustado, servicos, despesas, frete);
  const comImpostos = aplicarImpostosETaxas(subtotal, imposto, taxas);
  return aplicarMargemLucro(comImpostos, margem);
}

/** Atualiza custos/parâmetros e recalcula o resumo. */
export function patchMarkupComposicao(
  atual: MarkupComposicaoPrecificacao | null | undefined,
  patch: Partial<MarkupComposicaoPrecificacao>,
  defaults?: Partial<MarkupComposicaoPrecificacao> | null,
): MarkupComposicaoPrecificacao {
  return normalizarMarkupComposicao(
    { ...normalizarMarkupComposicao(atual, defaults), ...patch },
    defaults,
  );
}

export function somaMarkupComposicao(
  c?: MarkupComposicaoPrecificacao | null,
  defaults?: Partial<MarkupComposicaoPrecificacao> | null,
): number {
  const n = normalizarMarkupComposicao(c, defaults);
  return arredondar(n.materiais + n.servicos + n.despesas);
}

export function markupComposicaoTemConteudo(
  c?: MarkupComposicaoPrecificacao | null,
  defaults?: Partial<MarkupComposicaoPrecificacao> | null,
): boolean {
  return somaMarkupComposicao(c, defaults) > 0;
}

export function precificacaoMarkupAtivo(prec?: OrcamentoPrecificacao | null): boolean {
  return prec?.adicionar_markup === true;
}

export type MarkupCustoChave = 'materiais' | 'servicos' | 'despesas';

const MARKUP_CUSTO_CHAVES: MarkupCustoChave[] = ['materiais', 'servicos', 'despesas'];

/** Parte ÷ total × 100 (arredondado em 2 casas). */
export function percentualSobreTotal(parte: number, total: number): number {
  const t = Math.max(0, Number(total) || 0);
  if (!(t > 0)) return 0;
  return arredondar((Math.max(0, Number(parte) || 0) / t) * 100);
}

/**
 * Ao editar o % de um item, redistribui o restante (100 − %) nos outros
 * proporcionalmente aos valores atuais e converte tudo em R$ sobre o total.
 * A soma dos três valores fecha exatamente no total (ajuste de centavos no último).
 */
export function aplicarPercentualMarkupComposicao(options: {
  chave: MarkupCustoChave;
  percentual: number;
  totalBase: number;
  composicaoAtual: MarkupComposicaoPrecificacao;
}): MarkupComposicaoPrecificacao {
  const total = Math.max(0, Number(options.totalBase) || 0);
  const pctAlvo = Math.min(100, Math.max(0, Number(options.percentual) || 0));
  const atual = normalizarMarkupComposicao(options.composicaoAtual);
  const outras = MARKUP_CUSTO_CHAVES.filter((c) => c !== options.chave);
  const pesos = outras.map((k) => Math.max(0, atual[k]));
  const somaPesos = pesos[0] + pesos[1];
  const remPct = 100 - pctAlvo;

  let pctOutra0: number;
  let pctOutra1: number;
  if (somaPesos <= 0) {
    pctOutra0 = remPct / 2;
    pctOutra1 = remPct / 2;
  } else {
    pctOutra0 = remPct * (pesos[0] / somaPesos);
    pctOutra1 = remPct * (pesos[1] / somaPesos);
  }

  const valores: Record<MarkupCustoChave, number> = {
    materiais: 0,
    servicos: 0,
    despesas: 0,
  };
  valores[options.chave] = arredondar(total * (pctAlvo / 100));
  valores[outras[0]] = arredondar(total * (pctOutra0 / 100));
  // Último absorve residual de arredondamento para a soma bater com o total.
  valores[outras[1]] = arredondar(Math.max(0, total - valores[options.chave] - valores[outras[0]]));

  return normalizarMarkupComposicao(valores);
}

/** Linhas resumidas (não detalhadas) para o slide / PDF. */
export function linhasMarkupComposicaoApresentacao(
  c?: MarkupComposicaoPrecificacao | null,
): {
  chave: MarkupCustoChave;
  label: string;
  valor: number;
  percentual: number;
}[] {
  const n = normalizarMarkupComposicao(c);
  const total = somaMarkupComposicao(n);
  return [
    {
      chave: 'materiais',
      label: 'Materiais',
      valor: n.materiais,
      percentual: percentualSobreTotal(n.materiais, total),
    },
    {
      chave: 'servicos',
      label: 'Serviços',
      valor: n.servicos,
      percentual: percentualSobreTotal(n.servicos, total),
    },
    {
      chave: 'despesas',
      label: 'Despesas',
      valor: n.despesas,
      percentual: percentualSobreTotal(n.despesas, total),
    },
  ];
}

/** Aplica desconto e/ou acréscimo % sobre o valor integral (base comum). */
export function aplicarDescontoEAcrescimo(
  valorIntegral: number,
  descontoPercent: number,
  acrescimoPercent = 0,
): number {
  const integral = Math.max(0, valorIntegral);
  const desconto = Math.min(100, Math.max(0, descontoPercent));
  const acrescimo = Math.min(200, Math.max(0, acrescimoPercent));
  const fator = 1 - desconto / 100 + acrescimo / 100;
  return arredondar(Math.max(0, integral * fator));
}

/**
 * Inferência inversa: a partir do valor final digitado, define desconto OU acréscimo %.
 * Se o valor baixou → desconto; se subiu → acréscimo; se igual → ambos zero.
 */
export function resolverAjustePercentualDoValorFinal(
  valorIntegral: number,
  valorFinalDesejado: number,
): { descontoPercent: number; acrescimoPercent: number } {
  const integral = Math.max(0, valorIntegral);
  const final = Math.max(0, valorFinalDesejado);

  if (integral <= 0) {
    return { descontoPercent: 0, acrescimoPercent: 0 };
  }

  const diff = final - integral;
  if (Math.abs(diff) < 0.005) {
    return { descontoPercent: 0, acrescimoPercent: 0 };
  }

  if (diff < 0) {
    const desconto = Math.min(100, Math.max(0, ((integral - final) / integral) * 100));
    return {
      descontoPercent: Math.round(desconto * 10000) / 10000,
      acrescimoPercent: 0,
    };
  }

  const acrescimo = Math.min(200, Math.max(0, ((final - integral) / integral) * 100));
  return {
    descontoPercent: 0,
    acrescimoPercent: Math.round(acrescimo * 10000) / 10000,
  };
}

export interface CalcularPrecificacaoInput {
  valorIntegral: number;
  descontoPercent: number;
  acrescimoPercent?: number;
  forma?: Pick<
    OrcamentoFormaPagamento,
    'id' | 'tipo' | 'parcelas_padrao' | 'entrada_percent' | 'entrega_percent'
  > | null;
  parcelas?: number;
  fracionarPrecos?: boolean;
  itensFracionados?: PrecoFracionadoItem[];
  adicionarMarkup?: boolean;
  markupComposicao?: MarkupComposicaoPrecificacao;
  markupOrcamentoId?: string | null;
}

function camposMarkup(input: {
  adicionarMarkup?: boolean;
  markupComposicao?: MarkupComposicaoPrecificacao;
  markupOrcamentoId?: string | null;
}): Pick<OrcamentoPrecificacao, 'adicionar_markup' | 'markup_composicao' | 'markup_orcamento_id'> {
  if (input.adicionarMarkup !== true) {
    return {
      adicionar_markup: false,
      markup_composicao: undefined,
      markup_orcamento_id: null,
    };
  }
  return {
    adicionar_markup: true,
    markup_composicao: normalizarMarkupComposicao(input.markupComposicao),
    markup_orcamento_id: input.markupOrcamentoId ?? null,
  };
}

export function calcularPrecificacaoCompleta(input: CalcularPrecificacaoInput): OrcamentoPrecificacao {
  const valorIntegral = Math.max(0, input.valorIntegral);
  const descontoPercent = Math.min(100, Math.max(0, input.descontoPercent));
  const acrescimoPercent = Math.min(200, Math.max(0, input.acrescimoPercent ?? 0));
  const valorFinal = aplicarDescontoEAcrescimo(valorIntegral, descontoPercent, acrescimoPercent);
  const forma = input.forma;
  const tipo: FormaPagamentoTipo = forma?.tipo ?? 'a_vista';
  const markup = camposMarkup(input);

  if (tipo === 'parcelado') {
    const parcelas = Math.max(1, input.parcelas ?? forma?.parcelas_padrao ?? 12);
    return {
      valor_integral: valorIntegral,
      desconto_percent: descontoPercent,
      acrescimo_percent: acrescimoPercent,
      valor_final: valorFinal,
      forma_pagamento_id: forma?.id ?? null,
      forma_pagamento_tipo: 'parcelado',
      parcelas,
      valor_parcela: arredondar(valorFinal / parcelas),
      valor_entrada: 0,
      valor_entrega: 0,
      fracionar_precos: input.fracionarPrecos === true,
      itens_fracionados: input.fracionarPrecos === true ? input.itensFracionados : [],
      ...markup,
    };
  }

  if (tipo === 'entrada_entrega') {
    const entradaPct = forma?.entrada_percent ?? 60;
    const valorEntrada = arredondar(valorFinal * (entradaPct / 100));
    const valorEntrega = arredondar(valorFinal - valorEntrada);
    return {
      valor_integral: valorIntegral,
      desconto_percent: descontoPercent,
      acrescimo_percent: acrescimoPercent,
      valor_final: valorFinal,
      forma_pagamento_id: forma?.id ?? null,
      forma_pagamento_tipo: 'entrada_entrega',
      parcelas: 1,
      valor_parcela: valorFinal,
      valor_entrada: valorEntrada,
      valor_entrega: valorEntrega,
      fracionar_precos: input.fracionarPrecos === true,
      itens_fracionados: input.fracionarPrecos === true ? input.itensFracionados : [],
      ...markup,
    };
  }

  return {
    valor_integral: valorIntegral,
    desconto_percent: descontoPercent,
    acrescimo_percent: acrescimoPercent,
    valor_final: valorFinal,
    forma_pagamento_id: forma?.id ?? null,
    forma_pagamento_tipo: 'a_vista',
    parcelas: 1,
    valor_parcela: valorFinal,
    valor_entrada: valorFinal,
    valor_entrega: 0,
    fracionar_precos: input.fracionarPrecos === true,
    itens_fracionados: input.fracionarPrecos === true ? input.itensFracionados : [],
    ...markup,
  };
}

/** Compatível com chamadas antigas (só parcelas simples). */
export function calcularPrecificacao(
  valorIntegral: number,
  parcelas: number,
  descontoPercent: number,
): OrcamentoPrecificacao {
  const tipo: FormaPagamentoTipo = parcelas > 1 ? 'parcelado' : 'a_vista';
  return calcularPrecificacaoCompleta({
    valorIntegral,
    descontoPercent,
    parcelas,
    forma: tipo === 'parcelado' ? { tipo: 'parcelado', parcelas_padrao: parcelas, entrada_percent: 0, entrega_percent: 0, id: '' } : { tipo: 'a_vista', parcelas_padrao: 1, entrada_percent: 100, entrega_percent: 0, id: '' },
  });
}

export function normalizarPrecificacao(prec?: OrcamentoPrecificacao | null): OrcamentoPrecificacao {
  if (!prec) {
    return calcularPrecificacaoCompleta({ valorIntegral: 0, descontoPercent: 0, forma: null });
  }
  const tipo =
    prec.forma_pagamento_tipo ?? (prec.parcelas > 1 ? 'parcelado' : 'a_vista');

  const selecoes = normalizarFormasPagamentoSelecoes(prec);
  const formasIds = selecoes.map((s) => s.id);
  const grupos = normalizarGruposFracionados(prec);

  return {
    ...prec,
    forma_pagamento_tipo: tipo,
    formas_pagamento_selecoes: selecoes,
    formas_pagamento_ids: formasIds.length ? formasIds : undefined,
    formas_pagamento_parcelas: prec.formas_pagamento_parcelas ?? {},
    formas_pagamento_descontos: prec.formas_pagamento_descontos ?? {},
    formas_pagamento_acrescimos: prec.formas_pagamento_acrescimos ?? {},
    formas_pagamento_valores: prec.formas_pagamento_valores ?? {},
    formas_pagamento_observacoes: limparObservacoesFormasPagamento(
      prec.formas_pagamento_observacoes,
      formasIds,
    ),
    acrescimo_percent: Math.min(200, Math.max(0, prec.acrescimo_percent ?? 0)),
    valor_entrada: prec.valor_entrada ?? (tipo === 'a_vista' ? prec.valor_final : 0),
    valor_entrega: prec.valor_entrega ?? 0,
    fracionar_precos: prec.fracionar_precos === true,
    grupos_fracionados: prec.fracionar_precos === true ? grupos : [],
    itens_fracionados:
      prec.fracionar_precos === true ? (grupos[0]?.itens ?? prec.itens_fracionados ?? []) : [],
    exibir_total_fracionado:
      prec.fracionar_precos === true
        ? grupos[0]
          ? grupos[0].exibir_total !== false
          : prec.exibir_total_fracionado !== false
        : undefined,
    adicionar_markup: prec.adicionar_markup === true,
    markup_composicao:
      prec.adicionar_markup === true
        ? normalizarMarkupComposicao(prec.markup_composicao)
        : undefined,
    markup_orcamento_id:
      prec.adicionar_markup === true ? (prec.markup_orcamento_id ?? null) : null,
  };
}

/** Converte legado (`formas_pagamento_ids` = ids do catálogo) em seleções com id único. */
export function normalizarFormasPagamentoSelecoes(
  prec?: OrcamentoPrecificacao | null,
): FormaPagamentoSelecao[] {
  if (!prec) return [];

  if (prec.formas_pagamento_selecoes?.length) {
    return prec.formas_pagamento_selecoes
      .filter((s) => s && typeof s.forma_id === 'string' && s.forma_id.length > 0)
      .map((s) => ({
        id: s.id && String(s.id).length > 0 ? String(s.id) : s.forma_id,
        forma_id: String(s.forma_id),
      }));
  }

  if (prec.formas_pagamento_ids?.length) {
    return prec.formas_pagamento_ids.map((id) => ({ id, forma_id: id }));
  }

  if (prec.forma_pagamento_id) {
    return [{ id: prec.forma_pagamento_id, forma_id: prec.forma_pagamento_id }];
  }

  return [];
}

/** Grupos de fracionamento — migra `itens_fracionados` legado para 1 grupo. */
export function normalizarGruposFracionados(
  prec?: OrcamentoPrecificacao | null,
): GrupoPrecosFracionados[] {
  if (!prec?.fracionar_precos) return [];

  if (prec.grupos_fracionados?.length) {
    return prec.grupos_fracionados.map((g) => ({
      id: g.id && String(g.id).length > 0 ? String(g.id) : novoIdLocal('gf'),
      titulo: g.titulo?.trim() || undefined,
      itens: Array.isArray(g.itens) ? g.itens : [],
      exibir_total: g.exibir_total !== false,
    }));
  }

  return [
    {
      id: 'grupo-principal',
      itens: prec.itens_fracionados ?? [],
      exibir_total: prec.exibir_total_fracionado !== false,
    },
  ];
}

/** Espelha grupos → campos legados (primeiro grupo) para leitores antigos. */
export function espelharGruposFracionadosLegado(
  grupos: GrupoPrecosFracionados[],
  fracionarAtivo: boolean,
): Pick<
  OrcamentoPrecificacao,
  'fracionar_precos' | 'grupos_fracionados' | 'itens_fracionados' | 'exibir_total_fracionado'
> {
  if (!fracionarAtivo || grupos.length === 0) {
    return {
      fracionar_precos: fracionarAtivo,
      grupos_fracionados: fracionarAtivo ? grupos : [],
      itens_fracionados: [],
      exibir_total_fracionado: undefined,
    };
  }
  return {
    fracionar_precos: true,
    grupos_fracionados: grupos,
    itens_fracionados: grupos[0]?.itens ?? [],
    exibir_total_fracionado: grupos[0]?.exibir_total !== false,
  };
}

/** Formas selecionadas na ordem do slide, depois catálogo (para “adicionar”). */
export function ordenarFormasPagamentoParaEdicao(
  catalogo: OrcamentoFormaPagamento[],
  selecoes: FormaPagamentoSelecao[],
): { ativas: Array<{ selecao: FormaPagamentoSelecao; forma: OrcamentoFormaPagamento }>; catalogo: OrcamentoFormaPagamento[] } {
  const ativas = selecoes
    .map((selecao) => {
      const forma = catalogo.find((f) => f.id === selecao.forma_id);
      return forma ? { selecao, forma } : null;
    })
    .filter((item): item is { selecao: FormaPagamentoSelecao; forma: OrcamentoFormaPagamento } => !!item);

  return { ativas, catalogo };
}

/** IDs das ocorrências selecionadas (sem forçar fallback — lista vazia é válida). */
export function resolverFormasPagamentoIds(
  prec?: OrcamentoPrecificacao | null,
  _formasCatalogo: OrcamentoFormaPagamento[] = [],
): string[] {
  return resolverFormasPagamentoSelecoes(prec, _formasCatalogo).map((s) => s.id);
}

/** Seleções ativas na ordem do slide (sem forçar a 1ª do catálogo). */
export function resolverFormasPagamentoSelecoes(
  prec?: OrcamentoPrecificacao | null,
  formasCatalogo: OrcamentoFormaPagamento[] = [],
): FormaPagamentoSelecao[] {
  const selecoes = normalizarFormasPagamentoSelecoes(prec);
  if (formasCatalogo.length === 0) return selecoes;
  return selecoes.filter((s) => formasCatalogo.some((f) => f.id === s.forma_id));
}

/** Resolve a forma do catálogo a partir do id da ocorrência (ou id legado do catálogo). */
export function resolverFormaCatalogoDaSelecao(
  selecaoOuId: FormaPagamentoSelecao | string,
  formasCatalogo: OrcamentoFormaPagamento[],
  prec?: OrcamentoPrecificacao | null,
): OrcamentoFormaPagamento | undefined {
  if (typeof selecaoOuId !== 'string') {
    return formasCatalogo.find((f) => f.id === selecaoOuId.forma_id);
  }
  const porCatalogo = formasCatalogo.find((f) => f.id === selecaoOuId);
  if (porCatalogo) return porCatalogo;
  const selecao = resolverFormasPagamentoSelecoes(prec, formasCatalogo).find((s) => s.id === selecaoOuId);
  if (!selecao) return undefined;
  return formasCatalogo.find((f) => f.id === selecao.forma_id);
}

/** Desconto (%) de uma forma — suporta legado com valor manual. */
export function resolverDescontoFormaPagamento(
  prec: OrcamentoPrecificacao,
  formaId: string,
): number {
  const p = normalizarPrecificacao(prec);
  const explicito = p.formas_pagamento_descontos?.[formaId];
  if (explicito != null && !Number.isNaN(explicito)) {
    return Math.min(100, Math.max(0, explicito));
  }

  const valorLegado = p.formas_pagamento_valores?.[formaId];
  if (valorLegado != null && valorLegado > 0 && p.valor_integral > 0) {
    const inferido = (1 - valorLegado / p.valor_integral) * 100;
    return Math.min(100, Math.max(0, arredondar(inferido)));
  }

  const ids = p.formas_pagamento_ids ?? [];
  if (ids[0] === formaId && p.desconto_percent > 0) {
    return p.desconto_percent;
  }

  return 0;
}

/** Acréscimo (%) de uma forma (ex.: taxa no parcelado). */
export function resolverAcrescimoFormaPagamento(
  prec: OrcamentoPrecificacao,
  formaId: string,
): number {
  const p = normalizarPrecificacao(prec);
  const explicito = p.formas_pagamento_acrescimos?.[formaId];
  if (explicito != null && !Number.isNaN(explicito)) {
    return Math.min(200, Math.max(0, explicito));
  }

  const ids = p.formas_pagamento_ids ?? [];
  if (ids[0] === formaId && (p.acrescimo_percent ?? 0) > 0) {
    return Math.min(200, Math.max(0, p.acrescimo_percent ?? 0));
  }

  return 0;
}

/** Valor final calculado: valor integral ± desconto/acréscimo da forma. */
export function resolverValorFormaPagamento(
  prec: OrcamentoPrecificacao,
  formaId: string,
): number {
  const p = normalizarPrecificacao(prec);
  const integral = Math.max(0, p.valor_integral);
  if (integral <= 0) return 0;
  const desconto = resolverDescontoFormaPagamento(p, formaId);
  const acrescimo = resolverAcrescimoFormaPagamento(p, formaId);
  return aplicarDescontoEAcrescimo(integral, desconto, acrescimo);
}

/** Preenche descontos das formas selecionadas quando ainda não definidos. */
export function sincronizarDescontosFormasPagamento(
  ids: string[],
  descontoPadrao: number,
  descontosAtuais: Record<string, number> = {},
  opts?: { sobrescreverTodos?: boolean },
): Record<string, number> {
  const next = { ...descontosAtuais };
  for (const id of ids) {
    if (opts?.sobrescreverTodos || next[id] == null) {
      next[id] = descontoPadrao;
    }
  }
  return next;
}

/** Preenche acréscimos das formas selecionadas quando ainda não definidos. */
export function sincronizarAcrescimosFormasPagamento(
  ids: string[],
  acrescimoPadrao: number,
  acrescimosAtuais: Record<string, number> = {},
  opts?: { sobrescreverTodos?: boolean },
): Record<string, number> {
  const next = { ...acrescimosAtuais };
  for (const id of ids) {
    if (opts?.sobrescreverTodos || next[id] == null) {
      next[id] = acrescimoPadrao;
    }
  }
  return next;
}

/** @deprecated Use sincronizarDescontosFormasPagamento */
export function sincronizarValoresFormasPagamento(
  ids: string[],
  valorFinalPadrao: number,
  valoresAtuais: Record<string, number> = {},
  opts?: { sobrescreverTodos?: boolean },
): Record<string, number> {
  const next = { ...valoresAtuais };
  for (const id of ids) {
    if (opts?.sobrescreverTodos || next[id] == null || next[id] <= 0) {
      next[id] = valorFinalPadrao;
    }
  }
  return next;
}

/** Limite de caracteres da observação por forma (slide/PDF). */
export const OBSERVACAO_FORMA_PAGAMENTO_MAX = 280;

/** Remove vazios e mantém só formas ainda selecionadas. */
export function limparObservacoesFormasPagamento(
  observacoes: Record<string, string> | null | undefined,
  formasIds?: string[] | null,
): Record<string, string> {
  if (!observacoes) return {};
  const idsPermitidos = formasIds?.length ? new Set(formasIds) : null;
  const limpas: Record<string, string> = {};
  for (const [id, raw] of Object.entries(observacoes)) {
    if (idsPermitidos && !idsPermitidos.has(id)) continue;
    const texto = String(raw ?? '')
      .replace(/\r\n/g, '\n')
      .trim()
      .slice(0, OBSERVACAO_FORMA_PAGAMENTO_MAX);
    if (!texto) continue;
    limpas[id] = texto;
  }
  return limpas;
}

export function resolverObservacaoFormaPagamento(
  prec: OrcamentoPrecificacao | null | undefined,
  formaId: string,
): string {
  const raw = prec?.formas_pagamento_observacoes?.[formaId];
  if (!raw) return '';
  return String(raw)
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, OBSERVACAO_FORMA_PAGAMENTO_MAX);
}

export interface CalcularPrecificacaoComFormasInput {
  valorIntegral: number;
  descontoPercent: number;
  acrescimoPercent?: number;
  /** Ocorrências selecionadas (preferir). */
  formasSelecoes?: FormaPagamentoSelecao[];
  /** @deprecated Preferir formasSelecoes — ids do catálogo ou das ocorrências. */
  formasIds?: string[];
  formasCatalogo: OrcamentoFormaPagamento[];
  parcelasPorForma?: Record<string, number>;
  descontosPorForma?: Record<string, number>;
  acrescimosPorForma?: Record<string, number>;
  observacoesPorForma?: Record<string, string>;
  /** @deprecated */
  valoresPorForma?: Record<string, number>;
  parcelasLegacy?: number;
  fracionarPrecos?: boolean;
  itensFracionados?: PrecoFracionadoItem[];
  gruposFracionados?: GrupoPrecosFracionados[];
  exibirTotalFracionado?: boolean;
  adicionarMarkup?: boolean;
  markupComposicao?: MarkupComposicaoPrecificacao;
  markupOrcamentoId?: string | null;
}

function resolverSelecoesDoInput(
  input: Pick<CalcularPrecificacaoComFormasInput, 'formasSelecoes' | 'formasIds' | 'formasCatalogo'>,
): FormaPagamentoSelecao[] {
  if (input.formasSelecoes) {
    return input.formasSelecoes.filter((s) =>
      input.formasCatalogo.some((f) => f.id === s.forma_id),
    );
  }
  return (input.formasIds ?? [])
    .map((id) => {
      const noCatalogo = input.formasCatalogo.find((f) => f.id === id);
      if (noCatalogo) return { id, forma_id: id };
      return null;
    })
    .filter((s): s is FormaPagamentoSelecao => !!s);
}

/** Calcula valores base e persiste múltiplas formas de pagamento selecionadas. */
export function calcularPrecificacaoComFormas(
  input: CalcularPrecificacaoComFormasInput,
): OrcamentoPrecificacao {
  const selecoes = resolverSelecoesDoInput(input);
  const formasIds = selecoes.map((s) => s.id);
  const formaDaSelecao = (selecao: FormaPagamentoSelecao) =>
    input.formasCatalogo.find((f) => f.id === selecao.forma_id) ?? null;

  const primarySelecao = selecoes[0] ?? null;
  const primary = primarySelecao ? formaDaSelecao(primarySelecao) : null;
  const parcelasPrimary =
    primary?.tipo === 'parcelado' && primarySelecao
      ? input.parcelasPorForma?.[primarySelecao.id]
        ?? input.parcelasLegacy
        ?? primary.parcelas_padrao
      : 1;

  const descontosPorForma = sincronizarDescontosFormasPagamento(
    formasIds,
    input.descontoPercent,
    input.descontosPorForma ?? {},
  );
  const acrescimosPorForma = sincronizarAcrescimosFormasPagamento(
    formasIds,
    input.acrescimoPercent ?? 0,
    input.acrescimosPorForma ?? {},
  );

  const primeiraId = formasIds[0];
  const descontoPrimario = primeiraId != null ? descontosPorForma[primeiraId] ?? input.descontoPercent : input.descontoPercent;
  const acrescimoPrimario = primeiraId != null
    ? acrescimosPorForma[primeiraId] ?? input.acrescimoPercent ?? 0
    : input.acrescimoPercent ?? 0;
  const valorFinalPrimario = aplicarDescontoEAcrescimo(
    input.valorIntegral,
    descontoPrimario,
    acrescimoPrimario,
  );

  const fracionarAtivo = input.fracionarPrecos === true;
  const grupos = fracionarAtivo
    ? (input.gruposFracionados?.length
        ? input.gruposFracionados
        : [
            {
              id: 'grupo-principal',
              itens: input.itensFracionados ?? [],
              exibir_total: input.exibirTotalFracionado !== false,
            },
          ])
    : [];
  const legadoFracionado = espelharGruposFracionadosLegado(grupos, fracionarAtivo);

  const base = calcularPrecificacaoCompleta({
    valorIntegral: input.valorIntegral,
    descontoPercent: descontoPrimario,
    acrescimoPercent: acrescimoPrimario,
    forma: primary,
    parcelas: parcelasPrimary,
    fracionarPrecos: fracionarAtivo,
    itensFracionados: legadoFracionado.itens_fracionados,
    adicionarMarkup: input.adicionarMarkup,
    markupComposicao: input.markupComposicao,
    markupOrcamentoId: input.markupOrcamentoId,
  });

  const valoresPorForma: Record<string, number> = {};
  for (const id of formasIds) {
    valoresPorForma[id] = resolverValorFormaPagamento(
      {
        ...base,
        valor_integral: input.valorIntegral,
        formas_pagamento_descontos: descontosPorForma,
        formas_pagamento_acrescimos: acrescimosPorForma,
      },
      id,
    );
  }

  return {
    ...base,
    valor_final: valorFinalPrimario,
    desconto_percent: descontoPrimario,
    acrescimo_percent: acrescimoPrimario,
    formas_pagamento_selecoes: selecoes,
    formas_pagamento_ids: formasIds,
    formas_pagamento_parcelas: input.parcelasPorForma ?? {},
    formas_pagamento_descontos: descontosPorForma,
    formas_pagamento_acrescimos: acrescimosPorForma,
    formas_pagamento_valores: valoresPorForma,
    formas_pagamento_observacoes: limparObservacoesFormasPagamento(
      input.observacoesPorForma,
      formasIds,
    ),
    forma_pagamento_id: primary?.id ?? null,
    forma_pagamento_tipo: primary?.tipo ?? base.forma_pagamento_tipo,
    ...legadoFracionado,
    exibir_total_fracionado: legadoFracionado.exibir_total_fracionado,
  };
}

export interface OpcaoPagamentoApresentacao {
  /** Id da ocorrência (chave React / Records). */
  formaId: string;
  /** Id da forma no catálogo. */
  formaCatalogoId: string;
  nome: string;
  valorIntegral: number;
  descontoPercent: number;
  acrescimoPercent: number;
  valorFinal: number;
  temDesconto: boolean;
  temAcrescimo: boolean;
  linhas: string[];
  /** Observação livre do vendedor para esta forma (slide / PDF / filmagem). */
  observacao?: string;
}

/** Opções de pagamento para exibir no slide (uma entrada por ocorrência selecionada). */
export function opcoesPagamentoApresentacao(
  prec: OrcamentoPrecificacao,
  formasCatalogo: OrcamentoFormaPagamento[] = [],
): OpcaoPagamentoApresentacao[] {
  const p = normalizarPrecificacao(prec);
  const selecoes = resolverFormasPagamentoSelecoes(p, formasCatalogo);

  return selecoes
    .map((selecao) => {
      const forma = formasCatalogo.find((f) => f.id === selecao.forma_id);
      if (!forma) return null;

      const id = selecao.id;
      const parcelas =
        forma.tipo === 'parcelado'
          ? p.formas_pagamento_parcelas?.[id] ?? p.parcelas ?? forma.parcelas_padrao
          : 1;

      const descontoPercent = resolverDescontoFormaPagamento(p, id);
      const acrescimoPercent = resolverAcrescimoFormaPagamento(p, id);
      const valorIntegral = Math.max(0, p.valor_integral);
      const valorFinal = resolverValorFormaPagamento(p, id);

      const snapshot = calcularPrecificacaoCompleta({
        valorIntegral: valorFinal,
        descontoPercent: 0,
        acrescimoPercent: 0,
        forma,
        parcelas,
      });

      const observacao = resolverObservacaoFormaPagamento(p, id);

      return {
        formaId: id,
        formaCatalogoId: forma.id,
        nome: forma.nome,
        valorIntegral,
        descontoPercent,
        acrescimoPercent,
        valorFinal,
        temDesconto: descontoPercent > 0,
        temAcrescimo: acrescimoPercent > 0,
        linhas: linhasPagamentoApresentacao(snapshot),
        ...(observacao ? { observacao } : {}),
      };
    })
    .filter((item): item is OpcaoPagamentoApresentacao => item != null);
}

export function itensFracionadosTemConteudo(itens?: PrecoFracionadoItem[] | null): boolean {
  if (!itens?.length) return false;
  return itens.some((item) => item.label.trim().length > 0 && item.valor > 0);
}

export function somaItensFracionados(itens: PrecoFracionadoItem[]): number {
  return arredondar(itens.reduce((acc, item) => acc + (item.valor > 0 ? item.valor : 0), 0));
}

/**
 * Itens do bloco "preços fracionados" (lista plana — compatível com leitores antigos).
 * Preferir `resolverGruposFracionadosApresentacao` quando houver vários cards.
 */
export function resolverItensFracionadosApresentacao(options: {
  precificacao?: OrcamentoPrecificacao | null;
  itensTemplate?: PrecoFracionadoItem[];
  /** Prévia do template — nunca usar na rota /apresentar. */
  permitirItensTemplate?: boolean;
}): PrecoFracionadoItem[] {
  const grupos = resolverGruposFracionadosApresentacao(options);
  return grupos.flatMap((g) => g.itens);
}

export function precificacaoFracionadaAtiva(prec?: OrcamentoPrecificacao | null): boolean {
  return prec?.fracionar_precos === true;
}

/** Grupos com conteúdo para o slide (rótulo + valor). */
export function resolverGruposFracionadosApresentacao(options: {
  precificacao?: OrcamentoPrecificacao | null;
  itensTemplate?: PrecoFracionadoItem[];
  permitirItensTemplate?: boolean;
}): GrupoPrecosFracionados[] {
  const fracionarAtivo = precificacaoFracionadaAtiva(options.precificacao);

  if (!fracionarAtivo) {
    if (!options.permitirItensTemplate) return [];
    const itens = (options.itensTemplate ?? []).filter((item) => item.label.trim().length > 0);
    return itens.length
      ? [{ id: 'template', itens, exibir_total: true }]
      : [];
  }

  const grupos = normalizarGruposFracionados(options.precificacao);
  const comConteudo = grupos
    .map((g) => ({
      ...g,
      itens: g.itens.filter((item) => item.label.trim().length > 0),
    }))
    .filter((g) => itensFracionadosTemConteudo(g.itens));

  if (comConteudo.length > 0) return comConteudo;

  if (options.permitirItensTemplate) {
    const itens = (options.itensTemplate ?? []).filter((item) => item.label.trim().length > 0);
    return itens.length
      ? [{ id: 'template', itens, exibir_total: true }]
      : [];
  }

  return [];
}

/** Indica se a soma dos itens fracionados deve aparecer no slide (padrão: sim). */
export function exibirTotalFracionadoApresentacao(prec?: OrcamentoPrecificacao | null): boolean {
  if (!precificacaoFracionadaAtiva(prec)) return false;
  const grupos = normalizarGruposFracionados(prec);
  if (grupos.length > 0) return grupos.some((g) => g.exibir_total !== false);
  return prec?.exibir_total_fracionado !== false;
}

/** Itens fictícios só na prévia do template — não na apresentação nem na exportação PDF. */
export function slidePrecosFracionadosModoExemplo(options: {
  previewMode?: boolean;
  faithfulPreview?: boolean;
}): boolean {
  return !!options.previewMode && !options.faithfulPreview;
}

/** Linhas de texto para o slide de investimento (forma principal / legado). */
export function linhasPagamentoApresentacao(prec: OrcamentoPrecificacao): string[] {
  const p = normalizarPrecificacao(prec);
  const linhas: string[] = [];

  if (p.forma_pagamento_tipo === 'a_vista') {
    linhas.push('Pagamento à vista');
    return linhas;
  }

  if (p.forma_pagamento_tipo === 'parcelado' && p.parcelas > 1) {
    linhas.push(`Em até ${p.parcelas}x de ${BRL(p.valor_parcela)}`);
    return linhas;
  }

  if (p.forma_pagamento_tipo === 'entrada_entrega') {
    const entrada = p.valor_entrada ?? 0;
    const entrega = p.valor_entrega ?? 0;
    if (entrada > 0) linhas.push(`Entrada: ${BRL(entrada)}`);
    if (entrega > 0) linhas.push(`Saldo na entrega: ${BRL(entrega)}`);
    return linhas;
  }

  if (p.parcelas > 1) {
    linhas.push(`Em até ${p.parcelas}x de ${BRL(p.valor_parcela)}`);
  }

  return linhas;
}

/** Resumo agrupado para formulário — inclui nome da forma quando há várias. */
export function resumoPagamentoFormulario(
  prec: OrcamentoPrecificacao,
  formasCatalogo: OrcamentoFormaPagamento[] = [],
): string[] {
  const opcoes = opcoesPagamentoApresentacao(prec, formasCatalogo);
  if (opcoes.length <= 1) {
    const unica = opcoes[0];
    if (!unica) return linhasPagamentoApresentacao(prec);
    const linhas = [BRL(unica.valorFinal), ...unica.linhas];
    if (unica.temDesconto || unica.temAcrescimo) {
      const ajustes: string[] = [];
      if (unica.temDesconto) ajustes.push(`−${unica.descontoPercent}%`);
      if (unica.temAcrescimo) ajustes.push(`+${unica.acrescimoPercent}%`);
      linhas.unshift(`De ${BRL(unica.valorIntegral)} (${ajustes.join(', ')})`);
    }
    if (unica.observacao) linhas.push(unica.observacao);
    return linhas;
  }
  return opcoes.flatMap((opcao) => {
    const ajustes: string[] = [];
    if (opcao.temDesconto) ajustes.push(`−${opcao.descontoPercent}%`);
    if (opcao.temAcrescimo) ajustes.push(`+${opcao.acrescimoPercent}%`);
    const cabecalho = ajustes.length > 0
      ? `${opcao.nome}: ${BRL(opcao.valorFinal)} (de ${BRL(opcao.valorIntegral)}, ${ajustes.join(', ')})`
      : `${opcao.nome}: ${BRL(opcao.valorFinal)}`;
    const linhas = [cabecalho, ...opcao.linhas.map((linha) => `  ${linha}`)];
    if (opcao.observacao) linhas.push(`  Obs.: ${opcao.observacao}`);
    return linhas;
  });
}

export const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const parseBRL = (s: string): number => {
  const clean = s.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
};

/** Extrai totais importáveis de um markup do lead para a precificação do slide. */
export function buildMarkupSeedFromOrcamento(markup: MarkupOrcamento): MarkupOrcamentoOpcaoSeed {
  const t = markup.modulos?.totais;
  return {
    id: markup.id,
    titulo: markup.titulo?.trim() || 'Markup',
    materiais: Number(t?.custo_materiais) || 0,
    servicos: Number(t?.custo_servicos) || 0,
    // Despesas no formulário = total − (materiais + serviços); seed guarda o total.
    despesas: 0,
    precoFinal: Number(markup.preco_final || t?.preco_final) || 0,
  };
}
