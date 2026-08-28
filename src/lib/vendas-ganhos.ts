import type { Lead } from '@/types/selletos';
import { VENDA_GANHA_STATUS } from '@/lib/pontua-garbo';
import { decodeKanbanFiltroLista } from '@/lib/kanban-filter-encoding';

export type VendasGanhosFonteTipo = 'status';

export interface VendasGanhosFonte {
  tipoFonte: VendasGanhosFonteTipo;
  valorFonte: string;
  filtroOrigens: string[];
  filtroRegioes: string[];
  ativo: boolean;
}

export interface VendasGanhosConfig {
  statusDestinoAoGanhar: string;
  fontes: VendasGanhosFonte[];
}

export const DEFAULT_VENDAS_GANHOS_CONFIG: VendasGanhosConfig = {
  statusDestinoAoGanhar: VENDA_GANHA_STATUS,
  fontes: [
    {
      tipoFonte: 'status',
      valorFonte: VENDA_GANHA_STATUS,
      filtroOrigens: [],
      filtroRegioes: [],
      ativo: true,
    },
  ],
};

export function normalizeVendasGanhosConfig(
  raw: Partial<VendasGanhosConfig> | null | undefined,
): VendasGanhosConfig {
  const statusDestino =
    raw?.statusDestinoAoGanhar?.trim() || DEFAULT_VENDAS_GANHOS_CONFIG.statusDestinoAoGanhar;
  const fontes = Array.isArray(raw?.fontes)
    ? raw.fontes
        .filter((f) => f?.valorFonte?.trim())
        .map((f) => ({
          tipoFonte: 'status' as const,
          valorFonte: String(f.valorFonte).trim(),
          filtroOrigens: Array.isArray(f.filtroOrigens) ? f.filtroOrigens : [],
          filtroRegioes: Array.isArray(f.filtroRegioes) ? f.filtroRegioes : [],
          ativo: f.ativo !== false,
        }))
    : [];
  return {
    statusDestinoAoGanhar: statusDestino,
    fontes: fontes.length > 0 ? fontes : DEFAULT_VENDAS_GANHOS_CONFIG.fontes,
  };
}

export function getStatusesContamComoGanho(config: VendasGanhosConfig): string[] {
  const ativos = config.fontes.filter((f) => f.ativo && f.valorFonte);
  const destino = config.statusDestinoAoGanhar?.trim();
  const fromFontes = ativos.map((f) => f.valorFonte);
  return [...new Set(destino ? [destino, ...fromFontes] : fromFontes)];
}

/** Remove fontes duplicadas (mesmo status) e garante coluna destino nas fontes de ganho. */
export function prepareVendasGanhosConfigForSave(config: VendasGanhosConfig): VendasGanhosConfig {
  const statusDestinoAoGanhar = config.statusDestinoAoGanhar.trim();
  const seen = new Set<string>();
  const fontes: VendasGanhosFonte[] = [];

  for (const fonte of config.fontes) {
    const valorFonte = fonte.valorFonte.trim();
    if (!valorFonte || seen.has(valorFonte)) continue;
    seen.add(valorFonte);
    fontes.push({ ...fonte, valorFonte });
  }

  if (statusDestinoAoGanhar && !seen.has(statusDestinoAoGanhar)) {
    fontes.unshift({
      tipoFonte: 'status',
      valorFonte: statusDestinoAoGanhar,
      filtroOrigens: [],
      filtroRegioes: [],
      ativo: true,
    });
  }

  return {
    statusDestinoAoGanhar,
    fontes: fontes.length > 0 ? fontes : DEFAULT_VENDAS_GANHOS_CONFIG.fontes,
  };
}

function matchesFonte(lead: Lead, fonte: VendasGanhosFonte): boolean {
  if (!fonte.ativo) return false;
  if (lead.status !== fonte.valorFonte) return false;

  if (fonte.filtroOrigens.length > 0 && !fonte.filtroOrigens.includes(lead.origin ?? '')) {
    return false;
  }
  if (fonte.filtroRegioes.length > 0 && !fonte.filtroRegioes.includes(lead.regiao ?? '')) {
    return false;
  }
  return true;
}

