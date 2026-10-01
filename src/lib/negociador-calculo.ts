import { arredondar } from '@/lib/markup-calculo';
import type { MarkupOrcamento } from '@/lib/markup-types';

/** Defaults alinhados à migration 209 / MarkupConfig. */
export const NEGOCIADOR_MARGEM_MINIMA_PADRAO = 100;
export const NEGOCIADOR_PCT_MATERIAL_PADRAO = 33.34;
export const NEGOCIADOR_PCT_MAO_OBRA_PADRAO = 33.33;
export const NEGOCIADOR_PCT_LUCRO_PADRAO = 33.33;

export interface NegociadorSplits {
  material: number;
  maoObra: number;
  lucro: number;
}

export interface NegociadorDivisao {
  valorMaterial: number;
  valorMaoObra: number;
  valorLucro: number;
}

export interface NegociadorSomasOrcamentos {
  custoMaterial: number;
  precoOriginal: number;
  quantidade: number;
}

/** Valores efetivos usados no Negociador (já resolvidos: lead ou global). */
export interface NegociadorConfigEfetiva {
  margemMinimaPercent: number;
  splits: NegociadorSplits;
  /** De onde veio a config ativa. */
  fonte: 'lead' | 'global';
}

export interface LeadNegociadorConfigRow {
  lead_id: number;
  margem_minima_percent: number;
  pct_material: number;
  pct_mao_obra: number;
  pct_lucro: number;
}

export function configGlobalParaNegociador(input: {
  negociador_margem_minima_percent?: number;
  negociador_pct_material?: number;
  negociador_pct_mao_obra?: number;
  negociador_pct_lucro?: number;
}): Omit<NegociadorConfigEfetiva, 'fonte'> {
  return {
    margemMinimaPercent: normalizarMargemMinimaPercent(input.negociador_margem_minima_percent),
    splits: normalizarSplits({
      material: input.negociador_pct_material,
      maoObra: input.negociador_pct_mao_obra,
      lucro: input.negociador_pct_lucro,
    }),
  };
}

/** Lead específico ganha da global; sem override do lead → global. */
export function resolverNegociadorConfig(
  globalConfig: {
    negociador_margem_minima_percent?: number;
    negociador_pct_material?: number;
    negociador_pct_mao_obra?: number;
    negociador_pct_lucro?: number;
  },
  leadConfig?: LeadNegociadorConfigRow | null,
): NegociadorConfigEfetiva {
  const global = configGlobalParaNegociador(globalConfig);
  if (!leadConfig) {
    return { ...global, fonte: 'global' };
  }
  return {
    margemMinimaPercent: normalizarMargemMinimaPercent(leadConfig.margem_minima_percent),
    splits: normalizarSplits({
      material: leadConfig.pct_material,
      maoObra: leadConfig.pct_mao_obra,
      lucro: leadConfig.pct_lucro,
    }),
    fonte: 'lead',
  };
}

/**
 * Piso de venda = custo × (1 + margem_mínima_% / 100).
 * Ex.: custo 10, margem 100% → piso 20.
 */
export function calcularPisoNegociador(custoMaterial: number, margemMinimaPercent: number): number {
  const custo = Math.max(0, Number(custoMaterial) || 0);
  const margem = Math.max(0, Number(margemMinimaPercent) || 0);
  return arredondar(custo * (1 + margem / 100));
}

export function validarSplits(splits: NegociadorSplits, tolerancia = 0.01): boolean {
  const soma =
    (Number(splits.material) || 0) + (Number(splits.maoObra) || 0) + (Number(splits.lucro) || 0);
  return Math.abs(soma - 100) <= tolerancia;
}

export function normalizarSplits(raw?: Partial<NegociadorSplits> | null): NegociadorSplits {
  const material = Number(raw?.material);
  const maoObra = Number(raw?.maoObra);
  const lucro = Number(raw?.lucro);
  const splits: NegociadorSplits = {
    material: Number.isFinite(material) && material >= 0 ? material : NEGOCIADOR_PCT_MATERIAL_PADRAO,
    maoObra: Number.isFinite(maoObra) && maoObra >= 0 ? maoObra : NEGOCIADOR_PCT_MAO_OBRA_PADRAO,
    lucro: Number.isFinite(lucro) && lucro >= 0 ? lucro : NEGOCIADOR_PCT_LUCRO_PADRAO,
  };
  if (!validarSplits(splits)) {
    return {
      material: NEGOCIADOR_PCT_MATERIAL_PADRAO,
      maoObra: NEGOCIADOR_PCT_MAO_OBRA_PADRAO,
      lucro: NEGOCIADOR_PCT_LUCRO_PADRAO,
    };
  }
  return splits;
}

