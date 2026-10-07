import type {
  LeadCustomFieldDefinition,
  LeadCustomFieldValue,
} from '@/hooks/useLeadCustomFields';

/** Dados de comissão exibidos ao marcar venda (modal de valor). */
export interface LeadPontuaGarboSaleInfo {
  prestadorId: string;
  prestadorNome: string;
  percentual: number;
}

export interface PontuaGarboPrestadorRef {
  id: string;
  nome: string;
  tipo_usuario?: string;
  comissao_ativa?: boolean;
}

export const PONTUA_GARBO_PERCENTUAL_PADRAO = 10;

/** Status do CRM quando a venda foi marcada como ganha (matriculado). */
export const VENDA_GANHA_STATUS = 'Venda Realizada (Matriculado)';

export function isLeadVendaGanha(
  status: string | null | undefined,
  statusesGanho?: string[],
): boolean {
  const s = (status ?? '').trim();
  if (statusesGanho?.length) {
    return statusesGanho.some((st) => s === st || (st.length > 0 && s.includes(st)));
  }
  return s === VENDA_GANHA_STATUS || s.includes('Venda Realizada');
}

export interface PontuaGarboGanhoMensal {
  key: string;
  label: string;
  valor: number;
}

export interface PontuaGarboResumoFinanceiro {
  totalAGanar: number;
  /** Soma das comissões pendentes + ganhas (carteira total, todos os meses) */
  totalComissaoCarteira: number;
  totalComissaoGanha: number;
  /** Vendas ganhas aguardando o admin liberar a comissão */
  totalAguardandoLiberacao: number;
  ganhoMesAtual: number;
  mediaMensalGanhos: number;
  ganhosPorMes: PontuaGarboGanhoMensal[];
}

interface ComissaoVendaGanhaInput {
  comissao: number;
  vendaRealizadaEm: string | null;
}

const MESES_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
] as const;

