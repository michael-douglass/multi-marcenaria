/**
 * Corrige unit_price de fita_borda que herdou preço de chapa (R$/m absurdo).
 * Uso: node --env-file=.env scripts/reprice-fita-borda.mjs [analysisId]
 */
import { createClient } from '@supabase/supabase-js'

const ANALYSIS_ID = process.argv[2] || null
const MAX_M = 25
const FALLBACK = 1.3

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Faltam env')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function score(a, b) {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  if (na === nb) return 100
  if (na.includes(nb) || nb.includes(na)) return 88
  const ta = new Set(na.split(/\s+/).filter((t) => t.length >= 2))
  const tb = nb.split(/\s+/).filter((t) => t.length >= 2)
  if (!tb.length) return 0
  const hits = tb.filter((t) => [...ta].some((x) => x === t || x.includes(t) || t.includes(x))).length
  return Math.round((hits / tb.length) * 70)
}

async function resolveTapePrice(inv, market, name) {
  let best = null
  for (const row of inv) {
    const s = score(row.name, name)
    if (s < 28) continue
    if (!best || s > best.s) best = { s, row }
  }
  if (best && Number(best.row.unit_price) > 0 && Number(best.row.unit_price) <= MAX_M) {
    return {
      unitPrice: Number(best.row.unit_price),
      usingMarket: false,
      matched: best.row.name,
      id: best.row.id,
    }
  }
  const pool = market
    .map((r) => ({ r, s: score(r.item_pattern, name) }))
    .filter((x) => x.s >= 28 && Number(x.r.estimated_market_price) > 0 && Number(x.r.estimated_market_price) <= MAX_M)
  if (pool.length) {
    const avg = pool.reduce((s, x) => s + Number(x.r.estimated_market_price), 0) / pool.length
    return {
      unitPrice: Math.round(avg * 100) / 100,
      usingMarket: true,
      matched: `média mercado (${pool.length})`,
      id: null,
    }
  }
  return { unitPrice: FALLBACK, usingMarket: true, matched: 'contingência fita/m', id: null }
}

async function main() {
  let analysisIds = ANALYSIS_ID ? [ANALYSIS_ID] : null
  if (!analysisIds) {
    const { data } = await admin
      .from('quote_analyses')
      .select('id')
      .eq('status', 'COMPLETED')
      .order('updated_at', { ascending: false })
      .limit(20)
    analysisIds = (data || []).map((r) => r.id)
  }

  const { data: inv } = await admin
    .from('inventory_items')
    .select('id,name,unit_price')
    .eq('active', true)
    .eq('category', 'fita_borda')
    .limit(2000)
  const { data: market } = await admin
    .from('market_reference_prices')
    .select('item_pattern,estimated_market_price')
    .eq('category', 'fita_borda')
    .limit(2000)

  let fixed = 0
  for (const analysisId of analysisIds) {
    const { data: envs } = await admin
      .from('quote_environments')
      .select('id')
      .eq('analysis_id', analysisId)
    const envIds = (envs || []).map((e) => e.id)
    if (!envIds.length) continue
    const { data: mods } = await admin
      .from('quote_modules')
      .select('id')
      .in('environment_id', envIds)
    const modIds = (mods || []).map((m) => m.id)
    if (!modIds.length) continue

    const { data: mats } = await admin
      .from('quote_materials')
      .select('id,raw_name,unit_price,unit_measure,notes')
      .in('module_id', modIds)
      .eq('category', 'fita_borda')

    for (const mat of mats || []) {
      const price = Number(mat.unit_price) || 0
      if (price > 0 && price <= MAX_M) continue
      const resolved = await resolveTapePrice(inv || [], market || [], mat.raw_name)
      const notes = [mat.notes, `reprice-fita: ${resolved.matched}`].filter(Boolean).join(' · ')
      const { error } = await admin
        .from('quote_materials')
        .update({
          unit_price: resolved.unitPrice,
          unit_measure: 'm',
          using_market_price: resolved.usingMarket,
          system_material_id: resolved.id,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mat.id)
      if (error) throw new Error(error.message)
      console.log(
        `${analysisId.slice(0, 8)} | ${mat.raw_name}: R$ ${price} → R$ ${resolved.unitPrice}/m (${resolved.matched})`,
      )
      fixed += 1
    }
  }

  console.log(`\nCorrigidas ${fixed} linhas de fita.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
