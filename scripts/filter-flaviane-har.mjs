/**
 * Filtra captura_flaviane.har para orçamento REA (<=32MB).
 * Uso: node scripts/filter-flaviane-har.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'captura_flaviane.har')
const OUT = path.join(ROOT, 'docs', 'evidence', 'captura_flaviane-filtered.har')
const PLAN = '23125828'

const KEEP =
  /api\.cortecloud\.com\.br|next\.cortecloud\.com\.br\/api\/core\/(boards|edges)|biblioteca\.hellomob\.com\.br\/(modulos|submodulos|definicoes)\.json/i
const INTERESTING =
  /parts|edges|materials|boards|edging|machining|functions|back_types|products|optimizations|Hellomob|thickening|service-parts|special_parts|23125828/i

const har = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const entries = (har.log?.entries || []).filter((e) => {
  const url = e.request?.url || ''
  if (!KEEP.test(url) && !new RegExp(PLAN).test(url)) return false
  if (/thumbnail|babylon|\.glb|\.gltf|\.jpg|\.png|\.jpeg|\.env/i.test(url)) return false
  return INTERESTING.test(url) || /\/services\/\d+$/.test(url.split('?')[0])
})

const MAX_BODY = 400_000
for (const e of entries) {
  const c = e.response?.content
  if (!c?.text) continue
  if (typeof c.text === 'string' && c.text.length > MAX_BODY) {
    c.text = c.text.slice(0, MAX_BODY)
    c.comment = 'truncated-for-rea-budget'
  }
}

const filtered = {
  log: {
    version: har.log?.version || '1.2',
    creator: { name: 'filter-flaviane-har', version: '1.0' },
    pages: har.log?.pages || [],
    entries,
  },
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(filtered))
const size = fs.statSync(OUT).size
console.log(`entries ${entries.length} -> ${OUT} (${size} bytes)`)
if (size > 33_554_432) {
  console.error('Still over REA budget')
  process.exit(1)
}
