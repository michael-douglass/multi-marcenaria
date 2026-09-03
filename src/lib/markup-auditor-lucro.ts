import { arredondar } from '@/lib/markup-calculo';

/** Preço final alvo = custo de material × (percentual / 100). 400% em R$ 10.000 = R$ 40.000. */
export const AUDITOR_LUCRO_PERCENTUAL_PADRAO = 400;

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