/** Lead conta como negócio ganho conforme fontes configuradas. */
export function isLeadNegocioGanho(lead: Lead, config: VendasGanhosConfig): boolean {
  const fontes = config.fontes.filter((f) => f.ativo);
  if (fontes.length === 0) {
    const s = (lead.status ?? '').trim();
    return s === VENDA_GANHA_STATUS || s.includes('Venda Realizada');
  }
  return fontes.some((f) => matchesFonte(lead, f));
}

/** Data usada para filtrar vendas do mês (venda realizada ou última atualização). */
export function getReferenciaVendaDate(lead: Lead): string | undefined {
  return lead.saleDate || lead.updatedAt || lead.dateArrived;
}

/** Data de cadastro do lead (criado_em → dateArrived no adapter). */
export function getLeadCadastroDate(lead: Lead): string | undefined {
  return lead.dateArrived || undefined;
}

/**
 * Dias entre o cadastro do lead e o fechamento da venda.
 * Retorna null se faltar data de cadastro ou de fechamento.
 */
export function calculateLeadJourneyDays(lead: Lead): number | null {
  const cadastro = getLeadCadastroDate(lead);
  const fechamento = getReferenciaVendaDate(lead);
  if (!cadastro || !fechamento) return null;

  const inicio = new Date(`${cadastro}T12:00:00`);
  const fim = new Date(`${fechamento}T12:00:00`);
  const diffMs = fim.getTime() - inicio.getTime();
  if (diffMs < 0) return 0;
  return diffMs / (1000 * 60 * 60 * 24);
}

export function isVendaNoPeriodo(
  lead: Lead,
  config: VendasGanhosConfig,
  periodStart: string,
  periodEnd: string,
): boolean {
  if (!isLeadNegocioGanho(lead, config)) return false;
  const ref = getReferenciaVendaDate(lead);
  if (!ref) return false;
  return ref >= periodStart && ref <= periodEnd;
}

export function filterNegociosGanhos(
  leads: Lead[],
  config: VendasGanhosConfig,
  options?: { periodStart?: string; periodEnd?: string },
): Lead[] {
  return leads.filter((lead) => {
    if (!isLeadNegocioGanho(lead, config)) return false;
    if (options?.periodStart && options?.periodEnd) {
      return isVendaNoPeriodo(lead, config, options.periodStart, options.periodEnd);
    }
    return true;
  });
}

export function buildMarkAsWonUpdates(
  value: number,
  statusDestino: string,
  vendedorId: string,
): {
  status: string;
  valor_negocio: number;
  vendedor_responsavel_id: string;
  venda_realizada_em: string;
} {
  return {
    status: statusDestino,
    valor_negocio: value,
    vendedor_responsavel_id: vendedorId,
    venda_realizada_em: new Date().toISOString(),
  };
}

/** Parse fontes JSON do banco. */
export function parseFontesFromDb(json: unknown): VendasGanhosFonte[] {
  if (!Array.isArray(json)) return DEFAULT_VENDAS_GANHOS_CONFIG.fontes;
  return json.map((item) => {
    const row = item as Record<string, unknown>;
    const filtroOrigemRaw = row.filtro_origem ?? row.filtroOrigens;
    const filtroRegiaoRaw = row.filtro_regiao ?? row.filtroRegioes;
    return {
      tipoFonte: 'status' as const,
      valorFonte: String(row.valor_fonte ?? row.valorFonte ?? '').trim(),
      filtroOrigens:
        decodeKanbanFiltroLista(
          typeof filtroOrigemRaw === 'string' ? filtroOrigemRaw : null,
        ) ?? (Array.isArray(filtroOrigemRaw) ? (filtroOrigemRaw as string[]) : []),
      filtroRegioes:
        decodeKanbanFiltroLista(
          typeof filtroRegiaoRaw === 'string' ? filtroRegiaoRaw : null,
        ) ?? (Array.isArray(filtroRegiaoRaw) ? (filtroRegiaoRaw as string[]) : []),
      ativo: row.ativo !== false,
    };
  }).filter((f) => f.valorFonte);
}
