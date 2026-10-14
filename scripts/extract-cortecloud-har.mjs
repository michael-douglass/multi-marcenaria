/**
 * Extrai amostras redigidas de caixaria/fitas/preços do HAR Cortecloud.
 * Uso: node scripts/extract-cortecloud-har.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HAR_PATH = path.join(ROOT, 'captura_cortecloud.har')
const OUT_PATH = path.join(ROOT, 'docs', 'evidence', '_cortecloud-har-extract.json')

const h = JSON.parse(fs.readFileSync(HAR_PATH, 'utf8'))
const entries = h.log?.entries || []

function parseBody(e) {
  const t = e?.response?.content?.text
  if (!t) return null
  let s = t
  if (e.response.content.encoding === 'base64') {
    s = Buffer.from(t, 'base64').toString('utf8')
  }
  try {
    return JSON.parse(s)
  } catch {
    return typeof s === 'string' ? s.slice(0, 800) : null
  }
}

function redactDeep(value, depth = 0) {
  if (depth > 8) return '[truncated]'
  if (Array.isArray(value)) return value.slice(0, 5).map((v) => redactDeep(v, depth + 1))
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 240) return `${value.slice(0, 240)}…`
    return value
  }
  const out = {}
  for (const [k, v] of Object.entries(value)) {
    if (/api_key|token|authorization|password|email|phone|cpf|cnpj|secret/i.test(k)) {
      out[k] = '[REDACTED]'
      continue
    }
    out[k] = redactDeep(v, depth + 1)
  }
  return out
}

function summarize(body) {
  if (Array.isArray(body)) {
    return {
      kind: 'array',
      len: body.length,
      itemKeys: body[0] && typeof body[0] === 'object' ? Object.keys(body[0]).slice(0, 80) : [],
      sample: redactDeep(body.slice(0, 2)),
    }
  }
  if (body && typeof body === 'object') {
    for (const k of Object.keys(body)) {
      if (Array.isArray(body[k]) && body[k].length) {
        return {
          kind: 'object-with-array',
          keys: Object.keys(body).slice(0, 40),
          arrayKey: k,
          len: body[k].length,
          itemKeys: body[k][0] && typeof body[k][0] === 'object' ? Object.keys(body[k][0]).slice(0, 80) : [],
          sample: redactDeep(body[k].slice(0, 2)),
          rootSample: redactDeep(
            Object.fromEntries(
              Object.entries(body)
                .filter(([, v]) => !Array.isArray(v))
                .slice(0, 20),
            ),
          ),
        }
      }
    }
    return { kind: 'object', keys: Object.keys(body).slice(0, 60), sample: redactDeep(body) }
  }
  return { kind: typeof body, sample: body }
}

const targets = [
  ['parts_list', (e) => /\/services\/23516165\/parts\/list/.test(e.request.url) && e.request.method === 'GET'],
  ['parts_post', (e) => /\/services\/23516165\/parts(?:\?|$)/.test(e.request.url) && e.request.method === 'POST'],
  ['edges_svc', (e) => /\/services\/23516165\/edges/.test(e.request.url) && e.request.method === 'GET'],
  ['materials', (e) => /\/optimizations\/services\/23516165\/materials/.test(e.request.url)],
  ['edging_rules', (e) => /\/edging_machines\/\d+\/rules/.test(e.request.url)],
  ['service_get', (e) => /\/api-servicos-carpenter\/services\/23516165(?:\?|$)/.test(e.request.url) && e.request.method === 'GET'],
  ['products', (e) => /\/services\/23516165\/products/.test(e.request.url)],
  ['core_edges', (e) => /\/api\/core\/edges\/companies\//.test(e.request.url)],
  ['core_boards', (e) => /\/api\/core\/boards\/companies\//.test(e.request.url)],
  ['functions_list', (e) => /\/companies\/\d+\/functions\/list/.test(e.request.url)],
  ['back_types', (e) => /\/back_types\/list/.test(e.request.url)],
]

const out = { serviceIds: [23516165, 23478274, 20008680], extractedAt: new Date().toISOString() }
for (const [name, pred] of targets) {
  const matches = entries.filter((e) => pred(e) && e.response?.content?.text)
  const e = matches.sort((a, b) => (b.response.content.size || 0) - (a.response.content.size || 0))[0]
  if (!e) {
    out[name] = { found: false }
    continue
  }
  const body = parseBody(e)
  out[name] = {
    found: true,
    status: e.response.status,
    url: e.request.url.split('?')[0],
    size: e.response.content.size || 0,
    ...summarize(body),
  }
}

// Scan first part item for edge banding field names
const partSample = out.parts_list?.sample?.[0] || out.parts_post?.sample?.[0]
if (partSample && typeof partSample === 'object') {
  const edgeish = Object.keys(partSample).filter((k) =>
    /edge|fita|c1|c2|l1|l2|banding|borda|tape|cant/i.test(k),
  )
  out.edgeFieldHints = edgeish
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2))
console.log('Wrote', OUT_PATH)
for (const [k, v] of Object.entries(out)) {
  if (k === 'serviceIds' || k === 'extractedAt' || k === 'edgeFieldHints') continue
  console.log(
    k,
    v.found ? `OK len=${v.len ?? '-'} keys=${(v.itemKeys || []).slice(0, 12).join('|')}` : 'missing',
  )
}
console.log('edgeFieldHints', out.edgeFieldHints)
