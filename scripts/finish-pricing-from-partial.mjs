/**
 * Fecha um lote travado em ready_for_pricing / pricing_pending:
 * usa partial_extraction já salva, grava árvore + BOM + preço de venda.
 *
 * Uso: node --env-file=.env scripts/finish-pricing-from-partial.mjs [analysisId]
 */
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const ANALYSIS_ID = process.argv[2]
if (!ANALYSIS_ID) {
  console.error('Uso: node --env-file=.env scripts/finish-pricing-from-partial.mjs <analysisId>')
  process.exit(1)
}

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Faltam VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\bchapa[-_]?\w*\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreMatch(candidate, query) {
  const a = normalizeName(candidate)
  const b = normalizeName(query)
  if (!a || !b) return 0
  if (a === b) return 100
  if (a.includes(b) || b.includes(a)) return 88
  const tokensB = b.split(' ').filter((t) => t.length >= 2)
  if (!tokensB.length) return 0
  const tokensA = new Set(a.split(' ').filter((t) => t.length >= 2))
  const hits = tokensB.filter((t) => {
    if (tokensA.has(t)) return true
    for (const ta of tokensA) if (ta.includes(t) || t.includes(ta)) return true
    return false
  }).length
  let score = Math.round((hits / tokensB.length) * 70)
  const thickA = a.match(/\b(6|15|18|25)\b/)
  const thickB = b.match(/\b(6|15|18|25)\b/)
  if (thickA && thickB && thickA[1] === thickB[1]) score += 12
  return Math.min(100, score)
}

function contingencyPrice(name, category) {
  const n = normalizeName(name)
  const cat = String(category || '').toLowerCase()
  if (cat === 'fita_borda' || n.includes('fita'))
    return { unitPrice: 2.5, unit: 'm', market: true, source: 'contingency', matched: null, inventoryItemId: null }
  if (n.includes('dobradica'))
    return { unitPrice: 15, unit: 'un', market: true, source: 'contingency', matched: null, inventoryItemId: null }
  if (n.includes('corredica'))
    return { unitPrice: 45, unit: 'par', market: true, source: 'contingency', matched: null, inventoryItemId: null }
  if (n.includes('puxador') || n.includes('perfil'))
    return { unitPrice: 85, unit: 'barra', market: true, source: 'contingency', matched: null, inventoryItemId: null }
  if (cat === 'chapa' || n.includes('mdf') || n.includes('chapa')) {
    return { unitPrice: 220, unit: 'chapa', market: true, source: 'contingency', matched: null, inventoryItemId: null }
  }
  return { unitPrice: 25, unit: 'un', market: true, source: 'contingency', matched: null, inventoryItemId: null }
}

function resolveFromInventory(inventory, name, category) {
  let best = null
  for (const row of inventory) {
    const score = scoreMatch(row.name, name)
    const catBonus = category && row.category === category ? 8 : 0
    const total = score + catBonus
    if (total < 28) continue
    if (!best || total > best.score) best = { score: total, row }
  }
  if (!best) return contingencyPrice(name, category)
  const row = best.row
  const unitPrice =
    Number(row.unit_price) > 0
      ? Number(row.unit_price)
      : Number(row.price_per_sheet) > 0
        ? Number(row.price_per_sheet)
        : Number(row.price_per_m2) > 0
          ? Number(row.price_per_m2)
          : 0
  if (!(unitPrice > 0)) return contingencyPrice(name, category)
  return {
    unitPrice,
    unit: row.unit || 'un',
    market: false,
    source: 'inventory',
    matched: row.name,
    inventoryItemId: row.id,
  }
}

function asArr(v) {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []
}

function pagePathFor(companyId, analysisId, projectId, preferredPaths, page) {
  if (!(Number(page) >= 1)) return null
  const n = Math.floor(Number(page))
  const pad = String(n).padStart(3, '0')
  const hit = (preferredPaths || []).find((p) =>
    typeof p === 'string' && (p.includes(`page-${pad}`) || p.endsWith(`/${n}.jpg`)),
  )
  if (hit) return hit
  if (projectId) {
    return `${companyId}/quote-projects/${projectId}/pages/page-${pad}.jpg`
  }
  return `${companyId}/${analysisId}/pages/page-${pad}.jpg`
}