function monthKeyFromDate(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function labelFromMonthKey(key: string): string {
  const [y, m] = key.split('-');
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return key;
  return `${MESES_PT[idx]}/${y.slice(2)}`;
}

/** Agrupa comissões de vendas ganhas por mês e calcula totais para o prestador. */
export function buildPontuaGarboResumoFinanceiro(
  vendasGanhasLiberadas: ComissaoVendaGanhaInput[],
  comissaoPendente: number,
  totalAjustes: number,
  totalRetirado: number,
  totalAguardandoLiberacao = 0,
  mesesGrafico = 6,
): PontuaGarboResumoFinanceiro & { saldoParaSacar: number } {
  const totalComissaoGanhaLiberada = vendasGanhasLiberadas.reduce((s, v) => s + v.comissao, 0);
  const totalComissaoGanha = totalComissaoGanhaLiberada + totalAguardandoLiberacao;
  const totalAGanar = comissaoPendente;
  const saldoParaSacar = Math.max(
    0,
    Math.round((totalComissaoGanhaLiberada + totalAjustes - totalRetirado) * 100) / 100,
  );

  const porMes = new Map<string, number>();
  for (const v of vendasGanhasLiberadas) {
    if (!v.vendaRealizadaEm) continue;
    const key = monthKeyFromDate(v.vendaRealizadaEm);
    porMes.set(key, (porMes.get(key) ?? 0) + v.comissao);
  }

  const hoje = new Date();
  const mesAtualKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const ganhoMesAtual = porMes.get(mesAtualKey) ?? 0;

  const mesesComValor = [...porMes.entries()].filter(([, v]) => v > 0);
  const mediaMensalGanhos =
    mesesComValor.length > 0
      ? mesesComValor.reduce((s, [, v]) => s + v, 0) / mesesComValor.length
      : 0;

  const sortedKeys = [...porMes.keys()].sort();
  const ultimos = sortedKeys.slice(-mesesGrafico);
  const ganhosPorMes: PontuaGarboGanhoMensal[] = ultimos.map((key) => ({
    key,
    label: labelFromMonthKey(key),
    valor: porMes.get(key) ?? 0,
  }));

  return {
    totalAGanar,
    totalComissaoCarteira: totalAGanar + totalComissaoGanha,
    totalComissaoGanha,
    totalAguardandoLiberacao,
    saldoParaSacar,
    ganhoMesAtual,
    mediaMensalGanhos,
    ganhosPorMes,
  };
}

export function clampPontuaPercentual(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

type PontuaGarboFieldLike = Pick<
  LeadCustomFieldDefinition,
  'tipo' | 'ativo' | 'config_pontua_garbo' | 'nome'
>;

/** Nome padrão do campo de sistema nos cards de lead. */
export const PONTUA_GARBO_CAMPO_NOME = 'Pontua Garbo';

/** Origem do card criado automaticamente para o parceiro. */
export const PONTUA_GARBO_LEAD_ORIGEM = 'Pontua Garbo';

/**
 * Coluna inicial do card do parceiro no kanban Propspecção.
 * Cadastros via Pontua Garbo entram direto em "Arquiteto".
 */
export const PONTUA_GARBO_LEAD_STATUS_INICIAL = 'Arquiteto';

/** Indicação ainda em andamento no funil. */
export function isOrcamentoIndicadoAberto(
  status: string | null | undefined,
  ganhoStatuses?: string[],
): boolean {
  const s = (status ?? '').trim();
  if (!s) return true;
  if (isLeadVendaGanha(s, ganhoStatuses)) return false;
  if (/perdid/i.test(s)) return false;
  return true;
}

/** Indicação que já virou venda fechada (usa os status de ganho da empresa). */
export function isOrcamentoIndicadoFechado(
  status: string | null | undefined,
  ganhoStatuses?: string[],
): boolean {
  return isLeadVendaGanha(status, ganhoStatuses);
}

type PontuaGarboCampoDefinitivoLike = Pick<
  LeadCustomFieldDefinition,
  'tipo' | 'config_pontua_garbo' | 'nome'
>;

/**
 * Campo do sistema: fica em todos os cards e não pode ser excluído.
 * Identifica pelo nome (Pontua Garbo) ou pela comissão ligada.
 */
export function isPontuaGarboCampoDefinitivo(
  field: PontuaGarboCampoDefinitivoLike | null | undefined,
): boolean {
  if (!field) return false;
  const nome = (field.nome ?? '').trim().toLowerCase();
  if (nome.includes('pontua') && nome.includes('garbo')) return true;
  if (field.tipo != null && field.tipo !== 'usuario_sistema') return false;
  const cfg = field.config_pontua_garbo;
  if (cfg?.ativo === true) return true;
  if (cfg == null && (nome.includes('pontua') || nome.includes('garbo'))) return true;
  return false;
}

/**
 * Campo conta no Pontua Garbo.
 * Config explícita com ativo=false desliga; config null mantém legado (vínculos já existentes).
 */
export function isPontuaGarboFieldActive(field: PontuaGarboFieldLike | null | undefined): boolean {
  if (!field) return false;
  // Campos parciais do select (ex.: só id/nome/config) não devem falhar por ativo/tipo ausentes
  if (field.tipo != null && field.tipo !== 'usuario_sistema') return false;
  if (field.ativo === false) return false;
  const cfg = field.config_pontua_garbo;
  if (cfg == null) {
    const nome = (field.nome ?? '').trim().toLowerCase();
    return nome.includes('pontua') || nome.includes('garbo');
  }
  return cfg.ativo !== false;
}

/** % sugerido ao vincular prestador em lead novo (não altera leads já salvos). */
export function getPontuaPercentualPadraoFromField(
  field: Pick<LeadCustomFieldDefinition, 'config_pontua_garbo'> | null | undefined,
): number {
  const cfg = field?.config_pontua_garbo;
  if (!cfg) return PONTUA_GARBO_PERCENTUAL_PADRAO;
  const raw = cfg.percentual_padrao ?? cfg.percentual;
  if (raw != null && !Number.isNaN(Number(raw))) {
    return clampPontuaPercentual(Number(raw));
  }
  return PONTUA_GARBO_PERCENTUAL_PADRAO;
}

/** Percentual do card (lead); se vazio, usa só o padrão sugerido do campo (não é comissão global). */
export function resolvePontuaPercentual(
  value: Pick<LeadCustomFieldValue, 'pontua_garbo_percentual'> | null | undefined,
  field: Pick<LeadCustomFieldDefinition, 'config_pontua_garbo'> | null | undefined,
): number {
  if (value?.pontua_garbo_percentual != null && !Number.isNaN(Number(value.pontua_garbo_percentual))) {
    return clampPontuaPercentual(Number(value.pontua_garbo_percentual));
  }
  return getPontuaPercentualPadraoFromField(field);
}

/** Mesmas regras do painel amarelo no card: programa ativo, prestador válido e % > 0. */
export function isPontuaGarboComissaoAtivaNoLead(
  field: PontuaGarboFieldLike | null | undefined,
  prestadorId: string | null | undefined,
  prestador: PontuaGarboPrestadorRef | null | undefined,
  valueRow: Pick<LeadCustomFieldValue, 'pontua_garbo_percentual'> | null | undefined,
): boolean {
  if (!isPontuaGarboFieldActive(field)) return false;
  if (!prestadorId?.trim()) return false;
  if (!prestador?.id) return false;
  if (prestador.tipo_usuario === 'prestador_servico' && prestador.comissao_ativa === false) {
    return false;
  }
  return resolvePontuaPercentual(valueRow, field) > 0;
}

export function buildLeadPontuaGarboSaleInfo(
  field: Pick<LeadCustomFieldDefinition, 'tipo' | 'config_pontua_garbo'>,
  prestadorId: string,
  prestador: PontuaGarboPrestadorRef,
  valueRow: Pick<LeadCustomFieldValue, 'pontua_garbo_percentual'> | null | undefined,
): LeadPontuaGarboSaleInfo | null {
  if (!isPontuaGarboComissaoAtivaNoLead(field, prestadorId, prestador, valueRow)) return null;
  return {
    prestadorId: prestador.id,
    prestadorNome: prestador.nome?.trim() || 'Prestador',
    percentual: resolvePontuaPercentual(valueRow, field),
  };
}

export function parsePontuaPercentualInput(raw: string): number {
  const n = parseFloat(raw.replace(',', '.'));
  return clampPontuaPercentual(n);
}

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Comissão Pontua Garbo sobre um valor base (orçamento ou venda). */
export function calcComissaoPontuaGarbo(valorBase: number, percentual: number): number {
  return (Math.max(0, valorBase) * clampPontuaPercentual(percentual)) / 100;
}

export function formatComissaoPontuaGarbo(valorBase: number, percentual: number): string {
  return BRL(calcComissaoPontuaGarbo(valorBase, percentual));
}

/** Valor usado na comissão: venda realizada usa valor_negocio; demais usam orçamento. */
export function resolveValorBaseComissaoGarbo(
  status: string | null | undefined,
  valorOrcamento: number,
  valorNegocio: number,
  ganhoStatuses?: string[],
): number {
  if (isLeadVendaGanha(status, ganhoStatuses)) {
    return valorNegocio > 0 ? valorNegocio : valorOrcamento;
  }
  return valorOrcamento;
}
