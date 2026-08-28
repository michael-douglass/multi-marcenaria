import { supabase } from '@/integrations/supabase/client';
import type { LeadWithVendor } from '@/hooks/useLeads';
import {
  buildLeadsSelect,
  resolveChatContatosQueryConfig,
  resolveLeadsQueryConfig,
  type LeadsQueryConfig,
} from '@/lib/empresa-tables';

const CHAT_CONTATOS_BATCH_SIZE = 200;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeadsQueryBuilder = any;

function getDb(config: { schema: string | null }) {
  return config.schema ? supabase.schema(config.schema) : supabase;
}

function isAbortLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { message?: string; name?: string; code?: string };
  const message = (err.message ?? '').toLowerCase();
  return (
    err.name === 'AbortError' ||
    err.code === 'ABORT_ERR' ||
    message.includes('aborterror') ||
    message.includes('signal is aborted') ||
    message.includes('the user aborted')
  );
}

interface LeadRowWithVendorId {
  vendedor_responsavel_id: string | null;
  [key: string]: unknown;
}

/** Vendedor via 2ª query — necessário no cadastro global (nomes de tabela com > < quebram o embed do PostgREST). */
export async function enrichLeadsWithVendors(
  leadsData: unknown[],
  config: LeadsQueryConfig,
): Promise<unknown[]> {
  if (config.embedVendorInSelect || leadsData.length === 0) {
    return leadsData;
  }

  const leads = leadsData as LeadRowWithVendorId[];
  const vendorIds = [
    ...new Set(leads.map((l) => l.vendedor_responsavel_id).filter((id): id is string => !!id)),
  ];

  if (vendorIds.length === 0) {
    return leads.map((lead) => ({ ...lead, vendedor: null }));
  }

  const db = getDb(config);
  const vendorMap = new Map<string, { id: string; nome: string; email: string | null }>();

  const chunkSize = 200;
  for (let i = 0; i < vendorIds.length; i += chunkSize) {
    const chunk = vendorIds.slice(i, i + chunkSize);
    const { data, error } = await db
      .from(config.usuariosFkTable)
      .select('id, nome, email')
      .in('id', chunk);

    if (error) {
      console.error('Erro ao buscar vendedores (cadastro global):', error);
      continue;
    }

    data?.forEach((v: { id: string; nome: string; email: string | null }) => {
      vendorMap.set(v.id, v);
    });
  }

  return leads.map((lead) => ({
    ...lead,
    vendedor: lead.vendedor_responsavel_id
      ? vendorMap.get(lead.vendedor_responsavel_id) ?? null
      : null,
  }));
}

/**
 * Paginação: Supabase limita ~1000 linhas por request.
 */
export async function fetchLeadsPaginated(
  config: LeadsQueryConfig,
  applyFilter: (q: LeadsQueryBuilder) => LeadsQueryBuilder,
): Promise<unknown[]> {
  const db = getDb(config);
  const select = buildLeadsSelect(config);
  const pageSize = 1000;
  let allLeadsData: unknown[] = [];
  let from = 0;
  let hasMore = true;
  let retries = 0;
  const maxRetries = 2;

  while (hasMore) {
    try {
      let query = db.from(config.leadsTable).select(select).order('data_chegada', { ascending: false });
      query = applyFilter(query);
      const { data: pageData, error: pageError } = await query.range(from, from + pageSize - 1);

      if (pageError) {
        if (pageError.message?.includes('connection pool') && retries < maxRetries) {
          retries += 1;
          await new Promise((r) => setTimeout(r, 2000 * retries));
          continue;
        }
        throw pageError;
      }

      retries = 0;
      if (pageData && pageData.length > 0) {
        allLeadsData = [...allLeadsData, ...pageData];
        from += pageSize;
        hasMore = pageData.length === pageSize;
      } else {
        hasMore = false;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('connection pool') && retries < maxRetries) {
        retries += 1;
        await new Promise((r) => setTimeout(r, 2000 * retries));
        continue;
      }
      throw err;
    }
  }

  return enrichLeadsWithVendors(allLeadsData, config);
}

/** Busca todos os leads do schema da empresa ativa. */
export async function fetchAllLeadsRaw(schemaEmpresa?: string | null): Promise<unknown[]> {
  const config = resolveLeadsQueryConfig(schemaEmpresa);
  return fetchLeadsPaginated(config, (q) => q);
}

/**
 * Contatos do chat + nomes de webhook.
 * Usa a tabela do schema da empresa (emp_*) ou a master em public.
 */