export type NegociadorSplitCampo = keyof NegociadorSplits;

/**
 * Ao mudar um %, redistribui o restante (100 − valor) entre os outros dois,
 * mantendo a proporção relativa deles (ou 50/50 se ambos forem zero).
 */
export function redistribuirSplits(
  campo: NegociadorSplitCampo,
  novoValor: number,
  atuais: NegociadorSplits,
): NegociadorSplits {
  const clamped = arredondar(Math.max(0, Math.min(100, Number(novoValor) || 0)));
  const resto = arredondar(100 - clamped);
  const outros = (['material', 'maoObra', 'lucro'] as const).filter((k) => k !== campo);
  const aKey = outros[0];
  const bKey = outros[1];
  const aAtual = Math.max(0, Number(atuais[aKey]) || 0);
  const bAtual = Math.max(0, Number(atuais[bKey]) || 0);
  const somaOutros = aAtual + bAtual;

  let aNovo: number;
  let bNovo: number;
  if (somaOutros <= 0.0001) {
    aNovo = arredondar(resto / 2);
    bNovo = arredondar(resto - aNovo);
  } else {
    aNovo = arredondar((aAtual / somaOutros) * resto);
    bNovo = arredondar(resto - aNovo);
  }

  return {
    material: campo === 'material' ? clamped : aKey === 'material' ? aNovo : bNovo,
    maoObra: campo === 'maoObra' ? clamped : aKey === 'maoObra' ? aNovo : bNovo,
    lucro: campo === 'lucro' ? clamped : aKey === 'lucro' ? aNovo : bNovo,
  };
}

/** Divide o valor negociado pelas % (opção A: fatia do total). */
export function dividirValorNegociado(
  valorNegociado: number,
  splits: NegociadorSplits,
): NegociadorDivisao {
  const valor = Math.max(0, Number(valorNegociado) || 0);
  const s = normalizarSplits(splits);
  const valorMaterial = arredondar((valor * s.material) / 100);
  const valorMaoObra = arredondar((valor * s.maoObra) / 100);
  // Lucro absorve o resto para fechar centavos.
  const valorLucro = arredondar(valor - valorMaterial - valorMaoObra);
  return { valorMaterial, valorMaoObra, valorLucro };
}

/**
 * Ajusta uma fatia em R$ sem redistribuir: as outras ficam iguais e o total
 * passa a ser a soma. Sem trava de piso/teto — só fatia ≥ 0.
 */
export function ajustarFatiaSemRedistribuir(
  campo: NegociadorSplitCampo,
  novoValorReais: number,
  atuais: NegociadorDivisao,
): { fatias: NegociadorDivisao; total: number } {
  const chave =
    campo === 'material'
      ? 'valorMaterial'
      : campo === 'maoObra'
        ? 'valorMaoObra'
        : 'valorLucro';

  const next: NegociadorDivisao = {
    valorMaterial: arredondar(Math.max(0, Number(atuais.valorMaterial) || 0)),
    valorMaoObra: arredondar(Math.max(0, Number(atuais.valorMaoObra) || 0)),
    valorLucro: arredondar(Math.max(0, Number(atuais.valorLucro) || 0)),
  };
  next[chave] = arredondar(Math.max(0, Number(novoValorReais) || 0));

  const total = arredondar(next.valorMaterial + next.valorMaoObra + next.valorLucro);
  return { fatias: next, total };
}

/**
 * Converte um % digitado na fatia em R$, usando o total atual como base.
 * Ex.: total 1000 e 30% → R$ 300 nessa fatia (as outras não mudam).
 */
