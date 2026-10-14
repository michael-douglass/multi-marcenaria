/**
 * Scorecard de qualidade PRD v11.3 (caixaria Cortecloud) para um quote_analyses.
 *
 * Uso:
 *   node --env-file=.env scripts/score-orcamento-ia.mjs <analysisId> [--out path.json]
 *
 * Limiares "bom o suficiente":
 *   - status COMPLETED
 *   - ambientes Gourmet + Lavabo (nomes contendo)
 *   - ≥50% módulos in-scope com ≥3 peças de caixaria (chapa)
 *   - ≥30% desses módulos com fita_borda
 *   - 100% materiais com unit_price > 0
 *   - bom_items count > 0
 */
import fs from 'node:fs'
import path from 'node:path'
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
  console.error('Faltam VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const THRESHOLDS = {
  statusCompleted: true,
  requireGourmetAndLavabo: true,
  minCaixariaRichPct: 0.5,
  minTapePctOfRich: 0.3,
  allPricesPositive: true,
  bomItemsRequired: true,
  minCaixariaPieces: 3,
}

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function isChapaCategory(cat) {
  const c = String(cat || '').toLowerCase()
  return c === 'chapa' || c === 'board' || c.includes('mdf') || c.includes('chapa')
}

function isTapeCategory(cat) {
  const c = String(cat || '').toLowerCase()
  return c === 'fita_borda' || c === 'edgeband' || c.includes('fita')
}

async function main() {
  const { data: analysis, error: aErr } = await admin
    .from('quote_analyses')
    .select('id, company_id, status, mode, source_pdf_path, error_message, totals, pricing_modality, updated_at')
    .eq('id', ANALYSIS_ID)
    .maybeSingle()
  if (aErr) throw new Error(aErr.message)
  if (!analysis) throw new Error(`Análise não encontrada: ${ANALYSIS_ID}`)

  const { data: envs, error: eErr } = await admin
    .from('quote_environments')
    .select('id, name, sort_order')
    .eq('analysis_id', ANALYSIS_ID)
    .order('sort_order', { ascending: true })
  if (eErr) throw new Error(eErr.message)

  const envIds = (envs || []).map((e) => e.id)
  let modules = []
  if (envIds.length) {
    const { data: mods, error: mErr } = await admin
      .from('quote_modules')
      .select('id, name, environment_id, out_of_scope, sort_order')
      .in('environment_id', envIds)
      .order('sort_order', { ascending: true })
    if (mErr) throw new Error(mErr.message)
    modules = mods || []
  }

  const modIds = modules.map((m) => m.id)
  let materials = []
  if (modIds.length) {
    const { data: mats, error: matErr } = await admin
      .from('quote_materials')
      .select('id, module_id, raw_name, category, unit_price, exact_quantity, unit_measure')
      .in('module_id', modIds)
    if (matErr) throw new Error(matErr.message)
    materials = mats || []
  }

  const { count: bomCount, error: bErr } = await admin
    .from('bom_items')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', ANALYSIS_ID)
  if (bErr) throw new Error(bErr.message)

  const envNames = (envs || []).map((e) => e.name)
  const hasGourmet = envNames.some((n) => /gourmet|cozinha/i.test(normalize(n)))
  const hasLavabo = envNames.some((n) => /lavabo/i.test(normalize(n)))

  const inScope = modules.filter((m) => m.out_of_scope !== true)
  const moduleStats = inScope.map((m) => {
    const mats = materials.filter((x) => x.module_id === m.id)
    const chapaCount = mats.filter((x) => isChapaCategory(x.category)).length
    const tapeCount = mats.filter((x) => isTapeCategory(x.category)).length
    const zeroPrice = mats.filter((x) => !(Number(x.unit_price) > 0)).length
    return {
      id: m.id,
      name: m.name,
      env: (envs || []).find((e) => e.id === m.environment_id)?.name || null,
      materials: mats.length,
      chapaCount,
      tapeCount,
      zeroPrice,
      richCaixaria: chapaCount >= THRESHOLDS.minCaixariaPieces,
      hasTape: tapeCount > 0,
    }
  })

  const rich = moduleStats.filter((m) => m.richCaixaria)
  const richPct = inScope.length ? rich.length / inScope.length : 0
  const tapeAmongRichPct = rich.length
    ? rich.filter((m) => m.hasTape).length / rich.length
    : 0
  const totalMats = materials.length
  const pricedOk = materials.filter((m) => Number(m.unit_price) > 0).length
  const pricePct = totalMats ? pricedOk / totalMats : 1

  const checks = {
    statusCompleted: {
      ok: analysis.status === 'COMPLETED',
      value: analysis.status,
      threshold: 'COMPLETED',
    },
    gourmetAndLavabo: {
      ok: hasGourmet && hasLavabo,
      value: { hasGourmet, hasLavabo, envNames },
      threshold: 'Gourmet + Lavabo',
    },
    caixariaRichPct: {
      ok: richPct >= THRESHOLDS.minCaixariaRichPct,
      value: Math.round(richPct * 1000) / 10,
      threshold: `>= ${THRESHOLDS.minCaixariaRichPct * 100}%`,
      detail: `${rich.length}/${inScope.length} módulos com ≥${THRESHOLDS.minCaixariaPieces} chapas`,
    },
    tapePctOfRich: {
      ok: rich.length === 0 ? false : tapeAmongRichPct >= THRESHOLDS.minTapePctOfRich,
      value: Math.round(tapeAmongRichPct * 1000) / 10,
      threshold: `>= ${THRESHOLDS.minTapePctOfRich * 100}% dos ricos`,
      detail: `${rich.filter((m) => m.hasTape).length}/${rich.length || 0} com fita`,
    },
    allPricesPositive: {
      ok: totalMats > 0 && pricedOk === totalMats,
      value: `${pricedOk}/${totalMats}`,
      threshold: '100%',
    },
    bomItems: {
      ok: (bomCount || 0) > 0,
      value: bomCount || 0,
      threshold: '> 0',
    },
  }

  const passCount = Object.values(checks).filter((c) => c.ok).length
  const totalChecks = Object.keys(checks).length
  const pass = passCount === totalChecks

  const report = {
    analysisId: ANALYSIS_ID,
    scoredAt: new Date().toISOString(),
    analysis: {
      status: analysis.status,
      mode: analysis.mode,
      pdf: analysis.source_pdf_path,
      pricing_modality: analysis.pricing_modality,
      updated_at: analysis.updated_at,
      totals: analysis.totals,
    },
    counts: {
      environments: (envs || []).length,
      modules: modules.length,
      inScope: inScope.length,
      materials: totalMats,
      bom_items: bomCount || 0,
    },
    moduleStats,
    checks,
    passCount,
    totalChecks,
    pass,
    thresholds: THRESHOLDS,
  }

  console.log(`\n=== Scorecard ${ANALYSIS_ID} ===`)
  console.log(`Status: ${analysis.status} | mods in-scope: ${inScope.length} | mats: ${totalMats} | bom: ${bomCount || 0}`)
  for (const [k, c] of Object.entries(checks)) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${k}: ${JSON.stringify(c.value)} (limiar ${c.threshold})${c.detail ? ' — ' + c.detail : ''}`)
  }
  console.log(`\nRESULTADO: ${pass ? 'PASS (bom o suficiente)' : 'FAIL'} (${passCount}/${totalChecks})`)

  if (OUT) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
    console.log(`Salvo: ${OUT}`)
  } else {
    // stdout summary already printed; still emit path hint
  }

  // Always write default evidence path when scoring ELITON without --out? Plan wants explicit --out for baseline.
  process.exit(pass ? 0 : 2)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
