/**
 * Gate Épico 3 — módulo caixa sem fundo → injeta fundo 6 mm Branco TX.
 * Espelha a lógica de enrichMinimalCaixariaClient (merge-extraction.ts).
 * Uso: node scripts/smoke-fundo-6mm.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
let failed = 0

function ok(cond, msg) {
  if (cond) console.log('OK', msg)
  else {
    console.error('FAIL', msg)
    failed++
  }
}

function normalizeExtractionKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const BOX_MODULE_RE =
  /ilha|balcao|bancada|armario|aereo|torre|cristaleira|gaveteiro|roupeiro|paneleiro|nicho|painel|mesa|prateleira|cozinhas|guarda.?roupa|cabeceira|criado|escrivaninha|home.?office|aparador|espelheira|porta/
const BOX_TYPOLOGY_RE =
  /ilha|balcao|bancada|armario|aereo|torre|cristaleira|gaveteiro|roupeiro|nicho|guarda.?roupa/

/** Espelho mínimo do enrich client (fundo 6 mm + tampo). */
function enrichMinimalCaixariaClient(mod) {
  const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
  const nameKey = normalizeExtractionKey(name)
  if (!BOX_MODULE_RE.test(nameKey)) return { ...mod, out_of_scope: false }

  const typology = typeof mod.typology === 'string' ? mod.typology : ''
  const needsBox =
    BOX_TYPOLOGY_RE.test(nameKey) || /^(balcao|aereo|armario_|nicho|gaveteiro)/.test(typology)
  if (!needsBox || /painel|porta\s+avulsa|vista\s+vertical|tamponamento/.test(nameKey)) {
    return { ...mod, out_of_scope: false }
  }

  const dims = mod.dimensions && typeof mod.dimensions === 'object' ? mod.dimensions : {}
  let caixaria = [...(Array.isArray(mod.caixaria) ? mod.caixaria : [])]
  const w = Number(dims.width_mm) > 0 ? Number(dims.width_mm) : 800
  const h = Number(dims.height_mm) > 0 ? Number(dims.height_mm) : 720
  const d = Number(dims.depth_mm) > 0 ? Number(dims.depth_mm) : 500
  const openFront = /ilha|bancada|mesa|prateleira/.test(nameKey)
  const mat = 'MDF Branco TX 15mm'
  const hasFn = (fn) => caixaria.some((c) => String(c.function || '') === fn)
  const lateralCount = caixaria.filter((c) => String(c.function || '') === 'lateral').length

  if (lateralCount === 0) {
    caixaria.push(
      { name: 'Lateral esquerda', function: 'lateral', thickness_mm: 15, material_name: mat, quantity: 1 },
      { name: 'Lateral direita', function: 'lateral', thickness_mm: 15, material_name: mat, quantity: 1 },
    )
  }
  if (!hasFn('base')) {
    caixaria.push({ name: 'Base', function: 'base', thickness_mm: 15, material_name: mat, quantity: 1 })
  }
  if (!hasFn('fundo') && !openFront) {
    caixaria.push({
      name: 'Fundo',
      function: 'fundo',
      thickness_mm: 6,
      material_name: 'MDF Branco TX 6mm',
      quantity: 1,
    })
  }
  const needsTampo =
    !openFront &&
    (/armario|aereo|gaveteiro|roupeiro|guarda.?roupa|torre|cristaleira/.test(nameKey) ||
      /^(armario_|aereo|gaveteiro)/.test(typology))
  if (needsTampo && !hasFn('tampo') && !hasFn('travessa')) {
    caixaria.push({ name: 'Tampo', function: 'tampo', thickness_mm: 15, material_name: mat, quantity: 1 })
  }
  return { ...mod, out_of_scope: false, caixaria, dimensions: { width_mm: w, height_mm: h, depth_mm: d } }
}

function ensureModulePlaceholder(mod) {
  return enrichMinimalCaixariaClient({ ...mod, out_of_scope: false })
}

// ── Evidência ──
const evidencePath = join(root, 'docs/evidence/hellomob-22168837-atomic-pieces.json')
ok(existsSync(evidencePath), 'evidência hellomob-22168837-atomic-pieces.json')
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
ok(evidence.hellomobId === '22168837', 'hellomobId 22168837')
ok(Array.isArray(evidence.modules_granulares) && evidence.modules_granulares.length >= 10, 'módulos granulares')
const fundoSample = (evidence.sample_pieces_from_lista || []).find(
  (p) => /fundo/i.test(p.function || '') && /6/.test(String(p.material || '')),
)
ok(!!fundoSample, 'sample Fundo 6 mm na evidência')

// ── Fonte alinhada ──
const mergeSrc = readFileSync(join(root, 'src/lib/orcamentos-ia/merge-extraction.ts'), 'utf8')
ok(mergeSrc.includes("material_name: 'MDF Branco TX 6mm'"), 'fonte: fundo Branco TX 6mm')
ok(mergeSrc.includes('needsTampo'), 'fonte: checklist tampo')
const edgeSrc = readFileSync(join(root, 'supabase/functions/orcamentos-ia-pipeline/index.ts'), 'utf8')
ok(edgeSrc.includes("material_name: 'MDF Branco TX 6mm'"), 'Edge: fundo 6mm')
ok(edgeSrc.includes('needsTampo'), 'Edge: tampo tipologias caixa')

// ── Runtime placeholder ──
const emptyBox = ensureModulePlaceholder({
  name: 'Armário 1 coluna 860x750x600',
  typology: 'armario_giro',
  dimensions: { width_mm: 860, height_mm: 750, depth_mm: 600 },
  caixaria: [],
  frentes_portas: [],
  ferragens: [],
})
const fundos = emptyBox.caixaria.filter((p) => p.function === 'fundo')
ok(fundos.length === 1, 'injeta exatamente 1 fundo')
ok(fundos[0].thickness_mm === 6, 'fundo thickness_mm === 6')
ok(/branco/i.test(fundos[0].material_name), 'fundo Branco TX')
ok(emptyBox.caixaria.filter((p) => p.function === 'lateral').length >= 2, 'laterais E+D')
ok(emptyBox.caixaria.some((p) => p.function === 'base'), 'base')
ok(emptyBox.caixaria.some((p) => p.function === 'tampo'), 'tampo')

const withFundo = ensureModulePlaceholder({
  name: 'Balcão 860x570x600',
  typology: 'balcao',
  dimensions: { width_mm: 860, height_mm: 570, depth_mm: 600 },
  caixaria: [
    {
      name: 'Fundo',
      function: 'fundo',
      thickness_mm: 6,
      material_name: 'MDF Branco TX 6mm',
      quantity: 1,
    },
  ],
})
ok(withFundo.caixaria.filter((p) => p.function === 'fundo').length === 1, 'não duplica fundo')

if (failed) {
  console.error(`FAILED ${failed}`)
  process.exit(1)
}
console.log('OK all fundo 6mm / HelloMob epic3 cases')
