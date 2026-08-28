import { formatInTimeZone } from 'date-fns-tz';
import type { ComissaoLead } from '@/hooks/usePontuaGarboFinanceiro';

const TIMEZONE = 'America/Sao_Paulo';

/** Converte string do banco para data de calendário em São Paulo (evita bug de fuso em yyyy-MM-dd). */
export function parseLeadDateToSaoPaulo(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getMonthYearSaoPaulo(date: Date): { year: number; month: number } {
  return {
    year: Number(formatInTimeZone(date, TIMEZONE, 'yyyy')),
    month: Number(formatInTimeZone(date, TIMEZONE, 'MM')) - 1,
  };
}

/** Data de referência: venda → chegada → criação do lead */
export function getLeadReferenceDate(lead: ComissaoLead): Date | null {
  const raw = lead.vendaRealizadaEm ?? lead.dataChegada ?? lead.criadoEm ?? null;
  return parseLeadDateToSaoPaulo(raw);
}

export function isLeadInMonth(lead: ComissaoLead, year: number, month: number): boolean {
  const d = getLeadReferenceDate(lead);
  if (!d) return false;
  const { year: y, month: m } = getMonthYearSaoPaulo(d);
  return y === year && m === month;
}

export function splitLeadsByCurrentMonth(leads: ComissaoLead[]) {
  const { year, month } = getMonthYearSaoPaulo(new Date());

  const mesAtual: ComissaoLead[] = [];
  const outrosMeses: ComissaoLead[] = [];

  for (const lead of leads) {
    if (isLeadInMonth(lead, year, month)) {
      mesAtual.push(lead);
    } else {
      outrosMeses.push(lead);
    }
  }

  const mesLabel = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(new Date());

  return { mesAtual, todosMeses: leads, outrosMeses, mesLabel };
}
