// T03 — Classifica os objetos do banco ANTIGO (somente leitura) em incluir/excluir
// e grava supabase/baseline/manifest.json + manifest.md.
// Uso: node --env-file=.env scripts/baseline/build-manifest.mjs
import pg from 'pg'
import fs from 'fs'
import path from 'path'

const OLD_REF = 'zzqgtclvuetemzhqzhbq'
const url = process.env.OLD_DATABASE_URL
if (!url || !url.includes(OLD_REF)) {
  console.error('OLD_DATABASE_URL ausente ou não aponta para o banco antigo')
  process.exit(1)
}

// CRM-Selletos entra porque 13 edge functions do repo, 21 funções SQL e 3 FKs dependem dessas tabelas.
const INCLUDE_TABLE = [/^movelaria_/, /^CRM-multi-empresas>/, /^crm_multiempresas_/, /^CRM-Selletos>/, /^crm_selletos_/, /^quote_/, /^bom_items$/, /^inventory_/,
  /^company_standards$/, /^market_reference_prices$/, /^ai_(memories|prompt_overrides)$/, /^orcamentos_ia_/, /^orcamento_slide_exports$/,
  /^marketing_/, /^mkt_/, /^whatsapp_/, /^agenda_pessoal_/, /^agenda_tarefa_/, /^atalhos$/, /^negativacao_/]
const EXCLUDE_TABLE = [/^plataforma/, /^michael-financias/, /^E-commerce/, /^Chat-Sky/, /^site-proforco/,
  /^mp_/, /^member_/, /^documents_/, /^proforco_/, /^apostila/, /^Leads_proforco/, /^audit_/, /^_migration_history$/]
const INCLUDE_FUNC = [/^movelaria_/, /^me_/, /^crm_/, /^orcamentos_ia_/, /^match_(lead|ai)_/]

// ---------- uso no código ----------
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) out.push(p)
  }
  return out
}
const code = walk('src').concat(walk('supabase/functions')).map(f => fs.readFileSync(f, 'utf8')).join('\n')
const Q = '[\'"`]'
const fromUsed = new Set([...code.matchAll(new RegExp('\\.from\\(\\s*' + Q + '([^\'"`$]+)' + Q, 'g'))].map(m => m[1]))
const rpcUsed = new Set([...code.matchAll(new RegExp('\\.rpc\\(\\s*' + Q + '([^\'"`$]+)' + Q, 'g'))].map(m => m[1]))
const literal = name => ["'", '"', '`'].some(q => code.includes(q + name + q))

// ---------- catálogo ----------
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()
await c.query('SET default_transaction_read_only = on')
const q = async sql => (await c.query(sql)).rows
const NS = "('public','emp_garbo')"

const rels = await q(`select n.nspname s, c.relname n, c.relkind k from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ${NS} and c.relkind in ('r','v','m','p','S') order by 1,2`)
const funcs = await q(`select n.nspname s, p.proname n, p.prosrc src,
  exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') ext
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ${NS}`)
const types = await q(`select n.nspname s, t.typname n, t.typtype k from pg_type t join pg_namespace n on n.oid=t.typnamespace
  where n.nspname in ${NS} and (t.typtype in ('e','d')
    or (t.typtype='c' and exists(select 1 from pg_class c where c.oid=t.typrelid and c.relkind='c')))
    and not exists(select 1 from pg_depend d where d.objid=t.oid and d.deptype='e')`)
const colTypes = await q(`select cn.nspname ts, c.relname tn, tn.nspname tys, coalesce(et.typname,t.typname) ty
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace cn on cn.oid=c.relnamespace
  join pg_type t on t.oid=a.atttypid left join pg_type et on et.oid=t.typelem and t.typcategory='A'
  join pg_namespace tn on tn.oid=coalesce(et.typnamespace,t.typnamespace)
  where a.attnum>0 and not a.attisdropped and cn.nspname in ${NS} and c.relkind in ('r','p') and tn.nspname in ${NS}`)
