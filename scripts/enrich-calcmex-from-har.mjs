import fs from 'node:fs'

const path = 'docs/evidence/captura_cortecloud-23574204-micro.har'
const h = JSON.parse(fs.readFileSync(path, 'utf8'))
for (const e of h.log.entries || []) {
  console.log(e.request.method, (e.request.url || '').split('?')[0])
  if (e.request?.headers) {
    e.request.headers = e.request.headers.filter(
      (x) => !/token|api-key|authorization|cookie/i.test(x.name || ''),
    )
  }
  if (e.response?.cookies) e.response.cookies = []
  if (e.response?.headers) {
    e.response.headers = e.response.headers.filter(
      (x) => !/set-cookie/i.test(x.name || ''),
    )
  }
}
fs.writeFileSync(path, JSON.stringify(h))

let parts = []
for (const e of h.log.entries || []) {
  if (!/parts\/list/.test(e.request?.url || '')) continue
  let t = e.response?.content?.text
  if (!t) continue
  if (e.response.content.encoding === 'base64') {
    t = Buffer.from(t, 'base64').toString('utf8')
  }
  try {
    const j = JSON.parse(t)
    parts = Array.isArray(j) ? j : j.resource || j.data || []
  } catch {
    /* ignore */
  }
}
const byFn = {}
for (const p of parts) {
  const fn = p.function || p.name || '?'
  byFn[fn] = (byFn[fn] || 0) + (Number(p.quantity) || 1)
}
const boards = [
  ...new Set(parts.map((p) => p.board || p.board_name || p.material).filter(Boolean)),
].slice(0, 20)
const calcmex = JSON.parse(fs.readFileSync('docs/evidence/resultado_calcmex.json', 'utf8'))
calcmex.parts_count = parts.length
calcmex.function_counts = byFn
calcmex.boards_sample = boards
calcmex.har_micro_entries = (h.log.entries || []).length
calcmex.exportedAt = new Date().toISOString()
fs.writeFileSync('docs/evidence/resultado_calcmex.json', JSON.stringify(calcmex, null, 2))
console.log('parts', parts.length, 'boards', boards)
