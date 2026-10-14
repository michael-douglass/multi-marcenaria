import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
  if (!m) continue
  let v = m[2].trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  )
    v = v.slice(1, -1)
  if (process.env[m[1]] === undefined) process.env[m[1]] = v
}

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

const id = process.argv[2] || '66855717-b91c-48d7-a805-a0021f856b7e'

const { data: buckets, error: bErr } = await sb.storage.listBuckets()
console.log(
  'buckets',
  bErr?.message ||
    buckets?.map((b) => ({
      name: b.name,
      public: b.public,
      file_size_limit: b.file_size_limit,
      allowed_mime_types: b.allowed_mime_types,
    })),
)

const { data: row } = await sb
  .from('quote_analyses')
  .select('id, status, company_id, source_pdf_path, created_at, updated_at')
  .eq('id', id)
  .maybeSingle()
console.log('analysis', row)

if (row?.company_id) {
  const prefix = `${row.company_id}/${row.id}`
  const { data: objs, error } = await sb.storage.from('orcamentos-ia').list(prefix, { limit: 50 })
  console.log('storage prefix', prefix, error?.message || objs)
}

const { data: listErr } = await sb.storage.from('orcamentos-ia').list('', { limit: 3 })
console.log('list root ok', Array.isArray(listErr), 'n', listErr?.length)
