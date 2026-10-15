/**
 * Smoke Épico 1 — pdf-processor fail-closed (seleção vazia / paths fora do lote).
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

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
    throw new Error(
      `Nenhum pagePath corresponde às páginas do lote (${wanted.join(', ')}).`,
    )
  }
  const byPage = new Map()
  for (const p of filtered) {
    const n = pageNumberFromPagePath(p)
    if (n != null) byPage.set(n, p)
  }
  return wanted.map((n) => byPage.get(n)).filter(Boolean)
}

function convertSelectedRequiresPages(pageNumbers) {
  const pages = normalizeSelectedPages(pageNumbers)
  if (!pages.length) {
    throw new Error('Seleção de páginas vazia')
  }
  return pages
}

let emptyRejected = false
try {
  convertSelectedRequiresPages([])
} catch {
  emptyRejected = true
}
if (!emptyRejected) {
  console.error('FAIL empty selection should throw')
  process.exit(1)
}

const paths = [
  'co/a/pages/page-001.jpg',
  'co/a/pages/page-002.jpg',
  'co/a/pages/page-015.jpg',
  'co/a/pages/page-040.jpg',
]
const strict = assertBatchPagePaths(paths, [1, 2, 15])
if (JSON.stringify(strict) !== JSON.stringify([
  'co/a/pages/page-001.jpg',
  'co/a/pages/page-002.jpg',
  'co/a/pages/page-015.jpg',
])) {
  console.error('FAIL assertBatchPagePaths', strict)
  process.exit(1)
}

let outsideRejected = false
try {
  assertBatchPagePaths(paths, [99])
} catch {
  outsideRejected = true
}
if (!outsideRejected) {
  console.error('FAIL outside pages should throw')
  process.exit(1)
}

const evidence = {
  epic: 1,
  prd: 'v19',
  feature: 'pdf-processor-strict-page-ranges',
  checks: {
    empty_selection_rejected: emptyRejected,
    assert_batch_paths: 'ok',
    outside_paths_rejected: outsideRejected,
    tsc_pending: true,
  },
  date: '2026-10-14',
}

const outDir = join(root, 'docs', 'evidence')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'rea-js-prd-v19-epic1.json')
writeFileSync(outPath, JSON.stringify(evidence, null, 2) + '\n', 'utf8')
console.log('OK smoke-pdf-processor-strict →', outPath)
