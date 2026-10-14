/**
 * Recalcula custo/venda (MPC % ou ×N) e grava em quote_analyses.totals.
 * Proibido m² de fachada. Uso: node --env-file=.env scripts/reprice-orcamento-ia-totals.mjs [analysisId]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createClient } from '@supabase/supabase-js'

const ANALYSIS_ID = process.argv[2] || '7f377e15-ff4f-4dcc-a7ed-26663aea7975'
const outIdx = process.argv.indexOf('--out')
const OUT =
  outIdx >= 0 && process.argv[outIdx + 1]
    ? path.resolve(process.argv[outIdx + 1])
    : null

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Faltam env')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  const vite = await createServer({
    configFile: false,
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'error',
  })

  try {
    const pricing = await vite.ssrLoadModule('/src/lib/orcamentos-ia/pricing.ts')

    const { data: analysis, error } = await admin
      .from('quote_analyses')
      .select('id, company_id, status, pricing_modality, totals')
      .eq('id', ANALYSIS_ID)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!analysis) throw new Error('Análise não encontrada')

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
        'id, module_id, raw_name, category, unit_price, exact_quantity, full_units_quantity, unit_measure, using_market_price',
      )
      .in('module_id', modIds)

    const matsByMod = new Map()
    for (const m of materials || []) {
      const list = matsByMod.get(m.module_id) || []
      list.push(m)
      matsByMod.set(m.module_id, list)
    }

    const tree = {
      id: ANALYSIS_ID,
      environments: (envs || []).map((env) => ({
        ...env,
        modules: (modules || [])
          .filter((m) => m.environment_id === env.id)
          .map((m) => ({
            ...m,
            materials: matsByMod.get(m.id) || [],
          })),
      })),
    }

    const zero = (materials || []).filter((m) => !(Number(m.unit_price) > 0))
    if (zero.length) {
      console.error(`FAIL: ${zero.length} materiais com unit_price <= 0`)
      process.exit(2)
    }

    const modality = pricing.normalizePricingModality(analysis.pricing_modality || 'mpc_margin')
    const params = {
      ...pricing.DEFAULT_PRICING_PARAMS,
      modality,
    }
    const result = pricing.calculateQuotePricing(tree, params)

    // Sanity: venda não pode ser área × R$/m² de fachada
    const facadeTrap = result.totalAreaSqm * 2500
    if (Math.abs(result.salePrice - facadeTrap) < 1 && result.materialsCost > 0) {
      console.error('FAIL: venda parece m² de fachada')
      process.exit(2)
    }

    const prev =
      analysis.totals && typeof analysis.totals === 'object' ? analysis.totals : {}
    const nextTotals = {
      ...prev,
      materials_count: (materials || []).length,
      materials_cost: result.materialsCost,
      sale_price: result.salePrice,
      pricing_modality: result.modality,
      pricing_formula: result.formulaLabel,
      sheet_area_m2_ref: result.totalAreaSqm,
      priced_at: new Date().toISOString(),
      using_facade_sqm: false,
    }

    await admin
      .from('quote_analyses')
      .update({
        pricing_modality: result.modality,
        totals: nextTotals,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ANALYSIS_ID)

    const summary = {
      analysisId: ANALYSIS_ID,
      status: analysis.status,
      materials: (materials || []).length,
      zeroPrices: 0,
      modality: result.modality,
      materialsCost: result.materialsCost,
      salePrice: result.salePrice,
      formula: result.formulaLabel,
      sheetAreaM2Ref: result.totalAreaSqm,
      usingFacadeSqm: false,
      pass: true,
    }
    console.log(JSON.stringify(summary, null, 2))
    if (OUT) {
      fs.mkdirSync(path.dirname(OUT), { recursive: true })
      fs.writeFileSync(OUT, JSON.stringify(summary, null, 2), 'utf8')
      console.log('Salvo:', OUT)
    }
  } finally {
    await vite.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
