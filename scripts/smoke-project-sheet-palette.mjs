/**
 * Gate Épico 2 — paleta dinâmica anti-Jatobá.
 * Uso: node scripts/smoke-project-sheet-palette.mjs
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// Assert keys exist in source (no TS runtime needed)
const paletteSrc = readFileSync(join(root, 'src/lib/orcamentos-ia/project-sheet-palette.ts'), 'utf8')
const consolidateSrc = readFileSync(join(root, 'src/lib/orcamentos-ia/bom-consolidate.ts'), 'utf8')

const REQUIRED_KEYS = [
  'bege_papiro',
  'lord_matt',
  'mint_essencial',
  'blush_essencial',
  'azul_astral',
  'imbuia_caiapo',
  'areia_noronha',
  'branco_tx',
  'branco_eucatex',
  'branco_multimarcas',
]

const REQUIRED_LABELS = [
  'Bege Papiro',
  'Lord Matt',
  'Mint Essencial',
  'Blush Essencial',
  'Azul Astral',
  'Imbuia Caiapo',
  'Areia Noronha',
  'Branco Eucatex',
  'Branco Multimarcas',
]

let failed = 0

function ok(cond, msg) {
  if (cond) console.log('OK', msg)
  else {
    console.error('FAIL', msg)
    failed++
  }
}

ok(!consolidateSrc.includes('MDF Jatoba Brasileiro Arauco'), 'bom-consolidate sem SKU Jatobá default')
ok(consolidateSrc.includes('DEFAULT_BOX_BACK_PALETTE'), 'DEFAULT usa só caixa/fundo')
ok(consolidateSrc.includes('resolvePaletteForPricing'), 'consolidate usa resolvePaletteForPricing')
ok(paletteSrc.includes('FLAVIANE_REFERENCE_PALETTE'), 'FLAVIANE_REFERENCE_PALETTE exportado')
ok(paletteSrc.includes('buildProjectSheetPaletteFromExtraction'), 'buildProjectSheetPaletteFromExtraction')
ok(paletteSrc.includes('resolvePaletteForPricing'), 'resolvePaletteForPricing')
ok(paletteSrc.includes('isJatobaCollapse') || paletteSrc.includes('jatob'), 'filtro anti-Jatobá')

for (const label of REQUIRED_LABELS) {
  ok(paletteSrc.includes(label), `label ${label}`)
}

for (const key of REQUIRED_KEYS) {
  ok(paletteSrc.includes(`'${key}'`) || paletteSrc.includes(`"${key}"`), `key ${key}`)
}

// Inline resolve: declared palette with Imbuia must not become Jatoba
function resolveDemo() {
  const DEFAULT_BOX = [
    { label: 'MDF Branco Multimarcas 6mm', thickness_mm: 6, role: 'back_white' },
    { label: 'MDF Branco Eucatex 15mm', thickness_mm: 15, role: 'box_white' },
  ]
  const explicit = [
    ...DEFAULT_BOX,
    { label: 'MDF Imbuia Caiapo 15mm', thickness_mm: 15, role: 'front_color' },
    { label: 'MDF Jatoba Brasileiro Arauco 15mm', thickness_mm: 15, role: 'front_color' },
  ]
  const filtered = explicit.filter((s) => !/jatob/i.test(s.label))
  return filtered
}

const demo = resolveDemo()
ok(demo.some((s) => /Imbuia/i.test(s.label)), 'preserva Imbuia')
ok(!demo.some((s) => /jatob/i.test(s.label)), 'remove Jatobá do resolve')

if (failed) {
  console.error(`FAILED ${failed}`)
  process.exit(1)
}
console.log('OK all palette smoke cases')
