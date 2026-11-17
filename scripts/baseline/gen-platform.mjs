// T07/T08 — Gera, a partir do catálogo do banco ANTIGO (somente leitura), o SQL do que o pg_dump de schema não leva:
//   supabase/baseline/002_storage.sql        buckets + policies de storage.objects
//   supabase/baseline/003_realtime_cron.sql  publicação supabase_realtime + cron job da Movelaria
// Uso: node --env-file=.env scripts/baseline/gen-platform.mjs
import pg from 'pg'
import fs from 'fs'
import path from 'path'

const OLD_REF = 'zzqgtclvuetemzhqzhbq'
const url = process.env.OLD_DATABASE_URL
if (!url || !url.includes(OLD_REF)) { console.error('OLD_DATABASE_URL inválida'); process.exit(1) }
const manifest = JSON.parse(fs.readFileSync('supabase/baseline/manifest.json', 'utf8'))
const incTables = new Set(manifest.tables)
const incFuncs = new Set(manifest.functions.map(f => f.split('.')[1]))

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) out.push(p)
  }
  return out
}
const code = walk('src').concat(walk('supabase/functions')).map(f => fs.readFileSync(f, 'utf8')).join('\n')
const baselineSql = fs.readFileSync('supabase/baseline/000_baseline_schema.sql', 'utf8')
const cited = name => ["'", '"', '`'].some(q => code.includes(q + name + q)) || baselineSql.includes("'" + name + "'")

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()
await c.query('SET default_transaction_read_only = on')
const q = async sql => (await c.query(sql)).rows
const buckets = await q('select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by id')
const pols = await q(`select policyname, permissive, roles, cmd, qual, with_check from pg_policies
  where schemaname='storage' and tablename='objects' order by policyname`)
const pub = await q(`select schemaname s, tablename t from pg_publication_tables where pubname='supabase_realtime' order by 1,2`)
const cron = await q('select jobname, schedule, command from cron.job order by jobname')
await c.end()

const lit = v => v === null || v === undefined ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'"
const ident = v => '"' + String(v).replace(/"/g, '""') + '"'

// ---------- storage ----------
// Nomes genéricos que aparecem no código como texto comum, não como bucket (conferido por grep).
const NOT_BUCKETS = new Set(["audios", "pdf", "publico"])
const incBuckets = buckets.filter(b => !NOT_BUCKETS.has(b.id) && (/^movelaria-/.test(b.id) || cited(b.id)))
const incBucketIds = new Set(incBuckets.map(b => b.id))
const S = ['-- T07 — Buckets e policies de storage do escopo Movelaria + CRM.',
  '-- Gerado do catálogo de ' + OLD_REF + ' por scripts/baseline/gen-platform.mjs. Idempotente.', '']
for (const b of incBuckets) {
  const mimes = b.allowed_mime_types ? 'ARRAY[' + b.allowed_mime_types.map(lit).join(', ') + ']::text[]' : 'NULL'
  S.push('INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (' +
    [lit(b.id), lit(b.name), b.public, b.file_size_limit ?? 'NULL', mimes].join(', ') + ')',
  '  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;')
}
S.push('')
const polIn = []
const polOut = []
for (const p of pols) {
  const expr = (p.qual || '') + ' ' + (p.with_check || '')
  const mentioned = buckets.map(b => b.id).filter(id => expr.includes("'" + id + "'"))
  if (mentioned.length && mentioned.every(id => incBucketIds.has(id))) polIn.push(p)
  else polOut.push({ name: p.policyname, why: mentioned.length ? 'bucket fora do escopo: ' + mentioned.filter(id => !incBucketIds.has(id)).join(',') : 'não cita bucket' })
}
const roleList = r => (Array.isArray(r) ? r : String(r).replace(/^{|}$/g, '').split(',')).map(x => x === 'public' ? 'PUBLIC' : ident(x)).join(', ')
const missingFuncs = new Set()
for (const p of polIn) {
  for (const m of ((p.qual || '') + ' ' + (p.with_check || '')).matchAll(/(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/g)) {
    if (/^(movelaria|me|crm|is|has|pf|tem)_/.test(m[1]) && !incFuncs.has(m[1])) missingFuncs.add(m[1])
  }
  S.push('DROP POLICY IF EXISTS ' + ident(p.policyname) + ' ON storage.objects;')
  S.push('CREATE POLICY ' + ident(p.policyname) + ' ON storage.objects AS ' + p.permissive + ' FOR ' + p.cmd + ' TO ' + roleList(p.roles) +
    (p.qual ? '\n  USING (' + p.qual + ')' : '') + (p.with_check ? '\n  WITH CHECK (' + p.with_check + ')' : '') + ';')
}
fs.writeFileSync('supabase/baseline/002_storage.sql', S.join('\n') + '\n')

// ---------- realtime + cron ----------
const R = ['-- T08 — Publicação realtime e job agendado da Movelaria.',
  '-- Gerado do catálogo de ' + OLD_REF + ' por scripts/baseline/gen-platform.mjs. Idempotente.', '']
const pubIn = pub.filter(r => incTables.has(r.s + '.' + r.t))
for (const r of pubIn) {
  R.push('DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE ' + ident(r.s) + '.' + ident(r.t) +
    '; EXCEPTION WHEN duplicate_object THEN NULL; END $$;')
}
R.push('')
const cronIn = cron.filter(j => /movelaria/i.test(j.jobname) && !/net\.http_/.test(j.command))
for (const j of cronIn) R.push('SELECT cron.schedule(' + [lit(j.jobname), lit(j.schedule), lit(j.command)].join(', ') + ');')
fs.writeFileSync('supabase/baseline/003_realtime_cron.sql', R.join('\n') + '\n')

console.log(JSON.stringify({
  buckets_incluidos: incBuckets.map(b => b.id + (b.public ? ' (publico)' : '')),
  buckets_fora: buckets.filter(b => !incBucketIds.has(b.id)).map(b => b.id),
  policies_storage: { incluidas: polIn.length, fora: polOut.length, fora_sem_bucket: polOut.filter(p => p.why === 'não cita bucket').map(p => p.name) },
  funcoes_de_policy_ausentes_no_manifesto: [...missingFuncs],
  realtime: { incluidas: pubIn.length, total_antigo: pub.length, fora: pub.filter(r => !incTables.has(r.s + '.' + r.t)).map(r => r.t) },
  cron_incluidos: cronIn.map(j => j.jobname),
  cron_fora: cron.filter(j => !cronIn.includes(j)).map(j => j.jobname),
}, null, 1))
