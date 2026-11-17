import { supabase } from '@/integrations/supabase/client';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import type { AgendaConfig, BloqueioRecorrente } from '@/hooks/useAgenda';

const EMPRESA_TABLES = {
  configTable: 'agenda_config',
  reunioesTable: 'agenda_reunioes',
  bloqueiosTable: 'agenda_bloqueios',
  formFieldsTable: 'agenda_form_fields',
} as const;

export interface AgendaPublicScope {
  schema: string | null;
  agendaSlug: string;
  empresaSlug: string | null;
  empresaNome: string | null;
  empresaLogoUrl: string | null;
  configTable: string;
  reunioesTable: string;
  bloqueiosTable: string;
  formFieldsTable: string;
  /** Preenchido por resolveAgendaPublicScope (RPC agenda_publica_dados). */
  dados?: AgendaPublicDados;
}

export function getAgendaPublicClient(scope: AgendaPublicScope) {
  if (scope.schema && isSchemaApiExposed(scope.schema)) {
    return supabase.schema(scope.schema) as typeof supabase;
  }
  return supabase;
}

/** Dados devolvidos pela RPC `agenda_publica_dados` (já filtrados pela empresa dona do slug). */
export interface AgendaPublicDados {
  config: Record<string, unknown>;
  empresa: { slug: string | null; nome: string | null; logo_url: string | null };
  form_fields: Record<string, unknown>[];
  reunioes: { data_hora_inicio: string; data_hora_fim: string; status: string }[];
  bloqueios: { data_inicio: string; data_fim: string; recorrente: boolean | null; tipo_recorrencia: string | null }[];
}

/**
 * Resolve a agenda pública pelo slug (global) via RPC. Com o isolamento multi-empresa o anon não lê
 * as tabelas do CRM direto; a RPC devolve config, empresa, campos e horários ocupados de uma vez.
 */
export async function resolveAgendaPublicScope(
  agendaSlug: string,
  empresaSlug?: string,
): Promise<AgendaPublicScope | null> {
  const { data, error } = await supabase.rpc('agenda_publica_dados' as never, {
    p_agenda_slug: agendaSlug,
    p_empresa_slug: empresaSlug ?? null,
  } as never);
  if (error || !data) return null;
  const dados = data as unknown as AgendaPublicDados;
  return {
    schema: 'crm',
    agendaSlug,
    empresaSlug: dados.empresa?.slug ?? null,
    empresaNome: dados.empresa?.nome ?? null,
    empresaLogoUrl: dados.empresa?.logo_url ?? null,
    ...EMPRESA_TABLES,
    dados,
  };
}

export async function fetchPublicAgendaConfig(scope: AgendaPublicScope): Promise<AgendaConfig | null> {
  const data = scope.dados?.config;
  if (!data) return null;
  return {
    ...data,
    bloqueios_recorrentes: Array.isArray(data.bloqueios_recorrentes)
      ? (data.bloqueios_recorrentes as unknown as BloqueioRecorrente[])
      : [],
  } as unknown as AgendaConfig;
}
