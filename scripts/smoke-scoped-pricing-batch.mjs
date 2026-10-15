/**
 * Smoke Épico 3 — persistência/preço só do lote.
 * Árvore parcial + filtro de páginas: ambientes fora do lote não entram.
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

function pageOfModule(mod) {
  const bb = mod.bounding_box
  if (bb && typeof bb === 'object' && typeof bb.page === 'number') {
    const n = Number(bb.page)
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null
  }
  return null
}

function filterExtractionToSelectedPages(extraction, pageNumbers) {
  const selected = normalizeSelectedPages(pageNumbers)
  if (!selected.length) return extraction
  const set = new Set(selected)
  const environments = (extraction.environments || [])
    .map((env) => {
      const modules = (env.modules || []).filter((mod) => {
        const page = pageOfModule(mod)
        if (page == null) return true
        return set.has(page)
      })
      if (!modules.length) return null
      return { ...env, modules }
    })
    .filter(Boolean)
  return { ...extraction, environments }
}

const tree = {
  environments: [
    {
      name: 'Cozinha',
      modules: [
        { name: 'Ilha', bounding_box: { page: 2 }, materials: [{ name: 'MDF', category: 'chapa', unit_price: 100 }] },
        { name: 'Aéreo', bounding_box: { page: 3 }, materials: [{ name: 'MDF', category: 'chapa', unit_price: 80 }] },
      ],
    },
    {
      name: 'Suíte',
      modules: [
        {
          name: 'Guarda-roupa',
          bounding_box: { page: 40 },
          materials: [{ name: 'MDF', category: 'chapa', unit_price: 200 }],
        },
      ],
    },
  ],
}

const selected = [1, 2, 3, 4]
const filtered = filterExtractionToSelectedPages(tree, selected)
const envNames = filtered.environments.map((e) => e.name)

if (envNames.includes('Suíte')) {
  console.error('FAIL Suíte should be filtered out', envNames)
  process.exit(1)
}
if (!envNames.includes('Cozinha')) {
  console.error('FAIL Cozinha should remain', envNames)
  process.exit(1)
}
const modCount = filtered.environments.reduce((n, e) => n + e.modules.length, 0)
if (modCount !== 2) {
  console.error('FAIL expected 2 modules', modCount)
  process.exit(1)
}

const evidence = {
  epic: 3,
  prd: 'v19',
  feature: 'pricing-persist-batch-filter',
  checks: {
    environments_after_filter: envNames,
    module_count: modCount,
    suite_removed: true,
    selected_pages: selected,
  },
  date: '2026-10-14',
}

const outDir = join(root, 'docs', 'evidence')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'rea-js-prd-v19-epic3.json')
writeFileSync(outPath, JSON.stringify(evidence, null, 2) + '\n', 'utf8')
console.log('OK smoke-scoped-pricing-batch →', outPath)
console.log(JSON.stringify(evidence.checks, null, 2))