const seqOwners = await q(`select sn.nspname ss, s.relname sn, tn.nspname ts, t.relname tn from pg_class s
  join pg_namespace sn on sn.oid=s.relnamespace
  join pg_depend d on d.objid=s.oid and d.deptype in ('a','i') and d.classid='pg_class'::regclass
  join pg_class t on t.oid=d.refobjid join pg_namespace tn on tn.oid=t.relnamespace
  where s.relkind='S' and sn.nspname in ${NS}`)
const defaults = await q(`select n.nspname ts, c.relname tn, pg_get_expr(d.adbin,d.adrelid) def from pg_attrdef d
  join pg_class c on c.oid=d.adrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${NS}`)
const fks = await q(`select n.nspname s, c.relname t, con.conname, fn.nspname fs, f.relname ft from pg_constraint con
  join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
  join pg_class f on f.oid=con.confrelid join pg_namespace fn on fn.oid=f.relnamespace
  where con.contype='f' and n.nspname in ${NS}`)
const views = await q(`select schemaname s, viewname n, definition def from pg_views where schemaname in ${NS}`)
const trigs = await q(`select n.nspname s, c.relname t, tg.tgname, pn.nspname fs, p.proname fn from pg_trigger tg
  join pg_class c on c.oid=tg.tgrelid join pg_namespace n on n.oid=c.relnamespace
  join pg_proc p on p.oid=tg.tgfoid join pg_namespace pn on pn.oid=p.pronamespace
  where not tg.tgisinternal and n.nspname in ${NS}`)
const pols = await q(`select schemaname s, tablename t, policyname, coalesce(qual,'')||' '||coalesce(with_check,'') expr
  from pg_policies where schemaname in ('public','emp_garbo','storage')`)
const idx = await q(`select schemaname s, tablename t, indexname i, indexdef def from pg_indexes where schemaname in ${NS}`)
const checks = await q(`select n.nspname s, c.relname t, pg_get_constraintdef(con.oid) def from pg_constraint con
  join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
  where con.contype='c' and n.nspname in ${NS}`)
const cron = await q('select jobname, schedule, command from cron.job')
await c.end()

// ---------- tabelas ----------
const tableDecision = new Map()
for (const r of rels.filter(r => 'rpm'.includes(r.k))) {
  const key = r.s + '.' + r.n
  if (r.s === 'emp_garbo') { tableDecision.set(key, { inc: true, why: 'schema emp_garbo' }); continue }
  const used = fromUsed.has(r.n)
  if (INCLUDE_TABLE.some(x => x.test(r.n))) tableDecision.set(key, { inc: true, why: 'prefixo' })
  else if (EXCLUDE_TABLE.some(x => x.test(r.n))) tableDecision.set(key, { inc: false, why: 'outro sistema' + (used ? ' (ATENCAO: citada no codigo)' : '') })
  else if (used) tableDecision.set(key, { inc: true, why: 'usada no codigo (.from)' })
  else tableDecision.set(key, { inc: false, why: 'sem prefixo e sem uso no codigo' })
}
const incT = k => tableDecision.get(k)?.inc === true
const incTables = [...tableDecision].filter(([, v]) => v.inc).map(([k]) => k)
const excTablesPublic = [...tableDecision].filter(([k, v]) => !v.inc && k.startsWith('public.')).map(([k]) => k.slice(7))
const incTablesPublic = incTables.filter(k => k.startsWith('public.')).map(k => k.slice(7))

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const mentions = (text, name) => new RegExp('(^|[^A-Za-z0-9_>-])"?' + esc(name) + '"?([^A-Za-z0-9_<-]|$)').test(text)

