import type {
  MarkupConfig,
  MarkupLinhaProduto,
  MarkupModulos,
  MarkupModulosDespesa,
} from './markup-types';
import { criarModulosVazios, MARKUP_DEFAULT_CONFIG } from './markup-types';
import {
  calcularCustoServicosFromLinhas,
  normalizarModulosServicos,
} from './markup-servicos';

export function arredondar(valor: number, casas = 2): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

export function formatarMoedaMarkup(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

export function calcularLinhaProduto(linha: MarkupLinhaProduto): number {
  if (linha.ativo === false) return 0;
  const qtd = linha.quantidade ?? 0;
  const unit = linha.valor_unitario ?? 0;
  return arredondar(qtd * unit);
}

export function calcularCustoMateriais(linhas: MarkupLinhaProduto[]): number {
  return arredondar(
    linhas
      .filter((l) => l.ativo !== false)
      .reduce((acc, l) => acc + calcularLinhaProduto(l), 0),
  );
}

export function aplicarFatorSobras(custo: number, fatorPercent: number): number {
  return arredondar(custo * (1 + fatorPercent / 100));
}

export function calcularCustoDespesas(despesas: MarkupModulosDespesa[]): number {
  return arredondar(
    despesas
      .filter((d) => d.ativo !== false)
      .reduce((acc, d) => acc + (d.valor ?? 0), 0),
  );
}

export function calcularSubtotalCusto(
  custoMateriaisAjustado: number,
  custoServicos: number,
  custoDespesas: number,
  custoFrete: number,
): number {
  return arredondar(custoMateriaisAjustado + custoServicos + custoDespesas + custoFrete);
}

export function aplicarImpostosETaxas(
  subtotal: number,
  percentualImposto: number,
  taxasFinanceiras: number,
): number {
  const totalPercent = percentualImposto + taxasFinanceiras;
  return arredondar(subtotal * (1 + totalPercent / 100));
}

export function aplicarMargemLucro(custoComImpostos: number, margemPercent: number): number {
  return arredondar(custoComImpostos * (1 + margemPercent / 100));
}

export function aplicarDescontoFinal(precoBruto: number, descontoPercent: number): number {
  const pct = Math.min(100, Math.max(0, descontoPercent ?? 0));
  return arredondar(precoBruto * (1 - pct / 100));
}

/**
 * Converte um preço final desejado em % de desconto sobre o preço bruto.
 * Ex.: bruto 100 e alvo 90 → 10%.
 * Mantém precisão alta para o preço recalculado bater com o valor digitado.
 */
export function calcularDescontoPercentFromPrecoAlvo(
  precoBruto: number,
  precoAlvo: number,
): number {
  if (!(precoBruto > 0)) return 0;
  const alvo = Math.min(precoBruto, Math.max(0, arredondar(precoAlvo)));
  const pct = ((precoBruto - alvo) / precoBruto) * 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * Converte um lucro desejado em reais na % de margem sobre o custo com impostos.
 * Ex.: custo 10.000 e lucro 3.000 → 30%.
 */
export function calcularMargemPercentFromLucroAlvo(
  custoComImpostos: number,
  lucroAlvo: number,
): number {
  if (!(custoComImpostos > 0)) return 0;
  const lucro = Math.max(0, arredondar(lucroAlvo));
  return Math.max(0, arredondar((lucro / custoComImpostos) * 100, 6));
}

/** Preenche campos ausentes em orçamentos legados ou parcialmente salvos. */
export function garantirEstruturaModulos(
  modulos: Partial<MarkupModulos> | MarkupModulos | null | undefined,
  config?: Partial<MarkupConfig>,
): MarkupModulos {
  const base = criarModulosVazios(config);
  if (!modulos) return base;

  return {
    ...base,
    ...modulos,
    materiais: {
      ...base.materiais,
      ...(modulos.materiais ?? {}),
      linhas: modulos.materiais?.linhas ?? [],
    },
    servicos: {
      ...base.servicos,
      ...(modulos.servicos ?? {}),
      linhas: modulos.servicos?.linhas ?? [],
    },
    despesas: modulos.despesas ?? [],
    impostos: { ...base.impostos, ...(modulos.impostos ?? {}) },
    margem: { ...base.margem, ...(modulos.margem ?? {}) },
    totais: { ...base.totais, ...(modulos.totais ?? {}) },
    meta: modulos.meta,
  };
}

export function recalcularModulos(modulos: MarkupModulos): MarkupModulos {
  const normalizado = normalizarModulosServicos(garantirEstruturaModulos(modulos));
  const { materiais, servicos, despesas, impostos, margem } = normalizado;

  const custoMateriais = calcularCustoMateriais(materiais.linhas);
  const custoMateriaisAjustado = aplicarFatorSobras(custoMateriais, margem.fator_sobras);
  const custoServicos = calcularCustoServicosFromLinhas(servicos.linhas, servicos.valor_hora);
  const custoDespesas = calcularCustoDespesas(despesas);
  const subtotalCusto = calcularSubtotalCusto(
    custoMateriaisAjustado,
    custoServicos,
    custoDespesas,
    margem.custo_frete,
  );
  // Ordem: todos os custos (materiais+sobras + serviços + despesas + frete + impostos/taxas)
  // → margem de lucro por cima desse total.
  const custoComImpostos = aplicarImpostosETaxas(
    subtotalCusto,
    impostos.percentual_imposto,
    impostos.taxas_financeiras,
  );
  const precoFinalBruto = aplicarMargemLucro(custoComImpostos, margem.margem_lucro);
  const precoFinal = aplicarDescontoFinal(
    precoFinalBruto,
    margem.desconto_final_percent ?? 0,
  );

  return {
    ...normalizado,
    totais: {
      custo_materiais: custoMateriais,
      custo_materiais_ajustado: custoMateriaisAjustado,
      custo_servicos: custoServicos,
      custo_despesas: custoDespesas,
      subtotal_custo: subtotalCusto,
      custo_com_impostos: custoComImpostos,
      preco_final_bruto: precoFinalBruto,
      preco_final: precoFinal,
    },
  };
}

export interface AplicarConfigMarkupOptions {
  /** Preenche horas zeradas com os padrões da configuração (legado — preferir sincronizarServicosComTemplates). */
  preencherHorasPadrao?: boolean;
}

/**
 * Completa parâmetros ausentes com a configuração da empresa.
 * Não sobrescreve impostos/margem/frete/sobras/valor_hora já definidos no orçamento
 * (personalização por cliente — o padrão da empresa permanece intacto).
 */
export function aplicarConfiguracaoFixaNosModulos(
  config: Partial<MarkupConfig>,
  modulos: MarkupModulos,
  _options: AplicarConfigMarkupOptions = {},
): MarkupModulos {
  const cfg = { ...MARKUP_DEFAULT_CONFIG, ...config };
  const fatorSobras =
    modulos.margem?.fator_sobras ?? modulos.materiais?.fator_sobras ?? cfg.fator_sobras;
  const valorHora =
    modulos.servicos?.valor_hora != null && Number.isFinite(modulos.servicos.valor_hora)
      ? modulos.servicos.valor_hora
      : cfg.valor_hora_marcenaria;

  return {
    ...modulos,
    materiais: {
      ...modulos.materiais,
      fator_sobras: fatorSobras,
    },
    servicos: {
      ...modulos.servicos,
      valor_hora: valorHora,
    },
    impostos: {
      percentual_imposto: modulos.impostos?.percentual_imposto ?? cfg.percentual_imposto,
      taxas_financeiras: modulos.impostos?.taxas_financeiras ?? cfg.taxas_financeiras,
    },
    margem: {
      ...modulos.margem,
      margem_lucro: modulos.margem?.margem_lucro ?? cfg.margem_lucro,
      custo_frete: modulos.margem?.custo_frete ?? cfg.custo_frete_padrao,
      fator_sobras: fatorSobras,
    },
  };
}
