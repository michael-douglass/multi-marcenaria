/**
 * M08 — Gera a migration que renomeia o schema emp_garbo → crm e corrige tudo que cita o nome
 * como TEXTO (corpos de função, search_path de função, expressões de policy, regex de validação).
 * Referências por OID (tabelas, views, FKs, triggers) acompanham o rename sozinhas.
 *
 * Uso: node --env-file=.env scripts/multi-empresa/gerar-crm-rename.mjs > supabase/migrations/<ts>_crm_rename.sql
 */
import { connectNovo } from './db.mjs'
import { GARBO_ID } from './tenant-config.mjs'

const c = await connectNovo()
await c.query('set session characteristics as transaction read only')

const RX_OLD = "'^emp_[a-z0-9_]+$'"
const RX_NEW = "'^(crm|emp_[a-z0-9_]+)$'"
const fix = (s) => s.split(RX_OLD).join(RX_NEW).replace(/emp_garbo/g, 'crm')

const out = [
  '-- GERADO por scripts/multi-empresa/gerar-crm-rename.mjs — M08: emp_garbo → crm.',
  '',
  'alter schema emp_garbo rename to crm;',
  '',
]

const funcs = await c.query(`
  select p.oid, n.nspname s, p.proname f, pg_get_functiondef(p.oid) def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.prokind in ('f','p') and n.nspname in ('public','emp_garbo')
    and (p.prosrc like '%emp_garbo%' or p.prosrc like '%^emp_[a-z0-9_]+$%'
         or array_to_string(p.proconfig, ',') like '%emp_garbo%')
  order by n.nspname, p.proname`)
out.push(`-- ${funcs.rows.length} funções reescritas (texto 'emp_garbo' → 'crm'; regex de schema aceita 'crm').`)
for (const f of funcs.rows) {
  out.push(`-- ${f.s}.${f.f}`)
  out.push(fix(f.def).trimEnd() + ';')
  out.push('')
}

const pols = await c.query(`
  select schemaname s, tablename t, policyname p, qual, with_check
  from pg_policies
  where coalesce(qual,'') like '%emp_garbo%' or coalesce(with_check,'') like '%emp_garbo%'
  order by 1,2,3`)
out.push(`-- ${pols.rows.length} policies com 'emp_garbo' nas expressões.`)
const qi = (x) => '"' + x.replace(/"/g, '""') + '"'
for (const r of pols.rows) {
  const schema = r.s === 'emp_garbo' ? 'crm' : r.s
  const parts = []
  if (r.qual) parts.push(`using (${fix(r.qual)})`)
  if (r.with_check) parts.push(`with check (${fix(r.with_check)})`)
  out.push(`alter policy ${qi(r.p)} on ${qi(schema)}.${qi(r.t)} ${parts.join(' ')};`)
}
out.push('')
out.push(`update public."CRM-multi-empresas>empresas<" set schema_nome = 'crm' where id = '${GARBO_ID}';`)
out.push('')
out.push('grant usage on schema crm to anon, authenticated, service_role, app_tenant_definer;')

console.log(out.join('\n'))
await c.end()