export async function enrichLeadsWithChatData(
  leadsData: unknown[],
  schemaEmpresa?: string | null,
): Promise<LeadWithVendor[]> {
  const config = resolveLeadsQueryConfig(schemaEmpresa);
  const chatConfig = resolveChatContatosQueryConfig(schemaEmpresa);
  const leadIds = [
    ...new Set(
      (leadsData as { id?: unknown }[])
        .map((l) => l.id)
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
    ),
  ];

  if (leadsData.length === 0) return [];

  let contatosData: { lead_id: number; webhook_id: string | null }[] = [];

  if (leadIds.length > 0) {
    const chatDb = getDb(chatConfig);

    for (let i = 0; i < leadIds.length; i += CHAT_CONTATOS_BATCH_SIZE) {
      const batchIds = leadIds.slice(i, i + CHAT_CONTATOS_BATCH_SIZE);

      const { data: batchData, error: batchError } = await chatDb
        .from(chatConfig.contatosTable)
        .select('lead_id, webhook_id')
        .in('lead_id', batchIds);

      if (batchError) {
        // Cancelamento de request (ex.: trocar de card rápido) não é falha real.
        if (!isAbortLikeError(batchError)) {
          console.error('Erro ao buscar contatos do chat para lote de leads:', {
            message: batchError.message,
            code: batchError.code,
            details: batchError.details,
            hint: batchError.hint,
            schema: chatConfig.schema,
            table: chatConfig.contatosTable,
            batchStart: i,
            batchCount: batchIds.length,
          });
        }
        continue;
      }

      if (batchData && batchData.length > 0) {
        contatosData = contatosData.concat(batchData as { lead_id: number; webhook_id: string | null }[]);
      }
    }
  }

  const webhookIds = [...new Set(contatosData.map((c) => c.webhook_id).filter(Boolean) || [])];

  const webhookMap = new Map<number, string>();

  if (webhookIds.length > 0) {
    const webhooksDb = getDb(config);
    const { data: webhooksData, error: webhooksError } = await webhooksDb
      .from(config.webhooksTable)
      .select('id, nome')
      .in('id', webhookIds as string[]);

    if (webhooksError && !isAbortLikeError(webhooksError)) {
      console.error('Erro ao buscar nomes de webhooks para leads:', {
        message: webhooksError.message,
        code: webhooksError.code,
        schema: config.schema,
        table: config.webhooksTable,
      });
    }

    const webhookNomeMap = new Map<string, string>();
    webhooksData?.forEach((w: { id: string; nome: string }) => webhookNomeMap.set(w.id, w.nome));

    contatosData.forEach((c) => {
      if (c.lead_id && c.webhook_id) {
        const webhookNome = webhookNomeMap.get(c.webhook_id);
        if (webhookNome) {
          webhookMap.set(c.lead_id, webhookNome);
        }
      }
    });
  }

  const leadsWithExtras =
    (leadsData as Record<string, unknown>[]).map((lead) => {
      const l = lead as {
        id: number;
        regiao?: string | null;
        regiao_tabela?: string | null;
        tabela_origem?: string | null;
      };
      return {
        ...lead,
        webhook_nome: webhookMap.get(l.id) || null,
        tabela_origem: l.regiao || null,
        tabela_origem_info: l.regiao
          ? {
              nomeAmigavel: l.regiao,
              nomeTabela: l.regiao_tabela || 'unknown',
            }
          : null,
      };
    }) || [];

  return leadsWithExtras as LeadWithVendor[];
}

export async function fetchLeadByIdEnriched(
  id: number,
  schemaEmpresa?: string | null,
): Promise<LeadWithVendor> {
  const config = resolveLeadsQueryConfig(schemaEmpresa);
  const db = getDb(config);
  const { data, error } = await db
    .from(config.leadsTable)
    .select(buildLeadsSelect(config))
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Lead não encontrado');

  const [withVendor] = await enrichLeadsWithVendors([data], config);
  const enriched = await enrichLeadsWithChatData([withVendor], schemaEmpresa);
  return enriched[0] as LeadWithVendor;
}

const ID_IN_CHUNK = 400;

export function getDataChegadaRangeForCalendarMonth(year: number, monthIndex: number): { from: string; to: string } {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    to: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

export async function fetchLeadsRawForKanbanScope(
  scope: { statuses: string[]; leadIds: number[] },
  dataChegadaRange?: { from: string; to: string } | null,
  schemaEmpresa?: string | null,
): Promise<unknown[]> {
  const config = resolveLeadsQueryConfig(schemaEmpresa);

  const applyDateChegada = (q: LeadsQueryBuilder) => {
    if (!dataChegadaRange) return q;
    return q.gte('data_chegada', dataChegadaRange.from).lte('data_chegada', dataChegadaRange.to);
  };

  const byId = new Map<number, unknown>();

  if (scope.statuses.length > 0) {
    const rows = await fetchLeadsPaginated(config, (q) => applyDateChegada(q.in('status', scope.statuses)));
    (rows as { id: number }[]).forEach((r) => byId.set(r.id, r));
  }

  if (scope.leadIds.length > 0) {
    for (let i = 0; i < scope.leadIds.length; i += ID_IN_CHUNK) {
      const chunk = scope.leadIds.slice(i, i + ID_IN_CHUNK);
      const rows = await fetchLeadsPaginated(config, (q) => applyDateChegada(q.in('id', chunk)));
      (rows as { id: number }[]).forEach((r) => byId.set(r.id, r));
    }
  }

  return [...byId.values()];
}
