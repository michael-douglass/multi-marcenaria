// Configuração do isolamento por empresa (ver docs/multi-empresa/DESIGN.md §1.1).

export const GARBO_ID = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'
export const EMPRESAS_TABLE = 'public."CRM-multi-empresas>empresas<"'

/** Tabelas que NÃO são de tenant (globais da plataforma ou de outro produto). */
export const TENANT_GLOBAL = new Set([
  'public.CRM-multi-empresas>empresas<',
  'public.CRM-multi-empresas>usuario_empresa<',
  'public.CRM-multi-empresas>super_admins<',
  'public.movelaria_schema_migrations',
  'public.market_reference_prices',
  'public.user_roles', // app_role admin/user usado por has_role()
])

/** Prefixos/regex globais. */
export function isGlobal(schema, table) {
  const key = `${schema}.${table}`
  if (TENANT_GLOBAL.has(key)) return true
  if (schema === 'public' && table.startsWith('plataforma_')) return true
  // Produto ProForço (outro sistema que dividia o banco antigo)
  if (/pro-?forco|proforco/i.test(table)) return true
  if (schema === 'public' && /^n8n_chat_histories/.test(table)) return true
  return false
}

/** Coluna de tenant: tabelas do Corte Claude já usam company_id. */
export function tenantColumn(cols) {
  if (cols.includes('company_id')) return 'company_id'
  return 'empresa_id'
}

export function grupoDe(schema, table) {
  if (schema === 'emp_garbo' || schema === 'crm') return 'crm'
  if (table.startsWith('movelaria_')) return 'nucleo'
  return 'outras'
}
