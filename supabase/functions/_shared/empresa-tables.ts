import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

export const MASTER_TABLES = {
  empresas: 'CRM-multi-empresas>empresas<',
  usuarios: 'CRM-multi-empresas>usuarios<',
  user_roles: 'CRM-multi-empresas>user_roles<',
  usuario_empresa: 'CRM-multi-empresas>usuario_empresa<',
  leads: 'CRM-multi-empresas>leads<',
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Schema compartilhado do CRM (par de src/lib/empresa-tables.ts). */
export const CRM_SCHEMA = 'crm';

/**
 * Devolve o UUID da empresa. Desde o multi-empresa todas usam o schema `crm`, então o schema NÃO
 * identifica mais a empresa: é preciso o UUID (ou o slug).
 */
export async function resolveEmpresaId(
  client: SupabaseClient,
  empresaId: string,
  schemaNome?: string | null,
): Promise<string> {
  const raw = String(empresaId || '').trim();
  if (UUID_RE.test(raw)) return raw;

  void schemaNome;
  if (!raw) {
    throw new Error('empresaId inválido: informe o UUID ou o slug da empresa.');
  }

  const { data, error } = await client
    .from(MASTER_TABLES.empresas)
    .select('id')
    .eq('slug', raw)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    throw new Error(`Empresa não encontrada para "${raw}". Informe o UUID ou o slug da empresa.`);
  }

  return data.id as string;
}

export interface EmpresaDbTarget {
  schema: string | null;
  usuariosTable: string;
  rolesTable: string;
  leadsTable: string;
}

export function resolveEmpresaDb(schemaNome?: string | null): EmpresaDbTarget {
  if (schemaNome) {
    return {
      schema: schemaNome,
      usuariosTable: 'usuarios',
      rolesTable: 'user_roles',
      leadsTable: 'leads',
    };
  }
  return {
    schema: null,
    usuariosTable: MASTER_TABLES.usuarios,
    rolesTable: MASTER_TABLES.user_roles,
    leadsTable: MASTER_TABLES.leads,
  };
}

export function dbFromSchema(client: SupabaseClient, schema: string | null) {
  return schema ? client.schema(schema) : client;
}
