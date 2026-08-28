import type {
  OrcamentoDados,
  OrcamentoFormaPagamento,
  OrcamentoPrecificacao,
} from '@/lib/orcamento-slide-types';
import {
  calcularPrecificacaoComFormas,
  normalizarGruposFracionados,
  normalizarPrecificacao,
  opcoesPagamentoApresentacao,
  resolverFormasPagamentoSelecoes,
} from '@/lib/orcamento-slide-precificacao';

/**
 * Valor exibido no slide "Investimento" e sincronizado no card do lead (campo Orçamentos).
 * Usa o valor final após desconto; se não houver desconto, equivale ao valor integral.
 */
export function valorInvestimentoParaLead(
  prec: OrcamentoPrecificacao | null | undefined,
  formasPagamento: OrcamentoFormaPagamento[] = [],
): number {
  if (!prec) return 0;

  const opcoes = opcoesPagamentoApresentacao(prec, formasPagamento);
  if (opcoes.length > 0) {
    const valores = opcoes.map((o) => o.valorFinal).filter((v) => v > 0);
    if (valores.length > 0) return Math.min(...valores);
  }

  if (prec.valor_final > 0) return prec.valor_final;
  return prec.valor_integral > 0 ? prec.valor_integral : 0;
}

export function precificacaoTemValor(prec?: OrcamentoPrecificacao | null): boolean {
  if (!prec) return false;
  return prec.valor_final > 0 || prec.valor_integral > 0;
}

function formasDaPrecificacao(
  stored: OrcamentoPrecificacao | undefined,
  formasPagamento: OrcamentoFormaPagamento[],
): OrcamentoFormaPagamento[] {
  const selecoes = resolverFormasPagamentoSelecoes(stored, formasPagamento);
  return selecoes
    .map((s) => formasPagamento.find((f) => f.id === s.forma_id))
    .filter((f): f is OrcamentoFormaPagamento => !!f);
}

function formaDaPrecificacao(
  stored: OrcamentoPrecificacao | undefined,
  formasPagamento: OrcamentoFormaPagamento[],
): OrcamentoFormaPagamento | null {
  return formasDaPrecificacao(stored, formasPagamento)[0] ?? null;
}

/**
 * Valor exibido no slide Investimento: prioriza dados salvos do orçamento;
 * se vazio, usa o campo Orçamentos do lead vinculado.
 */
export function resolverPrecificacaoApresentacao(options: {
  dados?: OrcamentoDados | null;
  valorOrcamentoLead?: number;
  formasPagamento?: OrcamentoFormaPagamento[];
}): OrcamentoPrecificacao {
  const { dados, valorOrcamentoLead = 0, formasPagamento = [] } = options;
  const stored = dados?.precificacao;

  if (stored && precificacaoTemValor(stored)) {
    if (stored.valor_final <= 0 && stored.valor_integral > 0) {
      return calcularPrecificacaoComFormas({
        valorIntegral: stored.valor_integral,
        descontoPercent: stored.desconto_percent,
        acrescimoPercent: stored.acrescimo_percent ?? 0,
        formasSelecoes: resolverFormasPagamentoSelecoes(stored, formasPagamento),
        formasCatalogo: formasPagamento,
        parcelasPorForma: stored.formas_pagamento_parcelas,
        descontosPorForma: stored.formas_pagamento_descontos,
        acrescimosPorForma: stored.formas_pagamento_acrescimos,
        observacoesPorForma: stored.formas_pagamento_observacoes,
        parcelasLegacy: stored.parcelas,
        fracionarPrecos: stored.fracionar_precos,
        gruposFracionados: stored.fracionar_precos
          ? normalizarGruposFracionados(stored)
          : [],
        itensFracionados: stored.itens_fracionados,
        exibirTotalFracionado: stored.exibir_total_fracionado,
        adicionarMarkup: stored.adicionar_markup,
        markupComposicao: stored.markup_composicao,
      });
    }
    return normalizarPrecificacao(stored);
  }

  if (valorOrcamentoLead > 0) {
    return precificacaoInicialDoLead(
      valorOrcamentoLead,
      stored?.desconto_percent ?? 0,
      formaDaPrecificacao(stored, formasPagamento),
      stored?.parcelas,
      formasPagamento,
      resolverFormasPagamentoSelecoes(stored, formasPagamento).map((s) => s.forma_id),
    );
  }

  return normalizarPrecificacao(stored);
}

/** Sugere precificação inicial a partir do valor_orcamento já cadastrado no lead. */
export function precificacaoInicialDoLead(
  valorOrcamentoLead: number,
  descontoPercent = 0,
  forma: OrcamentoFormaPagamento | null = null,
  parcelas?: number,
  formasPagamento: OrcamentoFormaPagamento[] = [],
  formasIds?: string[],
): OrcamentoPrecificacao {
  const base = valorOrcamentoLead > 0 ? valorOrcamentoLead : 0;
  const formaEfetiva =
    forma ?? formasPagamento.find((f) => f.tipo === 'a_vista') ?? formasPagamento[0] ?? null;
  const ids =
    formasIds?.length
      ? formasIds
      : formaEfetiva
        ? [formaEfetiva.id]
        : [];

  return calcularPrecificacaoComFormas({
    valorIntegral: base,
    descontoPercent,
    formasIds: ids,
    formasCatalogo: formasPagamento,
    parcelasLegacy: parcelas,
  });
}
