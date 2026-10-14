/**
 * Monitora novas fichas de orçamento IA e limpa PENDING órfãs (>3 min sem PDF).
 * Uso: node --env-file=.env scripts/watch-quote-uploads.mjs [companyId]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (process.env[m[1]] === undefined) process.env[m[1]] = v
}

const company =
  process.argv[2] || '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'
const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

let lastSeen = ''

async function tick() {
  const { data, error } = await sb
    .from('quote_analyses')
    .select('id,status,source_pdf_path,error_message,totals,created_at,updated_at')
    .eq('company_id', company)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error(JSON.stringify({ t: new Date().toISOString(), error: error.message }))
    return
  }

  const top = data?.[0]
  const totals =
    top?.totals && typeof top.totals === 'object' ? top.totals : {}
  const line = top
    ? {
        t: new Date().toISOString(),
        id: top.id,
        status: top.status,
        pdf: Boolean(top.source_pdf_path),
        stage: totals.pipeline_stage || totals.stage || null,
        async: totals.async_status || null,
        err: top.error_message,
        age_s: Math.round((Date.now() - new Date(top.created_at).getTime()) / 1000),
      }
    : { t: new Date().toISOString(), empty: true }

  const serialized = JSON.stringify(line)
  if (serialized !== lastSeen) {
    console.log(serialized)
    lastSeen = serialized
  }

  for (const row of data ?? []) {
    if (row.status !== 'PENDING' || row.source_pdf_path) continue
    const age = Math.round((Date.now() - new Date(row.created_at).getTime()) / 1000)
    if (age >= 600) {
      console.log(
        JSON.stringify({
          action: 'orphan_warn',
          id: row.id,
          age_s: age,
          note: 'PENDING sem path — nao apagar automaticamente',
        }),
      )
    }
  }
}

console.log(JSON.stringify({ watching: company, interval_s: 5 }))
setInterval(() => {
  tick().catch((e) => console.error(e?.message || e))
}, 5000)
await tick()
