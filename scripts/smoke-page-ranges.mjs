/**
 * Smoke Épico 1 — parse de intervalos de páginas ("1-5, 8, 12-20").
 * Espelha a lógica de src/lib/orcamentos-ia/page-ranges.ts
 */
function allPages(totalPages) {
  const n = Math.floor(totalPages)
  if (!Number.isFinite(n) || n < 1) return []
  return Array.from({ length: n }, (_, i) => i + 1)
}

function formatPageRanges(pages) {
  if (!pages.length) return ''
  const sorted = [...new Set(pages.filter((p) => Number.isInteger(p) && p > 0))].sort(
    (a, b) => a - b,
  )
  const chunks = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i]
    if (cur === prev + 1) {
      prev = cur
      continue
    }
    chunks.push(start === prev ? String(start) : `${start}-${prev}`)
    if (cur != null) {
      start = cur
      prev = cur
    }
  }
  return chunks.join(', ')
}

function parsePageRangeInput(text, totalPages) {
  const total = Math.floor(totalPages)
  if (!Number.isFinite(total) || total < 1) {
    return { ok: false, error: 'Número total de páginas inválido.' }
  }
  const raw = String(text || '').trim()
  if (!raw) return { ok: false, error: 'vazio' }
  const selected = new Set()
  const parts = raw.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean)
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*[-–—]\s*(\d+)$/)
    if (rangeMatch) {
      let from = Number(rangeMatch[1])
      let to = Number(rangeMatch[2])
      if (from > to) [from, to] = [to, from]
      if (from < 1 || to > total) return { ok: false, error: `fora: ${part}` }
      for (let p = from; p <= to; p++) selected.add(p)
      continue
    }
    if (!/^\d+$/.test(part)) return { ok: false, error: `bad: ${part}` }
    const page = Number(part)
    if (page < 1 || page > total) return { ok: false, error: `page ${page}` }
    selected.add(page)
  }
  const pages = [...selected].sort((a, b) => a - b)
  return { ok: true, pages, label: formatPageRanges(pages) }
}

const parsed = parsePageRangeInput('1-5, 8, 12-20', 20)
if (!parsed.ok) {
  console.error('FAIL parse', parsed)
  process.exit(1)
}
const expected = [1, 2, 3, 4, 5, 8, 12, 13, 14, 15, 16, 17, 18, 19, 20]
if (JSON.stringify(parsed.pages) !== JSON.stringify(expected)) {
  console.error('FAIL pages', parsed.pages, 'expected', expected)
  process.exit(1)
}
if (parsed.label !== '1-5, 8, 12-20') {
  console.error('FAIL label', parsed.label)
  process.exit(1)
}

const outOfRange = parsePageRangeInput('1-5, 99', 20)
if (outOfRange.ok) {
  console.error('FAIL should reject page 99')
  process.exit(1)
}

const all = allPages(3)
if (JSON.stringify(all) !== JSON.stringify([1, 2, 3])) {
  console.error('FAIL allPages', all)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      pages: parsed.pages,
      label: parsed.label,
      selectedCount: parsed.pages.length,
      outOfRangeRejected: !outOfRange.ok,
    },
    null,
    2,
  ),
)
console.log('OK smoke-page-ranges')
