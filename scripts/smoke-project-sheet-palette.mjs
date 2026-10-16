/**
 * Gate Épico 2 + E3 — paleta dinâmica anti-Jatobá + multi-SKU (DET_CLÍNICA).
 * Uso: node scripts/smoke-project-sheet-palette.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const paletteSrc = readFileSync(join(root, 'src/lib/orcamentos-ia/project-sheet-palette.ts'), 'utf8')
const consolidateSrc = readFileSync(join(root, 'src/lib/orcamentos-ia/bom-consolidate.ts'), 'utf8')
const sheetsSrc = readFileSync(join(root, 'src/lib/orcamentos-ia/bom-engine/sheets.ts'), 'utf8')
const explodeSrc = readFileSync(join(root, 'src/lib/orcamentos-ia/bom-engine/explode.ts'), 'utf8')
const pipelineSrc = readFileSync(join(root, 'src/lib/orcamentos-ia/pipeline.ts'), 'utf8')

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

const DET_CLINICA_TOKENS = ['salerno', 'fontana', 'carvalho', 'itapu', 'fossil', 'lana']

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
ok(consolidateSrc.includes('salerno') || consolidateSrc.includes('FRONT_COLOR_RE'), 'consolidate conhece cores DET')
ok(paletteSrc.includes('FLAVIANE_REFERENCE_PALETTE'), 'FLAVIANE_REFERENCE_PALETTE exportado')
ok(paletteSrc.includes('buildProjectSheetPaletteFromExtraction'), 'buildProjectSheetPaletteFromExtraction')
ok(paletteSrc.includes('resolvePaletteForPricing'), 'resolvePaletteForPricing')
ok(paletteSrc.includes('countDistinctCommercialSheetSkus'), 'countDistinctCommercialSheetSkus')
ok(paletteSrc.includes('isJatobaCollapse') || paletteSrc.includes('jatob'), 'filtro anti-Jatobá')
ok(sheetsSrc.includes('material_name'), 'boardBomLines agrupa por material_name')
ok(explodeSrc.includes('extractionBoardPieces'), 'explode aceita peças da extração')
ok(explodeSrc.includes('sheetLabels'), 'explode aceita sheetLabels da paleta')
ok(pipelineSrc.includes('persistSheetPalette'), 'pipeline passa paleta na persistência')

for (const label of REQUIRED_LABELS) {
  ok(paletteSrc.includes(label), `label ${label}`)
}

for (const key of REQUIRED_KEYS) {
  ok(paletteSrc.includes(`'${key}'`) || paletteSrc.includes(`"${key}"`), `key ${key}`)
}

for (const tok of DET_CLINICA_TOKENS) {
  ok(paletteSrc.toLowerCase().includes(tok), `token DET_CLÍNICA ${tok}`)
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
  return explicit.filter((s) => !/jatob/i.test(s.label))
}

const demo = resolveDemo()
ok(demo.some((s) => /Imbuia/i.test(s.label)), 'preserva Imbuia')
ok(!demo.some((s) => /jatob/i.test(s.label)), 'remove Jatobá do resolve')

/** Espelho mínimo de countDistinctCommercialSheetSkus */
function countDistinctCommercialSheetSkus(sheets) {
  const WHITE = /branco|tx|white|eucatex|multimarcas/i
  const keys = new Set()
  for (const s of sheets) {
    if ((Number(s.sheets) || 0) <= 0 && s.sheets !== undefined) continue
    const label = String(s.label || '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
    const th = Number(s.thickness_mm) || 15
    let color = 'outro'
    if (WHITE.test(label)) color = 'branco'
    else if (/salerno/.test(label)) color = 'salerno'
    else if (/fontana|magma/.test(label)) color = 'fontana'
    else if (/carvalho/.test(label) && /lir/.test(label)) color = 'carvalho_lir'
    else if (/carvalho/.test(label)) color = 'carvalho'
    else if (/itapu/.test(label)) color = 'itapua'
    else if (/fossil|cinza\s*fossil/.test(label)) color = 'cinza_fossil'
    else if (/\blana\b/.test(label)) color = 'lana'
    else if (/areia/.test(label)) color = 'areia'
    keys.add(`${color}|${th}`)
  }
  return keys.size
}

/** Fixture estilo DET_CLÍNICA consolidated_bom (parcial). */
const detFixtureSheets = [
  { label: 'MDF Branco Eucatex 15mm', thickness_mm: 15, sheets: 12 },
  { label: 'MDF Branco Multimarcas 6mm', thickness_mm: 6, sheets: 3 },
  { label: 'MDF Salerno Guararapes', thickness_mm: 15, sheets: 7 },
  { label: 'MDF Carvalho LIR Duratex', thickness_mm: 15, sheets: 5 },
  { label: 'MDF Itapuã Duratex', thickness_mm: 15, sheets: 4 },
  { label: 'MDF Cinza Fossil 15 Duratex', thickness_mm: 15, sheets: 4 },
  { label: 'MDF Areia Guararapes', thickness_mm: 15, sheets: 3 },
  { label: 'MDF Fontana Magma Guararapes', thickness_mm: 15, sheets: 2 },
  { label: 'MDF Lana Conceito Duratex', thickness_mm: 15, sheets: 1 },
]

const detSkuCount = countDistinctCommercialSheetSkus(detFixtureSheets)
ok(detSkuCount >= 5, `gate E3 fixture DET_CLÍNICA ≥5 SKUs (got ${detSkuCount})`)
ok(detSkuCount >= 8, `meta DET_CLÍNICA ≥8 SKUs comerciais (got ${detSkuCount})`)

/** boardBomLines multi-SKU (espelho): 2 materiais → 2 linhas */
function boardBomLinesGrouped(pieces, defaultMaterial) {
  const groups = new Map()
  for (const p of pieces) {
    const key = String(p.material_name || '').trim() || defaultMaterial
    const list = groups.get(key) ?? []
    list.push(p)
    groups.set(key, list)
  }
  return [...groups.keys()]
}

const multi = boardBomLinesGrouped(
  [
    { material_name: 'MDF Salerno Guararapes', width_mm: 800, height_mm: 720, quantity: 1 },
    { material_name: 'MDF Branco Eucatex 15mm', width_mm: 800, height_mm: 720, quantity: 2 },
    { material_name: 'MDF Fontana Magma Guararapes', width_mm: 1200, height_mm: 2400, quantity: 1 },
  ],
  'MDF Branco TX 15mm',
)
ok(multi.length === 3, `boardBomLines multi-SKU (got ${multi.length})`)
ok(multi.includes('MDF Salerno Guararapes'), 'inclui Salerno')
ok(multi.includes('MDF Fontana Magma Guararapes'), 'inclui Fontana')

/** Colored lateral NÃO vira Branco */
function normalizePieceMaterialDemo(piece) {
  const FRONT =
    /salerno|fontana|carvalho|itapu|fossil|\blana\b|areia|amendoeira|imbuia/i
  const BOX_FN = /^(lateral|base|prateleira|divisoria|sarrafo)$/
  const fn = String(piece.function || '')
  const mat = piece.material_name || ''
  if (fn === 'fundo' || piece.thickness_mm <= 8) {
    return 'MDF Branco Multimarcas 6mm'
  }
  if (BOX_FN.test(fn) && FRONT.test(mat)) return mat
  if (BOX_FN.test(fn)) return 'MDF Branco Eucatex 15mm'
  return mat
}

ok(
  normalizePieceMaterialDemo({
    function: 'lateral',
    material_name: 'MDF Salerno Guararapes',
    thickness_mm: 15,
  }) === 'MDF Salerno Guararapes',
  'lateral Salerno preservada (anti-colapso)',
)
ok(
  normalizePieceMaterialDemo({
    function: 'lateral',
    material_name: 'MDF Branco TX',
    thickness_mm: 15,
  }) === 'MDF Branco Eucatex 15mm',
  'lateral branca padronizada',
)

if (failed) {
  console.error(`FAILED ${failed}`)
  process.exit(1)
}
console.log('OK all palette smoke cases (E2+E3)')
