/**
 * Exporta docs/evidence/nosso_resultado.json da análise ELITON pós-deploy.
 * Uso: node --env-file=.env scripts/export-eliton-nosso-resultado.mjs [analysisId]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ANALYSIS_ID = process.argv[2] || '93805427-e80e-4f47-a0cd-e09be2b8b161'
const OUT = path.resolve('docs/evidence/nosso_resultado.json')
const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const admin = createClient(url, key, { auth: { persistSession: false } })

const { data: analysis, error } = await admin
  .from('quote_analyses')
  .select('id, status, mode, pricing_modality, pricing_params, totals, source_pdf_path, created_at, updated_at')
  .eq('id', ANALYSIS_ID)
  .single()
if (error) throw new Error(error.message)

const { data: envs } = await admin
  .from('quote_environments')
  .select('id, name, sort_order')
  .eq('analysis_id', ANALYSIS_ID)
  .order('sort_order')

const envIds = (envs || []).map((e) => e.id)
const { data: modules } = await admin
  .from('quote_modules')
  .select('id, name, environment_id, out_of_scope, dimensions')
  .in('environment_id', envIds)

const modIds = (modules || []).map((m) => m.id)
const { data: materials } = await admin
  .from('quote_materials')
  .select(
    'id, module_id, raw_name, category, unit_price, exact_quantity, unit_measure, notes, using_market_price',
  )
  .in('module_id', modIds)

const { data: bom } = await admin
  .from('bom_items')
  .select('item_category, item_description, quantity, unit_cost, total_cost')
  .eq('project_id', ANALYSIS_ID)

const CUT = 'corte-peca'
const billableZeros = (materials || []).filter(
  (m) =>
    !(Number(m.unit_price) > 0) &&
    !(m.notes || '').includes(CUT) &&
    ['chapa', 'fita_borda', 'ferragem', 'puxador', 'consumivel'].includes(m.category),
)
const cuttingZeros = (materials || []).filter(
  (m) => !(Number(m.unit_price) > 0) && (m.notes || '').includes(CUT),
)

const payload = {
  source: 'corte-claude',
  analysisId: ANALYSIS_ID,
  exportedAt: new Date().toISOString(),
  status: analysis.status,
  pricing_modality: analysis.pricing_modality,
  totals: {
    sale_price: analysis.totals?.sale_price ?? null,
    materials_cost: analysis.totals?.materials_cost ?? null,
    mpc_margin_pct: analysis.totals?.mpc_margin_pct ?? null,
    modules: analysis.totals?.modules,
    materials_count: analysis.totals?.materials_count,
    bom_items_count: analysis.totals?.bom_items_count,
    coverage: analysis.totals?.coverage ?? null,
  },
  modules: (modules || []).map((m) => ({
    name: m.name,
    env: (envs || []).find((e) => e.id === m.environment_id)?.name,
    dimensions: m.dimensions,
    out_of_scope: m.out_of_scope,
    materials: (materials || [])
      .filter((mat) => mat.module_id === m.id)
      .map((mat) => ({
        raw_name: mat.raw_name,
        category: mat.category,
        qty: mat.exact_quantity,
        unit: mat.unit_measure,
        unit_price: mat.unit_price,
        cutting_list: (mat.notes || '').includes(CUT),
      })),
  })),
  bom_summary: {
    n: (bom || []).length,
    total: (bom || []).reduce((s, b) => s + (Number(b.total_cost) || 0), 0),
  },
  zeros: {
    billable: billableZeros.length,
    cutting_list: cuttingZeros.length,
    all_zero_price: (materials || []).filter((m) => !(Number(m.unit_price) > 0)).length,
  },
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))
console.log('OK', OUT)
