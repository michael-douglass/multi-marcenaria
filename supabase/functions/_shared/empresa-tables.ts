import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

export const MASTER_TABLES = {
  usuarios: 'CRM-multi-empresas>usuarios<',
  user_roles: 'CRM-multi-empresas>user_roles<',
  usuario_empresa: 'CRM-multi-empresas>usuario_empresa<',
  leads: 'CRM-multi-empresas>leads<',
} as const;

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