// ---------- funções ----------
const funcNamesPublic = [...new Set(funcs.filter(f => f.s === 'public' && !f.ext).map(f => f.n))]
const srcMap = new Map()
for (const f of funcs) if (f.s === 'public') srcMap.set(f.n, (srcMap.get(f.n) || '') + '\n' + (f.src || ''))
const srcOf = n => srcMap.get(n) || ''
const excNames = excTablesPublic.filter(n => n.length >= 8)
const incNames = incTablesPublic.filter(n => n.length >= 8)
const refsExcluded = new Map()
const refsIncluded = new Map()
for (const n of funcNamesPublic) {
  const src = srcOf(n)
  refsExcluded.set(n, excNames.filter(t => src.includes(t) && mentions(src, t)))
  refsIncluded.set(n, incNames.some(t => src.includes(t)) || /emp_garbo|emp_%|schema_nome|CRM-multi-empresas/.test(src))
}
const funcInc = new Map()
const known = new Set(funcNamesPublic)
const addF = (n, why) => { if (known.has(n) && !funcInc.has(n)) funcInc.set(n, why) }
for (const n of funcNamesPublic) {
  if (INCLUDE_FUNC.some(x => x.test(n))) addF(n, 'prefixo')
  else if (rpcUsed.has(n)) addF(n, 'usada no codigo (.rpc)')
  else if (n.length >= 15 && literal(n)) addF(n, 'citada no codigo')
  else if (refsIncluded.get(n) && refsExcluded.get(n).length === 0) addF(n, 'referencia tabelas incluidas')
}
for (const t of trigs) if (incT(t.s + '.' + t.t) && t.fs === 'public') addF(t.fn, 'trigger em tabela incluida')
const exprTexts = [
  ...pols.filter(p => incT(p.s + '.' + p.t)).map(p => p.expr),
  ...pols.filter(p => p.s === 'storage').map(p => p.expr),
  ...defaults.filter(d => incT(d.ts + '.' + d.tn)).map(d => d.def),
  ...idx.filter(i => incT(i.s + '.' + i.t)).map(i => i.def),
  ...checks.filter(k => incT(k.s + '.' + k.t)).map(k => k.def),
  ...funcs.filter(f => f.s === 'emp_garbo').map(f => f.src || ''),
  ...cron.filter(j => /movelaria/.test(j.jobname)).map(j => j.command),
].join('\n')
const callRe = n => new RegExp('(^|[^A-Za-z0-9_])' + esc(n) + '\\s*\\(')
for (const n of funcNamesPublic) {
  if (!funcInc.has(n) && n.length >= 5 && exprTexts.includes(n) && callRe(n).test(exprTexts)) addF(n, 'usada em policy/default/indice')
}
for (let changed = true; changed;) {
  changed = false
  const body = [...funcInc.keys()].map(srcOf).join('\n')
  for (const n of funcNamesPublic) {
    if (!funcInc.has(n) && n.length >= 5 && body.includes(n) && callRe(n).test(body)) {
      funcInc.set(n, 'chamada por funcao incluida')
      changed = true
    }
  }
}

// ---------- views, tipos, sequences ----------
const viewDecision = views.map(v => {
  if (v.s === 'emp_garbo') return { ...v, inc: true, why: 'schema emp_garbo' }
  const bad = excTablesPublic.filter(t => mentions(v.def, t))
  const good = incTablesPublic.some(t => mentions(v.def, t)) || /emp_garbo/.test(v.def)
  return { ...v, inc: bad.length === 0 && good, why: bad.length ? 'depende de excluida: ' + bad[0] : good ? 'so tabelas incluidas' : 'sem relacao com o escopo' }
})
for (const v of viewDecision) if (v.inc) for (const n of funcNamesPublic) if (!funcInc.has(n) && n.length >= 5 && callRe(n).test(v.def)) funcInc.set(n, 'usada em view')
const usedTypes = new Set(colTypes.filter(r => incT(r.ts + '.' + r.tn)).map(r => r.tys + '.' + r.ty))
usedTypes.add('public.selletos_crm_app_role')
const allFuncSrc = [...funcInc.keys()].map(srcOf).join('\n')
const typeDecision = types.map(t => ({
  ...t,
  inc: t.s === 'emp_garbo' || usedTypes.has(t.s + '.' + t.n) || (t.n.length >= 8 && new RegExp('::\\s*(public\\.)?"?' + esc(t.n) + '"?').test(allFuncSrc)),
}))
const seqInc = new Set()
for (const s of seqOwners) if (incT(s.ts + '.' + s.tn)) seqInc.add(s.ss + '.' + s.sn)
for (const r of rels.filter(r => r.k === 'S')) {
  if (r.s === 'emp_garbo') seqInc.add(r.s + '.' + r.n)
  else if (defaults.some(d => incT(d.ts + '.' + d.tn) && d.def.includes(r.n))) seqInc.add(r.s + '.' + r.n)
}

