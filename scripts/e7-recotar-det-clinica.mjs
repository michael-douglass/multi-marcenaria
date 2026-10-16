/**
 * E7 — Reaplica E3–E6 na extração salva da DET_CLÍNICA, exporta evidência,
 * compara com Cortecloud e (opcional) dispara fromScratch.
 *
 * Uso:
 *   node --env-file=.env scripts/e7-recotar-det-clinica.mjs
 *   node --env-file=.env scripts/e7-recotar-det-clinica.mjs --from-scratch
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'vite'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ANALYSIS_ID = process.argv.find((a) => /^[0-9a-f-]{36}$/i.test(a)) ||
  '8f507c97-dd86-44ad-858b-090ad4ce8ef2'
const COMPANY_ID = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'
const FROM_SCRATCH = process.argv.includes('--from-scratch')
const OUT = path.join(ROOT, 'docs/evidence/nosso_resultado_det_clinica_8f507c97.json')
const PARITY_OUT = path.join(ROOT, 'docs/evidence/parity-report-23496206.json')
const CC_PATH = path.join(ROOT, 'docs/evidence/resultado_cortecloud_23496206.json')

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const vite = await createServer({
  configFile: false,
  resolve: { alias: { '@': path.join(ROOT, 'src') } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

const { rebalanceEnvironments } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/rebalance.ts')
const { consolidateExtractionForPricing } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/bom-consolidate.ts',
)
const { countDistinctCommercialSheetSkus } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/project-sheet-palette.ts',
)
const { sumCorredicaPairs, countModuleDrawers } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/drawer-slides.ts',
)
const { explodeModuleForPersist } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/bom-persist.ts')

console.log('=== E7 DET_CLÍNICA', ANALYSIS_ID, FROM_SCRATCH ? '(fromScratch)' : '(offline consolidate)' , '===')

const { data: analysis, error } = await admin
  .from('quote_analyses')
  .select('id, company_id, status, totals, pricing_modality, updated_at')
  .eq('id', ANALYSIS_ID)
  .single()
if (error) throw new Error(error.message)

const totals =
  analysis.totals && typeof analysis.totals === 'object' ? { ...analysis.totals } : {}
const raw = totals.last_extraction
if (!raw || typeof raw !== 'object') {
  console.error('Sem last_extraction — rode fromScratch na UI ou com --from-scratch')
  process.exit(1)
}

const inventory = Array.isArray(totals.inventory) ? totals.inventory : []
const rebalanced = rebalanceEnvironments(raw, inventory)
const { extraction, consolidatedBom, projectSheetPalette } =
  consolidateExtractionForPricing(rebalanced)

const envs = extraction.environments || []
const modules = envs.flatMap((e) =>
  (e.modules || []).map((m) => ({
    env: e.name,
    name: m.name,
    typology: m.typology,
    out_of_scope: m.out_of_scope === true,
    dims: m.dimensions || null,
    drawers: countModuleDrawers(m),
    materials:
      (m.caixaria?.length || 0) +
      (m.frentes_portas?.length || 0) +
      (m.ferragens?.length || 0),
  })),
)
const inScope = modules.filter((m) => !m.out_of_scope)
const phantomEnvs = envs.filter((e) => /quarto|banheiro/i.test(e.name || '')).map((e) => e.name)

let corredica = 0
let drawerMods = 0
for (const env of envs) {
  for (const mod of env.modules || []) {
    if (mod.out_of_scope) continue
    const d = countModuleDrawers(mod)
    if (d > 0) drawerMods += 1
    corredica += sumCorredicaPairs(mod.ferragens || [])
  }
}

// BOM fabril explode (amostra) — soma corrediças do desmonte
let bomSlidePairs = 0
const boardSamples = []
for (const env of envs) {
  for (const mod of env.modules || []) {
    if (mod.out_of_scope) continue
    const exploded = explodeModuleForPersist(mod, null, env.name, projectSheetPalette)
    for (const line of exploded.bom) {
      if (line.item_category === 'board') {
        if (boardSamples.length < 12) {
          boardSamples.push({ d: line.item_description, q: line.quantity })
        }
      }
      if (line.item_category === 'hardware' && /corredic/i.test(line.item_description)) {
        bomSlidePairs += Number(line.quantity) || 0
      }
    }
  }
}

const sheetsByColor = {}
for (const s of consolidatedBom.sheets || []) {
  const label = String(s.label || '')
  const th = Number(s.thickness_mm) || 15
  let color = 'Outro'
  const n = label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  if (/branco/.test(n)) color = 'Branco'
  else if (/salerno/.test(n)) color = 'Salerno'
  else if (/fontana|magma/.test(n)) color = 'Fontana'
  else if (/carvalho/.test(n) && /lir/.test(n)) color = 'Carvalho LIR'
  else if (/carvalho/.test(n)) color = 'Carvalho'
  else if (/itapu/.test(n)) color = 'Itapua'
  else if (/fossil/.test(n)) color = 'Cinza Fossil'
  else if (/\blana\b/.test(n)) color = 'Lana'
  else if (/areia/.test(n)) color = 'Areia'
  else if (/freij/.test(n)) color = 'Freijo'
  const key = `${color} ${th}mm`
  sheetsByColor[key] = (sheetsByColor[key] || 0) + (Number(s.sheets) || 0)
}
const sheetsTotal = Object.values(sheetsByColor).reduce((a, b) => a + b, 0)
const skuCount = countDistinctCommercialSheetSkus(consolidatedBom.sheets || [])

const hwAgg = {}
for (const h of consolidatedBom.hardware || []) {
  hwAgg[h.canonicalName] = (hwAgg[h.canonicalName] || 0) + h.quantity
}

const out = {
  source: 'corte-claude-e7-offline',
  analysis_id: ANALYSIS_ID,
  exported_at: new Date().toISOString(),
  status: analysis.status,
  note:
    'Pós E3–E6 aplicados em last_extraction (rebalance + consolidate + drawer slides). Modularização E5 completa exige --from-scratch / UI.',
  modules_in_scope: inScope.length,
  modules_out_of_scope: modules.length - inScope.length,
  in_scope: inScope,
  phantom_envs_remaining: phantomEnvs,
  materials_count: totals.materials_count ?? null,
  bom_items_count: totals.bom_items_count ?? null,
  sheets_priced_ui: { ...sheetsByColor, total: sheetsTotal },
  sheets_by_color_mm: sheetsByColor,
  hardware_aggregated: hwAgg,
  hardware_totals: {
    dobradica: Object.entries(hwAgg)
      .filter(([k]) => /dobradic/i.test(k))
      .reduce((s, [, q]) => s + q, 0),
    corredica: Math.max(corredica, bomSlidePairs),
    puxador: Object.entries(hwAgg)
      .filter(([k]) => /puxador/i.test(k))
      .reduce((s, [, q]) => s + q, 0),
  },
  drawer_modules: drawerMods,
  corredica_pairs_extraction: corredica,
  corredica_pairs_explode: bomSlidePairs,
  commercial_sheet_skus: skuCount,
  project_sheet_palette: projectSheetPalette.map((s) => ({
    label: s.label,
    thickness_mm: s.thickness_mm,
    role: s.role,
  })),
  consolidated_bom: consolidatedBom,
  bom_board_samples: boardSamples,
  materials_cost: totals.materials_cost ?? null,
  sale_price: totals.sale_price ?? null,
  batch_label: totals.batch_label ?? null,
  e7_gates: {
    e3_skus_ge_5: skuCount >= 5,
    e4_corredica_gt_0: Math.max(corredica, bomSlidePairs) > 0,
    e5_modules_ge_70: inScope.length >= 70,
    e6_no_phantom_bedroom: phantomEnvs.length === 0,
  },
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
console.log('Export:', OUT)
console.log('Gates E7 offline:', out.e7_gates)
console.log({
  modules: inScope.length,
  skus: skuCount,
  corredica: out.hardware_totals.corredica,
  phantom: phantomEnvs,
  sheetsTotal,
})

// Persiste árvore consolidada no totals (sem apagar ambientes ainda — fromScratch faz isso)
const nextTotals = {
  ...totals,
  last_extraction: extraction,
  consolidated_bom: consolidatedBom,
  project_sheet_palette: out.project_sheet_palette,
  e7_offline_at: out.exported_at,
  e7_gates: out.e7_gates,
}
const { error: upErr } = await admin
  .from('quote_analyses')
  .update({ totals: nextTotals })
  .eq('id', ANALYSIS_ID)
if (upErr) console.warn('aviso update totals:', upErr.message)
else console.log('totals.last_extraction atualizado com E3–E6')

// Parity vs Cortecloud (sem carregar pipeline.ts — pdfjs quebra no Node sem DOMMatrix)
if (fs.existsSync(CC_PATH)) {
  const cc = JSON.parse(fs.readFileSync(CC_PATH, 'utf8'))
  const parity = {
    compared_at: new Date().toISOString(),
    target_a: CC_PATH,
    target_b: OUT,
    cortecloud: {
      plan_id: cc.plan_id || 23496206,
      modules: cc.modules_count || cc.hellomob_modules || 139,
      sheets_skus: (cc.sheets || []).length,
      sheets_total: cc.sheets_total,
    },
    nosso: {
      analysis_id: ANALYSIS_ID,
      modules_in_scope: inScope.length,
      commercial_sheet_skus: skuCount,
      corredica: out.hardware_totals.corredica,
      sheets_total: sheetsTotal,
      phantom_envs: phantomEnvs,
    },
    gates: out.e7_gates,
    note: 'Offline pós E3–E6; E5 ≥70 módulos requer fromScratch LLM na UI.',
  }
  fs.writeFileSync(PARITY_OUT, JSON.stringify(parity, null, 2))
  console.log('Parity:', PARITY_OUT)
}

if (FROM_SCRATCH) {
  console.log(
    'fromScratch: use a UI "Recomeçar do zero" em /orcamentos-ia?audit=' +
      ANALYSIS_ID +
      ' (pipeline SSR precisa DOMMatrix/browser).',
  )
} else {
  console.log(
    'Dica E5 completa: abra o audit e clique "Recomeçar do zero".\n' +
      `  /orcamentos-ia?audit=${ANALYSIS_ID}`,
  )
}

await vite.close()
console.log('=== E7 offline OK ===')
