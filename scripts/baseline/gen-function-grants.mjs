// T10 — Alinha o EXECUTE das funções do banco NOVO ao do ANTIGO.
// Projetos Supabase novos dão EXECUTE a anon/authenticated/service_role por privilégio padrão;
// o pg_dump não emite REVOKE para o que o banco antigo nunca concedeu. Gera supabase/baseline/004_function_grants.sql.
import pg from 'pg'
import fs from 'fs'
const m = JSON.parse(fs.readFileSync('supabase/baseline/manifest.json', 'utf8'))
const funcs = new Set(m.functions)
const sql = `select n.nspname||'.'||p.proname rel, format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) sig,
  coalesce((select array_agg(case when a.grantee=0 then 'PUBLIC' else r.rolname::text end)::text[] from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    left join pg_roles r on r.oid=a.grantee where a.privilege_type='EXECUTE' and (a.grantee=0 or r.rolname in ('anon','authenticated','service_role'))), '{}'::text[]) roles
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','emp_garbo') and p.prokind in ('f','p')`
const get = async (url, ref) => {
  if (!url || !url.includes(ref)) throw new Error('URL inválida para ' + ref)
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect(); await c.query('SET default_transaction_read_only = on')
  const r = await c.query(sql); await c.end()
  return new Map(r.rows.filter(x => funcs.has(x.rel)).map(x => [x.sig, new Set(x.roles)]))
}
const [o, n] = await Promise.all([get(process.env.OLD_DATABASE_URL, 'zzqgtclvuetemzhqzhbq'), get(process.env.DATABASE_URL, 'vejugdspjfgfajdpfiht')])
const out = ['-- T10 — EXECUTE das funções igual ao banco antigo (gerado por scripts/baseline/gen-function-grants.mjs).', '']
for (const [sig, nr] of [...n].sort()) {
  const or = o.get(sig); if (!or) continue
  const extra = [...nr].filter(r => !or.has(r)), missing = [...or].filter(r => !nr.has(r))
  if (extra.length) out.push('REVOKE EXECUTE ON FUNCTION ' + sig + ' FROM ' + extra.join(', ') + ';')
  if (missing.length) out.push('GRANT EXECUTE ON FUNCTION ' + sig + ' TO ' + missing.join(', ') + ';')
}
fs.writeFileSync('supabase/baseline/004_function_grants.sql', out.join('\n') + '\n')
console.log('instruções geradas:', out.length - 2)
