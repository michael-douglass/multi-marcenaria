import { arredondar } from '@/lib/markup-calculo';
import type { MarkupAuditorLucroMeta } from '@/lib/markup-types';

/** Preço final alvo = custo de material × (percentual / 100). 400% em R$ 10.000 = R$ 40.000. */
export const AUDITOR_LUCRO_PERCENTUAL_PADRAO = 400;

export type { MarkupAuditorLucroFonte, MarkupAuditorLucroMeta } from '@/lib/markup-types';

export type AuditorLucroStatus = 'ok' | 'baixo' | 'acima' | 'sem_material';

export interface AuditorLucroInput {
  custoMateriais: number;
  precoFinal: number;
  percentualAlvo?: number;
}

export interface AuditorLucroResultado {
  percentualAlvo: number;
  custoMateriais: number;
  precoFinal: number;
  precoIdeal: number;
  diferenca: number;
  percentualAtual: number;
  /** (preço final − ideal) / ideal × 100. Negativo = abaixo. */
  percentualDiferenca: number;
  status: AuditorLucroStatus;
}

export function normalizarPercentualAuditorLucro(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return AUDITOR_LUCRO_PERCENTUAL_PADRAO;
  return arredondar(Math.min(9999, Math.max(1, n)));
}

/**
 * Resolve o % alvo do auditor: específico do lead (neste orçamento) ou geral da empresa.
 * Se a fonte for "especifico" sem percentual válido, cai no geral.
 */
export function resolverPercentualAuditorLucro(
  percentualGeral: unknown,
  meta?: MarkupAuditorLucroMeta | null,
): number {
  const geral = normalizarPercentualAuditorLucro(percentualGeral);
  if (meta?.fonte !== 'especifico') return geral;
  if (meta.percentual == null || !Number.isFinite(Number(meta.percentual)) || Number(meta.percentual) <= 0) {
    return geral;
  }
  return normalizarPercentualAuditorLucro(meta.percentual);
}

/**
 * Padrão de auditor do lead: prioriza o mais recente com "Este lead" (específico),
 * senão qualquer meta já gravada em algum orçamento do lead.
 */
export function extrairAuditorLucroPadraoDoLead(
  orcamentos: Array<{
    modulos?: { meta?: { auditor_lucro?: MarkupAuditorLucroMeta | null } | null } | null;
    atualizado_em?: string | null;
  }>,
): MarkupAuditorLucroMeta | null {
  if (!orcamentos.length) return null;
  const ordenados = [...orcamentos].sort((a, b) =>
    (b.atualizado_em ?? '').localeCompare(a.atualizado_em ?? ''),
  );

  for (const o of ordenados) {
    const meta = o.modulos?.meta?.auditor_lucro;
    if (meta?.fonte === 'especifico' && meta.percentual != null && Number(meta.percentual) > 0) {
      return {
        fonte: 'especifico',
        percentual: normalizarPercentualAuditorLucro(meta.percentual),
      };
    }
  }

  for (const o of ordenados) {
    const meta = o.modulos?.meta?.auditor_lucro;
    if (meta?.fonte === 'geral' || meta?.fonte === 'especifico') {
      return {
        fonte: meta.fonte,
        percentual:
          meta.percentual != null && Number(meta.percentual) > 0
            ? normalizarPercentualAuditorLucro(meta.percentual)
            : undefined,
      };
    }
  }

  return null;
}

/** Grava o bloco auditor_lucro na meta do orçamento sem apagar o restante. */
export function comAuditorLucroNaMeta<T extends { meta?: object | null }>(
  modulos: T,
  meta: MarkupAuditorLucroMeta,
): T & { meta: (T['meta'] extends object ? T['meta'] : object) & { auditor_lucro: MarkupAuditorLucroMeta } } {
  return {
    ...modulos,
    meta: {
      ...(modulos.meta ?? {}),
      auditor_lucro: meta,
    },
  } as T & {
    meta: (T['meta'] extends object ? T['meta'] : object) & { auditor_lucro: MarkupAuditorLucroMeta };
  };
}

/** Administrador do CRM (ou super admin). */
export function isMarkupAdmin(
  userRole: string | null | undefined,
  isSuperAdmin = false,
): boolean {
  return isSuperAdmin || userRole === 'admin';
}

export function podeVerAuditorLucro(
  userRole: string | null | undefined,
  isSuperAdmin = false,
): boolean {
  return isMarkupAdmin(userRole, isSuperAdmin);
}

/** Aba Resumo da calculadora (parâmetros, margem e detalhe de lucro). */
export function podeVerMarkupResumo(
  userRole: string | null | undefined,
  isSuperAdmin = false,
): boolean {
  return isMarkupAdmin(userRole, isSuperAdmin);
}

export function calcularPrecoIdealAuditor(
  custoMateriais: number,
  percentualAlvo: number = AUDITOR_LUCRO_PERCENTUAL_PADRAO,
): number {
  const custo = Math.max(0, Number(custoMateriais) || 0);
  const pct = normalizarPercentualAuditorLucro(percentualAlvo);
  return arredondar(custo * (pct / 100));
}

export function calcularAuditorLucro(input: AuditorLucroInput): AuditorLucroResultado {
  const percentualAlvo = normalizarPercentualAuditorLucro(input.percentualAlvo);
  const custoMateriais = arredondar(Math.max(0, Number(input.custoMateriais) || 0));
  const precoFinal = arredondar(Math.max(0, Number(input.precoFinal) || 0));
  const precoIdeal = calcularPrecoIdealAuditor(custoMateriais, percentualAlvo);
  const diferenca = arredondar(precoIdeal - precoFinal);
  const percentualAtual =
    custoMateriais > 0 ? arredondar((precoFinal / custoMateriais) * 100) : 0;
  const percentualDiferenca =
    precoIdeal > 0 ? arredondar(((precoFinal - precoIdeal) / precoIdeal) * 100, 1) : 0;

  let status: AuditorLucroStatus = 'ok';
  if (!(custoMateriais > 0)) {
    status = 'sem_material';
  } else if (precoFinal + 0.005 < precoIdeal) {
    status = 'baixo';
  } else if (precoFinal > precoIdeal + 0.005) {
    status = 'acima';
  }

  return {
    percentualAlvo,
    custoMateriais,
    precoFinal,
    precoIdeal,
    diferenca,
    percentualAtual,
    percentualDiferenca,
    status,
  };
}

export function formatarPercentualDiferencaAuditor(percentual: number): string {
  const abs = Math.abs(percentual);
  return `${String(abs).replace('.', ',')}%`;
}

/** 351,44% → "3,51" (preço atual = material × 3,51). */
export function formatarVezesMaterialAuditor(percentualAtual: number): string {
  const vezes = arredondar(Math.max(0, Number(percentualAtual) || 0) / 100, 2);
  return vezes.toFixed(2).replace('.', ',');
}

/** 351,44 → "351" para comparar com o alvo 400. */
export function formatarIndiceAuditor(percentual: number): string {
  const n = Math.round(Math.max(0, Number(percentual) || 0));
  return String(n);
}

export function rotuloAuditorFaixa(status: AuditorLucroStatus, percentualDiferenca: number): string | null {
  if (status === 'baixo') {
    return `Preço abaixo do ideal ${formatarPercentualDiferencaAuditor(percentualDiferenca)}`;
  }
  if (status === 'acima') {
    return `Preço acima do ideal ${formatarPercentualDiferencaAuditor(percentualDiferenca)}`;
  }
  return null;
}