// ---------- conflitos ----------
const fkConflicts = fks.filter(f => incT(f.s + '.' + f.t) && ['public', 'emp_garbo'].includes(f.fs) && !incT(f.fs + '.' + f.ft))
const funcsRefExcluded = [...funcInc.keys()].filter(n => refsExcluded.get(n)?.length).map(n => ({ n, refs: refsExcluded.get(n).slice(0, 3) }))
const relNames = new Set(rels.map(r => r.n))
const codeTablesMissing = [...fromUsed].filter(n => !relNames.has(n))
const codeTablesExcluded = [...fromUsed].filter(n => tableDecision.get('public.' + n)?.inc === false)
const rpcMissing = [...rpcUsed].filter(n => !known.has(n))
const indexMap = Object.fromEntries(idx.filter(i => incT(i.s + '.' + i.t)).map(i => [i.s + '.' + i.i, i.t]))
const empFuncs = [...new Set(funcs.filter(f => f.s === 'emp_garbo').map(f => 'emp_garbo.' + f.n))]

const manifest = {
  generatedAt: new Date().toISOString(),
  source: OLD_REF,
  tables: incTables.sort(),
  views: viewDecision.filter(v => v.inc).map(v => v.s + '.' + v.n).sort(),
  functions: [...funcInc.keys()].sort().map(n => 'public.' + n).concat(empFuncs),
  types: typeDecision.filter(t => t.inc).map(t => t.s + '.' + t.n).sort(),
  sequences: [...seqInc].sort(),
  indexes: indexMap,
  // FKs de tabela incluída para tabela de outro sistema: ficam fora do baseline.
  skippedFks: fkConflicts.map(f => f.t + " " + f.conname),
}
fs.mkdirSync('supabase/baseline', { recursive: true })
fs.writeFileSync('supabase/baseline/manifest.json', JSON.stringify(manifest, null, 1))

const cnt = (arr, s) => arr.filter(x => x.startsWith(s + '.')).length
const tick = n => '`' + n + '`'
const whyGroups = {}
for (const [k, v] of tableDecision) {
  if (!k.startsWith('public.')) continue
  const g = (v.inc ? 'INCLUIR - ' : 'EXCLUIR - ') + v.why
  if (!whyGroups[g]) whyGroups[g] = []
  whyGroups[g].push(k.slice(7))
}
const fWhy = {}
for (const [, w] of funcInc) fWhy[w] = (fWhy[w] || 0) + 1

