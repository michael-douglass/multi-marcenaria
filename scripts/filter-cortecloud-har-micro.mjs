/**
 * HAR micro (só peças/fitas/regras/materiais de um serviço) para REA <32MB/heap.
 *
 * Uso:
 *   node scripts/filter-cortecloud-har-micro.mjs
 *   node scripts/filter-cortecloud-har-micro.mjs --service 23574204
 *   CORTECLOUD_SERVICE_ID=23574204 node scripts/filter-cortecloud-har-micro.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'captura_cortecloud.har')

function resolveServiceId() {
  const argIdx = process.argv.indexOf('--service')
  if (argIdx >= 0 && process.argv[argIdx + 1]) return String(process.argv[argIdx + 1])
  return process.env.CORTECLOUD_SERVICE_ID || '23574204'
}

const SERVICE_ID = resolveServiceId()
const OUT = path.join(ROOT, 'docs', 'evidence', `captura_cortecloud-${SERVICE_ID}-micro.har`)
// Compat: também grava o path legado quando for o default histórico
const OUT_LEGACY =
  SERVICE_ID === '23516165'
    ? path.join(ROOT, 'docs', 'evidence', 'captura_cortecloud-micro.har')
    : null

const PATTERNS = [
  new RegExp(`/services/${SERVICE_ID}/parts/list`),
  new RegExp(`/services/${SERVICE_ID}/edges(?:\\?|$)`),
  new RegExp(`/optimizations/services/${SERVICE_ID}/materials`),
  /\/edging_machines\/\d+\/rules/,
  /\/companies\/\d+\/functions\/list/,
  new RegExp(`/api-servicos-carpenter/services/${SERVICE_ID}(?:\\?|$)`),
  new RegExp(`/plans/${SERVICE_ID}`),
  new RegExp(`service[_-]?id[=:]${SERVICE_ID}`, 'i'),
]

if (!fs.existsSync(SRC)) {
  console.error(`HAR não encontrado: ${SRC}`)
  process.exit(1)
}

const har = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const seen = new Set()
const entries = []
for (const e of har.log?.entries || []) {
  const url = e.request?.url || ''
  if (!PATTERNS.some((p) => p.test(url))) continue
  const key = `${e.request.method} ${url.split('?')[0]}`
  if (seen.has(key)) continue
  seen.add(key)
  entries.push(e)
}

const filtered = {
  log: {
    version: '1.2',
    creator: { name: 'filter-cortecloud-har-micro', version: '1.1' },
    entries,
  },
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(filtered))
console.log(`service=${SERVICE_ID} entries=${entries.length} bytes=${fs.statSync(OUT).size} -> ${OUT}`)
if (OUT_LEGACY) {
  fs.writeFileSync(OUT_LEGACY, JSON.stringify(filtered))
  console.log(`also -> ${OUT_LEGACY}`)
}
if (entries.length === 0) {
  console.warn(
    `AVISO: nenhuma entrada para serviço ${SERVICE_ID}. Rode a captura com o plano aberto e tente de novo.`,
  )
  process.exitCode = 2
}
