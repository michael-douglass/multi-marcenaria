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

/** Aceita UUID ou schema (ex.: emp_garbo) e devolve o id real da empresa. */
export async function resolveEmpresaId(
  client: SupabaseClient,
  empresaId: string,
  schemaNome?: string | null,
): Promise<string> {
  const raw = String(empresaId || '').trim();
  if (UUID_RE.test(raw)) return raw;

  const schema = String(schemaNome || raw || '').trim();
  if (!schema) {
    throw new Error('empresaId inválido: informe o UUID da empresa ou o schema_nome.');
  }

  const { data, error } = await client
    .from(MASTER_TABLES.empresas)
    .select('id')
    .eq('schema_nome', schema)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    throw new Error(
      `Empresa não encontrada para schema "${schema}". Cadastre a casa antes de vincular usuários.`,
    );
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