const L = []
L.push('# Manifesto de escopo do baseline', '')
L.push('Gerado de ' + tick(OLD_REF) + ' (somente leitura) por ' + tick('scripts/baseline/build-manifest.mjs') + '. A lista exata usada no filtro está em ' + tick('manifest.json') + '.', '')
L.push('## Resumo', '', '| Objeto | Incluídos | Total no antigo |', '|---|---|---|')
L.push('| Tabelas public | ' + cnt(manifest.tables, 'public') + ' | ' + rels.filter(r => r.s === 'public' && 'rpm'.includes(r.k)).length + ' |')
L.push('| Tabelas emp_garbo | ' + cnt(manifest.tables, 'emp_garbo') + ' | ' + rels.filter(r => r.s === 'emp_garbo' && 'rpm'.includes(r.k)).length + ' |')
L.push('| Funções public (nomes) | ' + funcInc.size + ' | ' + funcNamesPublic.length + ' |')
L.push('| Funções emp_garbo | ' + empFuncs.length + ' | ' + empFuncs.length + ' |')
L.push('| Views | ' + manifest.views.length + ' | ' + views.length + ' |')
L.push('| Tipos | ' + manifest.types.length + ' | ' + types.length + ' |')
L.push('| Sequences | ' + manifest.sequences.length + ' | ' + rels.filter(r => r.k === 'S').length + ' |', '')
L.push('## Tabelas de public por decisão', '')
for (const g of Object.keys(whyGroups).sort()) L.push('### ' + g + ' (' + whyGroups[g].length + ')', '', whyGroups[g].sort().map(tick).join(', '), '')
L.push('## Funções de public incluídas, por motivo', '')
for (const g of Object.keys(fWhy).sort()) L.push('- ' + g + ': ' + fWhy[g])
L.push('', '## Views', '')
for (const v of viewDecision) L.push('- ' + tick(v.s + '.' + v.n) + ' — ' + (v.inc ? 'INCLUIR' : 'EXCLUIR') + ' (' + v.why + ')')
L.push('', '## Tipos incluídos', '', manifest.types.map(tick).join(', ') || '_nenhum_', '')
L.push('## Pontos de atenção', '')
L.push('- FKs de tabela incluída para tabela excluída: ' + (fkConflicts.length ? fkConflicts.map(f => tick(f.t + '.' + f.conname) + ' → ' + tick(f.ft)).join('; ') : 'nenhuma'))
L.push('- Funções incluídas que citam tabelas excluídas (são criadas normalmente; só esse trecho falharia em runtime): ' + (funcsRefExcluded.length ? funcsRefExcluded.map(f => tick(f.n) + ' (' + f.refs.join(', ') + ')').join('; ') : 'nenhuma'))
L.push('- Tabelas citadas no código (.from) mas EXCLUÍDAS: ' + (codeTablesExcluded.map(tick).join(', ') || 'nenhuma'))
L.push('- Nomes em .from() que não são tabela em public/emp_garbo no antigo (buckets de storage e nomes de tenant resolvidos em runtime): ' + codeTablesMissing.length)
L.push('- RPCs citadas no código que não existem no antigo: ' + (rpcMissing.map(tick).join(', ') || 'nenhuma'))
fs.writeFileSync('supabase/baseline/manifest.md', L.join('\n') + '\n')

console.log(JSON.stringify({
  tabelas_public: cnt(manifest.tables, 'public'), tabelas_emp: cnt(manifest.tables, 'emp_garbo'),
  funcoes_public: funcInc.size, de: funcNamesPublic.length, funcoes_por_motivo: fWhy,
  views: viewDecision.map(v => v.n + ':' + (v.inc ? 'IN' : 'OUT')), tipos: manifest.types, sequences: manifest.sequences.length,
  fkConflicts: fkConflicts.map(f => f.t + ' -> ' + f.ft), funcsRefExcluded: funcsRefExcluded.slice(0, 15), funcsRefExcludedTotal: funcsRefExcluded.length,
  codeTablesExcluded, rpcMissing,
  decisoes: Object.fromEntries(Object.entries(whyGroups).map(([k, v]) => [k, v.length])),
  incluidas_por_uso: whyGroups['INCLUIR - usada no codigo (.from)'] || [],
  excluidas_sem_prefixo: whyGroups['EXCLUIR - sem prefixo e sem uso no codigo'] || [],
}, null, 1))
