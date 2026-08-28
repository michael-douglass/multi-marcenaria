import { supabase } from '@/integrations/supabase/client';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import type { AgendaConfig, BloqueioRecorrente } from '@/hooks/useAgenda';

const MASTER_TABLES = {
  configTable: 'CRM-multi-empresas>agenda_config<',
  reunioesTable: 'CRM-multi-empresas>agenda_reunioes<',
  bloqueiosTable: 'CRM-multi-empresas>agenda_bloqueios<',
  formFieldsTable: 'CRM-multi-empresas>agenda_form_fields<',
} as const;

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
}

export function getAgendaPublicClient(scope: AgendaPublicScope) {
  if (scope.schema && isSchemaApiExposed(scope.schema)) {
    return supabase.schema(scope.schema) as typeof supabase;
  }
  return supabase;
}

export async function resolveAgendaPublicScope(
  agendaSlug: string,
  empresaSlug?: string,
): Promise<AgendaPublicScope | null> {
  if (empresaSlug) {
    const { data: empresa } = await supabase
      .from('CRM-multi-empresas>empresas<')
      .select('schema_nome, slug, nome, logo_url')
      .eq('slug', empresaSlug)
      .eq('ativo', true)
      .maybeSingle();

    if (!empresa?.schema_nome) return null;

    return {
      schema: empresa.schema_nome,
      agendaSlug,
      empresaSlug: empresa.slug,
      empresaNome: empresa.nome ?? null,
      empresaLogoUrl: empresa.logo_url ?? null,
      ...EMPRESA_TABLES,
    };
  }

  const { data: masterConfig } = await supabase
    .from(MASTER_TABLES.configTable)
    .select('id')
    .eq('slug', agendaSlug)
    .eq('ativo', true)
    .maybeSingle();

  if (masterConfig) {
    return {
      schema: null,
      agendaSlug,
      empresaSlug: null,
      empresaNome: null,
      empresaLogoUrl: null,
      ...MASTER_TABLES,
    };
  }

  const { data: empresas } = await supabase
    .from('CRM-multi-empresas>empresas<')
    .select('schema_nome, slug, nome, logo_url')
    .eq('ativo', true);

  for (const empresa of empresas ?? []) {
    if (!isSchemaApiExposed(empresa.schema_nome)) continue;

    const client = supabase.schema(empresa.schema_nome) as typeof supabase;
    const { data } = await client
      .from(EMPRESA_TABLES.configTable)
      .select('id')
      .eq('slug', agendaSlug)
      .eq('ativo', true)
      .maybeSingle();

    if (data) {
      return {
        schema: empresa.schema_nome,
        agendaSlug,
        empresaSlug: empresa.slug,
        empresaNome: empresa.nome ?? null,
        empresaLogoUrl: empresa.logo_url ?? null,
        ...EMPRESA_TABLES,
      };
    }
  }

  return null;
}

export async function fetchPublicAgendaConfig(scope: AgendaPublicScope): Promise<AgendaConfig | null> {
  const client = getAgendaPublicClient(scope);
  const { data, error } = await client
    .from(scope.configTable)
    .select('*')
    .eq('slug', scope.agendaSlug)
    .eq('ativo', true)
    .maybeSingle();

  if (error || !data) {
    console.error('Erro ao buscar config pública:', error);
    return null;
  }

  return {
    ...data,
    bloqueios_recorrentes: Array.isArray(data.bloqueios_recorrentes)
      ? (data.bloqueios_recorrentes as unknown as BloqueioRecorrente[])
      : [],
  } as AgendaConfig;
}
