// T10 — Paridade de schema entre o banco ANTIGO e o NOVO, restrita ao manifesto.
// Somente leitura nos dois. Uso: node --env-file=.env scripts/baseline/compare-schemas.mjs [--verbose]
import pg from 'pg'
import fs from 'fs'

const OLD_REF = 'zzqgtclvuetemzhqzhbq'
const NEW_REF = 'vejugdspjfgfajdpfiht'
const verbose = process.argv.includes('--verbose')
const m = JSON.parse(fs.readFileSync('supabase/baseline/manifest.json', 'utf8'))
const rels = new Set([...m.tables, ...m.views])
const funcs = new Set(m.functions)
const types = new Set(m.types)
const skippedFks = new Set(m.skippedFks.map(s => s.split(' ')[1]))
const storageSql = fs.readFileSync('supabase/baseline/002_storage.sql', 'utf8')
const bucketIds = new Set([...storageSql.matchAll(/VALUES \('([^']+)'/g)].map(x => x[1]))
const storagePolicies = new Set([...storageSql.matchAll(/CREATE POLICY "((?:[^"]|"")+)"/g)].map(x => x[1].replace(/""/g, '"')))

const NS = "('public','emp_garbo')"
const Q = {
  colunas: `select n.nspname||'.'||c.relname rel, a.attname||' '||format_type(a.atttypid,a.atttypmod)||
      case when a.attnotnull then ' NOT NULL' else '' end||
      coalesce(' DEFAULT '||pg_get_expr(d.adbin,d.adrelid),'')||
      case when a.attidentity<>'' then ' IDENTITY '||a.attidentity::text else '' end||
      case when a.attgenerated<>'' then ' GENERATED' else '' end item
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attnum>0 and not a.attisdropped and c.relkind in ('r','p','v','m') and n.nspname in ${NS}`,
  constraints: `select n.nspname||'.'||c.relname rel, con.conname||' '||pg_get_constraintdef(con.oid) item, con.conname nm
    from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${NS}`,
  indices: `select schemaname||'.'||tablename rel, indexdef item from pg_indexes where schemaname in ${NS}`,
  triggers: `select n.nspname||'.'||c.relname rel, pg_get_triggerdef(t.oid)||' ['||t.tgenabled::text||']' item from pg_trigger t
    join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ${NS}`,
  policies: `select schemaname||'.'||tablename rel, policyname||' | '||permissive||' | '||cmd||' | '||array_to_string(roles,',')||' | '||
      coalesce(qual,'-')||' | '||coalesce(with_check,'-') item from pg_policies where schemaname in ${NS}`,
  rls: `select n.nspname||'.'||c.relname rel, 'rls='||c.relrowsecurity||' force='||c.relforcerowsecurity||' kind='||c.relkind::text item
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p','v','m') and n.nspname in ${NS}`,
  grants_tabela: `select table_schema||'.'||table_name rel, grantee||':'||privilege_type item from information_schema.role_table_grants
    where table_schema in ${NS} and grantee in ('anon','authenticated','service_role','PUBLIC')`,
  views: `select schemaname||'.'||viewname rel, regexp_replace(definition,'\\s+',' ','g') item from pg_views where schemaname in ${NS}`,
  funcoes: `select n.nspname||'.'||p.proname rel, pg_get_function_identity_arguments(p.oid)||' => '||md5(replace(p.prosrc, E'\r', ''))||' ret='||pg_get_function_result(p.oid)||' lang='||(select lanname from pg_language l where l.oid=p.prolang)||' secdef='||p.prosecdef||' vol='||p.provolatile::text||' strict='||p.proisstrict||' cfg='||coalesce(array_to_string(p.proconfig,';'),'-') item
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ${NS} and p.prokind in ('f','p')
    and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')`,
  grants_funcao: `select n.nspname||'.'||p.proname rel, pg_get_function_identity_arguments(p.oid)||' :: '||
      coalesce((select string_agg(case when a.grantee=0 then 'PUBLIC' else r.rolname end, ',' order by case when a.grantee=0 then 'PUBLIC' else r.rolname end)
        from aclexplode(p.proacl) a left join pg_roles r on r.oid=a.grantee
        where a.privilege_type='EXECUTE' and (a.grantee=0 or r.rolname in ('anon','authenticated','service_role'))),
        case when p.proacl is null then 'DEFAULT' else '-' end) item
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ${NS} and p.prokind in ('f','p')
    and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')`,
  enums: `select n.nspname||'.'||t.typname rel, string_agg(e.enumlabel, ',' order by e.enumsortorder) item from pg_type t
    join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname in ${NS} group by 1`,
  sequences: `select sequence_schema||'.'||sequence_name rel, data_type||' inc='||increment item from information_schema.sequences where sequence_schema in ${NS}`,
  buckets: `select id rel, 'public='||public||' limit='||coalesce(file_size_limit::text,'-')||' mime='||coalesce(array_to_string(allowed_mime_types,','),'-') item from storage.buckets`,
  storage_policies: `select policyname rel, permissive||' | '||cmd||' | '||array_to_string(roles,',')||' | '||coalesce(qual,'-')||' | '||coalesce(with_check,'-') item
    from pg_policies where schemaname='storage' and tablename='objects'`,
  realtime: `select schemaname||'.'||tablename rel, 'publicada' item from pg_publication_tables where pubname='supabase_realtime'`,
  migrations: `select 'movelaria_schema_migrations' rel, filename item from public.movelaria_schema_migrations`,
  schema_grants: `select n.nspname rel, r.rolname||':'||a.privilege_type item from pg_namespace n, aclexplode(n.nspacl) a join pg_roles r on r.oid=a.grantee
    where n.nspname='emp_garbo' and r.rolname in ('anon','authenticated','service_role')`,
}
const inScope = {
  colunas: r => rels.has(r.rel), constraints: r => rels.has(r.rel) && !skippedFks.has(r.nm), indices: r => rels.has(r.rel),
  triggers: r => rels.has(r.rel), policies: r => rels.has(r.rel), rls: r => rels.has(r.rel), grants_tabela: r => rels.has(r.rel),
  views: r => rels.has(r.rel), funcoes: r => funcs.has(r.rel), grants_funcao: r => funcs.has(r.rel), enums: r => types.has(r.rel),
  sequences: r => m.sequences.includes(r.rel), buckets: r => bucketIds.has(r.rel), storage_policies: r => storagePolicies.has(r.rel),
  realtime: r => rels.has(r.rel), migrations: () => true, schema_grants: () => true,
}
// PG15 e PG17 imprimem a mesma expressão com pequenas diferenças de formatação.
const norm = s => String(s).replace(/\s+/g, ' ').trim()
// PG17 imprime ANY (ARRAY[(x)::text, ...]) onde o PG15 imprime ANY ((ARRAY[x, ...])::text[]) — mesma regra.
// PG16+ omite o qualificador de tabela nas colunas de uma view de tabela única (t.col -> col).
const normView = s => norm(s).replace(/("[^"]+"|[a-z_][a-z0-9_]*).(?=[a-z_"])/g, '')
const normCheck = s => norm(s).replace(/::text(\[\])?/g, '').replace(/[()]/g, '')