async function main() {
  console.log('Fechando precificação órfã:', ANALYSIS_ID)

  const { data: analysis, error } = await admin
    .from('quote_analyses')
    .select('id, company_id, project_id, mode, status, totals, pricing_modality')
    .eq('id', ANALYSIS_ID)
    .single()
  if (error || !analysis) throw new Error(error?.message || 'Análise não encontrada')

  const prev =
    analysis.totals && typeof analysis.totals === 'object' ? analysis.totals : {}
  const chain = prev.async_chain_status
  const stage = prev.pipeline_stage
  if (chain !== 'ready_for_pricing' && stage !== 'pricing_pending') {
    console.warn(
      `Aviso: chain=${chain} stage=${stage} — seguindo mesmo assim se houver partial_extraction.`,
    )
  }

  const extraction =
    prev.partial_extraction && typeof prev.partial_extraction === 'object'
      ? prev.partial_extraction
      : prev.last_extraction && typeof prev.last_extraction === 'object'
        ? prev.last_extraction
        : null
  if (!extraction || !asArr(extraction.environments).length) {
    throw new Error('Sem partial_extraction/last_extraction utilizável.')
  }

  const preferredPaths = Array.isArray(prev.page_paths)
    ? prev.page_paths.filter((p) => typeof p === 'string')
    : []
  const pageNumbers = Array.isArray(prev.page_ranges)
    ? prev.page_ranges.filter((n) => typeof n === 'number' && n > 0)
    : []

  await admin
    .from('quote_analyses')
    .update({
      status: 'FETCHING_MARKET_PRICES',
      error_message: null,
      updated_at: new Date().toISOString(),
      totals: {
        ...prev,
        pipeline_stage: 'pricing',
        pipeline_detail: 'Fechando precificação órfã (leitura já pronta)…',
        pipeline_updated_at: new Date().toISOString(),
      },
    })
    .eq('id', ANALYSIS_ID)

  const { data: invRows } = await admin
    .from('inventory_items')
    .select('id, name, category, unit, unit_price, price_per_sheet, price_per_m2, active')
    .or(`company_id.eq.${analysis.company_id},company_id.is.null`)
    .eq('active', true)
  const inventory = invRows || []
  console.log('Estoque para match:', inventory.length)

  const { data: oldEnvs } = await admin
    .from('quote_environments')
    .select('id')
    .eq('analysis_id', ANALYSIS_ID)
  if (oldEnvs?.length) {
    await admin.from('quote_environments').delete().in(
      'id',
      oldEnvs.map((e) => e.id),
    )
  }

  let materialsSaved = 0
  let inventoryHits = 0
  let contingencyHits = 0
  let modulesCount = 0

  for (const [ei, env] of asArr(extraction.environments).entries()) {
    const { data: envRow, error: envErr } = await admin
      .from('quote_environments')
      .insert({
        analysis_id: ANALYSIS_ID,
        name: typeof env.name === 'string' ? env.name : `Ambiente ${ei + 1}`,
        sort_order: ei,
      })
      .select('id')
      .single()
    if (envErr) throw new Error(envErr.message)

    for (const [mi, mod] of asArr(env.modules).entries()) {
      modulesCount++
      const modPage = mod.bounding_box?.page ?? null
      const pathOf = (page) =>
        pagePathFor(
          analysis.company_id,
          ANALYSIS_ID,
          analysis.project_id,
          preferredPaths,
          page,
        )

      const { data: modRow, error: modErr } = await admin
        .from('quote_modules')
        .insert({
          environment_id: envRow.id,
          name: typeof mod.name === 'string' ? mod.name : `Módulo ${mi + 1}`,
          description: mod.description ?? null,
          dimensions: mod.dimensions ?? {},
          bounding_box: mod.bounding_box ?? null,
          page_number: modPage,
          page_image_path: pathOf(modPage),
          sort_order: mi,
          out_of_scope: mod.out_of_scope === true,
        })
        .select('id')
        .single()
      if (modErr) throw new Error(modErr.message)

      const rows = []
      const pushRow = (row, bbox) => {
        const page = bbox?.page ?? modPage
        rows.push({
          ...row,
          bounding_box: bbox ?? mod.bounding_box ?? null,
          page_image_path: pathOf(page),
        })
      }

      for (const piece of asArr(mod.caixaria)) {
        const p = resolveFromInventory(inventory, piece.material_name, 'chapa')
        if (p.source === 'inventory') inventoryHits++
        else contingencyHits++
        const qty = piece.quantity || 1
        pushRow(
          {
            module_id: modRow.id,
            raw_name: `${piece.name} — ${piece.material_name}`,
            category: 'chapa',
            system_material_id: p.inventoryItemId || null,
            using_market_price: p.market,
            market_price_confirmed: false,
            unit_price: p.unitPrice,
            exact_quantity: qty,
            full_units_quantity: Math.ceil(qty),
            unit_measure: p.unit,
            notes: `função=${piece.function}; source=${p.source}${p.matched ? `; match=${p.matched}` : ''}`,
          },
          piece.bounding_box,
        )
      }
      for (const frente of asArr(mod.frentes_portas)) {
        const p = resolveFromInventory(inventory, frente.material_name, 'chapa')
        if (p.source === 'inventory') inventoryHits++
        else contingencyHits++
        const qty = frente.quantity || 1
        pushRow(
          {
            module_id: modRow.id,
            raw_name: `${frente.name} — ${frente.material_name}`,
            category: 'chapa',
            system_material_id: p.inventoryItemId || null,
            using_market_price: p.market,
            market_price_confirmed: false,
            unit_price: p.unitPrice,
            exact_quantity: qty,
            full_units_quantity: Math.ceil(qty),
            unit_measure: p.unit,
            notes: `tipo=${frente.kind}; source=${p.source}`,
          },
          frente.bounding_box,
        )
      }
      for (const fita of asArr(mod.fitas_borda_m)) {
        const p = resolveFromInventory(inventory, fita.tape_name, 'fita_borda')
        if (p.source === 'inventory') inventoryHits++
        else contingencyHits++
        const meters = fita.meters || 1
        pushRow(
          {
            module_id: modRow.id,
            raw_name: fita.tape_name,
            category: 'fita_borda',
            system_material_id: p.inventoryItemId || null,
            using_market_price: p.market,
            market_price_confirmed: false,
            unit_price: p.unitPrice,
            exact_quantity: meters,
            full_units_quantity: Math.ceil(meters),
            unit_measure: 'm',
            notes: `source=${p.source}`,
          },
          fita.bounding_box,
        )
      }
      for (const ferr of asArr(mod.ferragens)) {
        const cat = ferr.category || 'ferragem'
        const p = resolveFromInventory(inventory, ferr.raw_name, cat)
        if (p.source === 'inventory') inventoryHits++
        else contingencyHits++
        const qty = ferr.exact_quantity || 1
        const full = ferr.full_units_quantity || Math.ceil(qty)
        pushRow(
          {
            module_id: modRow.id,
            raw_name: ferr.raw_name,
            category: cat,
            system_material_id: p.inventoryItemId || null,
            using_market_price: p.market,
            market_price_confirmed: false,
            unit_price: p.unitPrice,
            exact_quantity: qty,
            full_units_quantity: full,
            unit_measure: ferr.unit_measure || p.unit || 'un',
            notes: ferr.notes ? `${ferr.notes}; source=${p.source}` : `source=${p.source}`,
          },
          ferr.bounding_box,
        )
      }

      if (!rows.length && mod.out_of_scope !== true) {
        const p = contingencyPrice('Fora de escopo', 'consumivel')
        contingencyHits++
        pushRow(
          {
            module_id: modRow.id,
            raw_name: `Fora de escopo — ${mod.name}`,
            category: 'consumivel',
            using_market_price: true,
            market_price_confirmed: false,
            unit_price: p.unitPrice,
            exact_quantity: 1,
            full_units_quantity: 1,
            unit_measure: 'un',
            notes: 'Sem peças de marcenaria detalhadas',
          },
          mod.bounding_box,
        )
      }

      if (rows.length) {
        const { error: matErr } = await admin.from('quote_materials').insert(rows)
        if (matErr) throw new Error(matErr.message)
        materialsSaved += rows.length
      }
    }
  }

  console.log(
    `Árvore gravada: ${asArr(extraction.environments).length} ambientes, ${modulesCount} módulos, ${materialsSaved} materiais (estoque ${inventoryHits} / contingência ${contingencyHits})`,
  )

  console.log('Persistindo bom_items…')
  const bomRun = spawnSync(
    process.execPath,
    ['--env-file=.env', 'scripts/persist-bom-items.mjs', ANALYSIS_ID],
    { stdio: 'inherit', cwd: process.cwd(), env: process.env },
  )
  if (bomRun.status !== 0) {
    throw new Error(`persist-bom-items falhou (exit ${bomRun.status})`)
  }

  console.log('Recalculando venda (MPC)…')
  const priceRun = spawnSync(
    process.execPath,
    ['--env-file=.env', 'scripts/reprice-orcamento-ia-totals.mjs', ANALYSIS_ID],
    { stdio: 'inherit', cwd: process.cwd(), env: process.env },
  )
  if (priceRun.status !== 0) {
    throw new Error(`reprice-orcamento-ia-totals falhou (exit ${priceRun.status})`)
  }

  const { data: priced } = await admin
    .from('quote_analyses')
    .select('totals')
    .eq('id', ANALYSIS_ID)
    .single()
  const pricedTotals =
    priced?.totals && typeof priced.totals === 'object' ? priced.totals : {}

  await admin
    .from('quote_analyses')
    .update({
      status: 'COMPLETED',
      error_message: null,
      updated_at: new Date().toISOString(),
      totals: {
        ...pricedTotals,
        materials_count: materialsSaved,
        environments: asArr(extraction.environments).length,
        modules: modulesCount,
        pages_processed: pageNumbers.length || preferredPaths.length || pricedTotals.pages_processed,
        pricing_inventory_hits: inventoryHits,
        pricing_contingency_hits: contingencyHits,
        last_extraction: extraction,
        async_chain_status: 'completed',
        pipeline_stage: 'completed',
        pipeline_detail: 'Cotação concluída (precificação retomada após aba fechada).',
        pipeline_updated_at: new Date().toISOString(),
        finished_from_partial_at: new Date().toISOString(),
      },
    })
    .eq('id', ANALYSIS_ID)

  const sale = Number(pricedTotals.sale_price) || 0
  const cost = Number(pricedTotals.materials_cost) || 0
  console.log('\n=== CONCLUÍDO ===')
  console.log(`Status: COMPLETED`)
  console.log(`Custo materiais: R$ ${cost.toFixed(2)}`)
  console.log(`Preço de venda: R$ ${sale.toFixed(2)}`)
  console.log(`Audit: /orcamentos-ia?audit=${ANALYSIS_ID}`)
}

main().catch((err) => {
  console.error('FALHA:', err.message || err)
  process.exit(1)
})
