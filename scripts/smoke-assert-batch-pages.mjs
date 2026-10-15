/**
 * Smoke — assertBatchPagePaths exige lote completo (não segue com subconjunto).
 * Espelha src/lib/orcamentos-ia/pdf-processor.ts
 */
function normalizeSelectedPages(pageNumbers) {
  if (!Array.isArray(pageNumbers)) return []
  return [
    ...new Set(
      pageNumbers.filter(
        (p) => typeof p === 'number' && Number.isInteger(p) && p > 0,
      ),
    ),
  ].sort((a, b) => a - b)
}

function pageNumberFromPagePath(pathOrName) {
  const base = pathOrName.split('/').pop() || pathOrName
  const m = base.match(/page-(\d+)\.(?:png|jpe?g|webp)$/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 1 ? n : null
}

function assertBatchPagePaths(pagePaths, pageNumbers) {
  const wanted = normalizeSelectedPages(pageNumbers)
  if (!wanted.length) return [...pagePaths]
  const set = new Set(wanted)
  const filtered = pagePaths.filter((p) => {
    const n = pageNumberFromPagePath(p)
    return n != null && set.has(n)
  })
  if (!filtered.length) {
    throw new Error('nenhum path')
  }
  const byPage = new Map()
  for (const p of filtered) {
    const n = pageNumberFromPagePath(p)
    if (n != null) byPage.set(n, p)
  }
  const missing = wanted.filter((n) => !byPage.has(n))
  if (missing.length) {
    throw new Error(`faltam ${missing.join(',')}`)
  }
  return wanted.map((n) => byPage.get(n))
}

const wanted = [4, 5, 7, 9, 10]
const partial = [
  'co/quote-projects/p/pages/page-004.jpg',
  'co/quote-projects/p/pages/page-005.jpg',
]

let threw = false
try {
  assertBatchPagePaths(partial, wanted)
} catch (e) {
  threw = /faltam/.test(String(e.message))
}
if (!threw) {
  console.error('FAIL: deveria recusar lote incompleto 2/5')
  process.exit(1)
}

const full = wanted.map(
  (n) => `co/quote-projects/p/pages/page-${String(n).padStart(3, '0')}.jpg`,
)
const ok = assertBatchPagePaths(full, wanted)
if (ok.length !== 5) {
  console.error('FAIL: lote completo deveria passar', ok)
  process.exit(1)
}

console.log('OK smoke-assert-batch-pages')