async function snapshot(url, ref, label) {
  if (!url || !url.includes(ref)) throw new Error(label + ': URL não aponta para ' + ref)
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()
  await c.query('SET default_transaction_read_only = on')
  await c.query("SET search_path = ''")
  const out = {}
  for (const [k, sql] of Object.entries(Q)) {
    const { rows } = await c.query(sql)
    out[k] = new Set(rows.filter(inScope[k]).map(r => r.rel + ' :: ' + (k === 'constraints' ? normCheck(r.item) : k === 'views' ? normView(r.item) : norm(r.item))))
  }
  await c.end()
  return out
}
const [oldS, newS] = await Promise.all([
  snapshot(process.env.OLD_DATABASE_URL, OLD_REF, 'antigo'),
  snapshot(process.env.DATABASE_URL, NEW_REF, 'novo'),
])
let total = 0
const report = {}
for (const k of Object.keys(Q)) {
  const onlyOld = [...oldS[k]].filter(x => !newS[k].has(x)).sort()
  const onlyNew = [...newS[k]].filter(x => !oldS[k].has(x)).sort()
  total += onlyOld.length + onlyNew.length
  report[k] = { antigo: oldS[k].size, novo: newS[k].size, so_no_antigo: onlyOld.length, so_no_novo: onlyNew.length }
  console.log((onlyOld.length + onlyNew.length === 0 ? 'OK  ' : 'DIFF') + ' ' + k.padEnd(17) + ' antigo=' + String(oldS[k].size).padStart(5) +
    ' novo=' + String(newS[k].size).padStart(5) + (onlyOld.length + onlyNew.length ? '  só-antigo=' + onlyOld.length + ' só-novo=' + onlyNew.length : ''))
  const lim = verbose ? 200 : 4
  for (const x of onlyOld.slice(0, lim)) console.log('     - antigo: ' + x.slice(0, verbose ? 2000 : 260))
  for (const x of onlyNew.slice(0, lim)) console.log('     + novo  : ' + x.slice(0, verbose ? 2000 : 260))
}
console.log('\nTOTAL de diferenças: ' + total)
fs.writeFileSync('supabase/baseline/.work/parity-report.json', JSON.stringify(report, null, 1))
