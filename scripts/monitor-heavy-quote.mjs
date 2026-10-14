/**
 * Monitora quote_analyses (orçamento pesado) a cada 15s.
 * Uso: node scripts/monitor-heavy-quote.mjs [analysisId]
 * Sem ID: segue o registro mais recente das últimas 2h.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const p = path.join(ROOT, '.env')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}

loadEnv()

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL / chave no .env')
  process.exit(1)
}

const sb = createClient(url, key)
let target = process.argv[2] || process.env.MONITOR_ID || null
const started = Date.now()
const log = []
const OUT = path.join(ROOT, 'docs', 'evidence', 'monitor-heavy-upload.json')

const DONE = new Set([
  'COMPLETED',
  'FAILED',
  'NEEDS_REVIEW',
  'ERROR',
  'ABORTED',
])

async function resolveTarget() {
  if (target) return target
  const { data } = await sb
    .from('quote_analyses')
    .select('id, status, created_at, source_pdf_path')
    .gte('created_at', new Date(Date.now() - 2 * 3600_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5)
  const row =
    (data || []).find((r) =>
      ['PENDING', 'EXTRACTING', 'AUDITING', 'AUDITING_REVISION', 'PROCESSING', 'PRICING_PENDING'].includes(
        String(r.status).toUpperCase(),
      ),
    ) || (data || [])[0]
  if (!row) return null
  target = row.id
  console.log(JSON.stringify({ t: new Date().toISOString(), following: target, status: row.status }))
  return target
}

async function tick() {
  const id = await resolveTarget()
  if (!id) {
    console.log(JSON.stringify({ t: new Date().toISOString(), waiting: 'nenhum orçamento recente' }))
    return false
  }

  const { data, error } = await sb
    .from('quote_analyses')
    .select('id, status, updated_at, totals, source_pdf_path, error_message')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.log(JSON.stringify({ t: new Date().toISOString(), error: error.message }))
    return false
  }
  if (!data) {
    console.log(JSON.stringify({ t: new Date().toISOString(), missing: id }))
    target = null
    return false
  }

  const tot = data.totals && typeof data.totals === 'object' ? data.totals : {}
  const row = {
    t: new Date().toISOString(),
    id: data.id,
    elapsed_s: Math.round((Date.now() - started) / 1000),
    status: data.status,
    stage: tot.pipeline_stage || null,
    async: tot.async_chain_status || null,
    page: tot.current_page ?? null,
    pages: tot.pdf_page_count ?? tot.total_pages ?? null,
    pdf: data.source_pdf_path ? String(data.source_pdf_path).split('/').pop() : null,
    err: data.error_message || tot.error_message || null,
    modules: tot.modules ?? null,
    oos: tot.out_of_scope_modules ?? null,
    sale: tot.sale_price ?? null,
    materials: tot.materials_cost ?? null,
  }
  console.log(JSON.stringify(row))
  log.push(row)
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ target: id, log }, null, 2))

  const st = String(data.status).toUpperCase()
  if (DONE.has(st) || /fail|error|abort/i.test(st)) return true
  return false
}

for (let i = 0; i < 240; i++) {
  const done = await tick()
  if (done) {
    console.log(JSON.stringify({ t: new Date().toISOString(), finished: true }))
    process.exit(0)
  }
  await new Promise((r) => setTimeout(r, 15000))
}
console.log(JSON.stringify({ t: new Date().toISOString(), timeout: true }))
process.exit(2)