export function reaisFromPercentualFatia(percentual: number, totalAtual: number): number {
  const pct = Math.max(0, Number(percentual) || 0);
  const total = Math.max(0, Number(totalAtual) || 0);
  return arredondar((total * pct) / 100);
}

/**
 * Ajusta uma fatia em R$ mantendo o total fixo: o restante se divide entre as outras duas.
 * @deprecated Preferir `ajustarFatiaSemRedistribuir` no Negociador (total sobe/desce).
 */
export function redistribuirFatiasReais(
  campo: NegociadorSplitCampo,
  novoValorReais: number,
  total: number,
  atuais: NegociadorDivisao,
): NegociadorDivisao {
  const teto = Math.max(0, arredondar(Number(total) || 0));
  const clamped = arredondar(Math.max(0, Math.min(teto, Number(novoValorReais) || 0)));
  const resto = arredondar(teto - clamped);
  const mapa: Record<NegociadorSplitCampo, number> = {
    material: atuais.valorMaterial,
    maoObra: atuais.valorMaoObra,
    lucro: atuais.valorLucro,
  };
  const outros = (['material', 'maoObra', 'lucro'] as const).filter((k) => k !== campo);
  const aKey = outros[0];
  const bKey = outros[1];
  const aAtual = Math.max(0, mapa[aKey]);
  const bAtual = Math.max(0, mapa[bKey]);
  const somaOutros = aAtual + bAtual;

  let aNovo: number;
  let bNovo: number;
  if (somaOutros <= 0.0001) {
    aNovo = arredondar(resto / 2);
    bNovo = arredondar(resto - aNovo);
  } else {
    aNovo = arredondar((aAtual / somaOutros) * resto);
    bNovo = arredondar(resto - aNovo);
  }

  return {
    valorMaterial: campo === 'material' ? clamped : aKey === 'material' ? aNovo : bNovo,
    valorMaoObra: campo === 'maoObra' ? clamped : aKey === 'maoObra' ? aNovo : bNovo,
    valorLucro: campo === 'lucro' ? clamped : aKey === 'lucro' ? aNovo : bNovo,
  };
}

/** Converte fatias em R$ → % sobre o total (lucro fecha 100%). */
export function percentuaisFromFatias(
  fatias: NegociadorDivisao,
  total: number,
): NegociadorSplits {
  const t = Math.max(0, Number(total) || 0);
  if (t <= 0) {
    return {
      material: NEGOCIADOR_PCT_MATERIAL_PADRAO,
      maoObra: NEGOCIADOR_PCT_MAO_OBRA_PADRAO,
      lucro: NEGOCIADOR_PCT_LUCRO_PADRAO,
    };
  }
  const material = arredondar((fatias.valorMaterial / t) * 100);
  const maoObra = arredondar((fatias.valorMaoObra / t) * 100);
  const lucro = arredondar(100 - material - maoObra);
  return { material, maoObra, lucro };
}

export function somarCustosEPrecos(orcamentos: MarkupOrcamento[]): NegociadorSomasOrcamentos {
  let custoMaterial = 0;
  let precoOriginal = 0;
  for (const o of orcamentos) {
    const custo = Number(o.modulos?.totais?.custo_materiais ?? 0);
    const preco = Number(o.preco_final ?? 0);
    if (Number.isFinite(custo) && custo > 0) custoMaterial += custo;
    if (Number.isFinite(preco) && preco > 0) precoOriginal += preco;
  }
  return {
    custoMaterial: arredondar(custoMaterial),
    precoOriginal: arredondar(precoOriginal),
    quantidade: orcamentos.length,
  };
}

/**
 * Garante valor negociado dentro de [piso, precoOriginal].
 * Se precoOriginal < piso, o piso vence (não permite negociar abaixo).
 */
export function limitarValorNegociado(
  valor: number,
  piso: number,
  precoOriginal: number,
): number {
  const v = Number(valor);
  const p = Math.max(0, Number(piso) || 0);
  const teto = Math.max(p, Number(precoOriginal) || 0);
  if (!Number.isFinite(v)) return teto;
  return arredondar(Math.min(teto, Math.max(p, v)));
}

export function normalizarMargemMinimaPercent(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return NEGOCIADOR_MARGEM_MINIMA_PADRAO;
  return arredondar(Math.min(9999, n));
}
