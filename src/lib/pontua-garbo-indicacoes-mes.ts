import { formatInTimeZone } from 'date-fns-tz';
import { parseLeadDateToSaoPaulo } from '@/lib/prestador-leads-por-mes';
import {
  isOrcamentoIndicadoAberto,
  isOrcamentoIndicadoFechado,
} from '@/lib/pontua-garbo';

const TIMEZONE = 'America/Sao_Paulo';

const MESES_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
] as const;

export interface PontuaGarboIndicacaoLead {
  id: number;
  status: string | null;
  data_chegada?: string | null;
  venda_realizada_em?: string | null;
  criado_em?: string | null;
}

export interface PontuaGarboMesTotais {
  aberto: number;
  fechado: number;
}

export function getCurrentMonthKeySaoPaulo(now = new Date()): string {
  return formatInTimeZone(now, TIMEZONE, 'yyyy-MM');
}

export function monthKeyFromLeadDate(raw: string | null | undefined): string | null {
  const date = parseLeadDateToSaoPaulo(raw);
  if (!date) return null;
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM');
}

export function shiftMonthKey(key: string, delta: number): string {
  const [yearRaw, monthRaw] = key.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return key;
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function clampMonthKey(key: string, minKey: string, maxKey: string): string {
  if (key < minKey) return minKey;
  if (key > maxKey) return maxKey;
  return key;
}

export function labelMonthKeyPt(key: string): string {
  const [year, monthRaw] = key.split('-');
  const monthIndex = Number(monthRaw) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) return key;
  return `${MESES_PT[monthIndex]}/${year.slice(2)}`;
}

/** Aberto usa a chegada; fechado usa a data da venda (ou a chegada, se faltar). */
export function monthKeyDaIndicacao(
  lead: PontuaGarboIndicacaoLead,
  ganhoStatuses?: string[],
): string | null {
  if (isOrcamentoIndicadoFechado(lead.status, ganhoStatuses)) {
    return monthKeyFromLeadDate(lead.venda_realizada_em ?? lead.data_chegada ?? lead.criado_em);
  }
  if (isOrcamentoIndicadoAberto(lead.status, ganhoStatuses)) {
    return monthKeyFromLeadDate(lead.data_chegada ?? lead.criado_em);
  }
  return null;
}

export function accumulateIndicacoesPorMes(
  leads: PontuaGarboIndicacaoLead[],
  ganhoStatuses?: string[],
): {
  porMes: Record<string, PontuaGarboMesTotais>;
  aberto: number;
  fechado: number;
  primeiroMes: string | null;
} {
  const porMes: Record<string, PontuaGarboMesTotais> = {};
  let aberto = 0;
  let fechado = 0;
  let primeiroMes: string | null = null;

  for (const lead of leads) {
    const isFechado = isOrcamentoIndicadoFechado(lead.status, ganhoStatuses);
    const isAberto = isOrcamentoIndicadoAberto(lead.status, ganhoStatuses);
    if (!isFechado && !isAberto) continue;

    const key = monthKeyDaIndicacao(lead, ganhoStatuses);
    if (!key) continue;

    const bucket = porMes[key] ?? { aberto: 0, fechado: 0 };
    if (isFechado) {
      bucket.fechado += 1;
      fechado += 1;
    } else {
      bucket.aberto += 1;
      aberto += 1;
    }
    porMes[key] = bucket;
    if (!primeiroMes || key < primeiroMes) primeiroMes = key;
  }

  return { porMes, aberto, fechado, primeiroMes };
}

export function getTotaisDoMes(
  porMes: Record<string, PontuaGarboMesTotais> | null | undefined,
  monthKey: string,
): PontuaGarboMesTotais {
  return porMes?.[monthKey] ?? { aberto: 0, fechado: 0 };
}

export function rangeMesDoBadge(primeiroMes: string | null, mesAtual: string): {
  minMes: string;
  maxMes: string;
} {
  const maxMes = mesAtual;
  const minMes = primeiroMes && primeiroMes < mesAtual ? primeiroMes : mesAtual;
  return { minMes, maxMes };
}
