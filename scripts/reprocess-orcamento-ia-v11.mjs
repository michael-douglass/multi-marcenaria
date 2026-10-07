/**
 * Reprocessa orçamento v11: Edge (inventory→extract→audit) + persistência
 * com lista de corte (R$ 0) + Chapa agregada precificada no estoque/mercado.
 *
 * Uso: node --env-file=.env scripts/reprocess-orcamento-ia-v11.mjs [analysisId]
 */
import { createClient } from '@supabase/supabase-js'

const ANALYSIS_ID = process.argv[2] || '4b7ce4a9-73f5-47e8-8ce2-575d30e16028'
const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !serviceKey) {
  console.error('Faltam env')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const SHEET_AREA = 5.0875
const LOSS = 1.15
const CUTTING = 'corte-peca'

function norm(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function scoreMatch(a, b) {
  const na = norm(a)
  const nb = norm(b)
  if (!na || !nb) return 0
  if (na === nb) return 100
  if (na.includes(nb) || nb.includes(na)) return 88
  const ta = new Set(na.split(' ').filter((t) => t.length >= 2))
  const tb = nb.split(' ').filter((t) => t.length >= 2)
  if (!tb.length) return 0
  const hits = tb.filter((t) => [...ta].some((x) => x === t || x.includes(t) || t.includes(x))).length
  return Math.round((hits / tb.length) * 80)
}

async function loadPriceBook(companyId) {
  const [inv, market] = await Promise.all([
    admin
      .from('inventory_items')
      .select('id,name,category,unit,unit_price,price_per_m2,price_per_sheet')
      .eq('active', true)
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .limit(2000),
    admin.from('market_reference_prices').select('item_pattern,category,unit,estimated_market_price').limit(2000),
  ])
  return { inventory: inv.data || [], market: market.data || [] }
}

function resolvePrice(book, name, category = 'chapa') {
  const invCat = book.inventory.filter((r) => r.category === category)
  let best = null
  for (const row of invCat.length ? invCat : book.inventory) {
    const s = scoreMatch(row.name, name)
    if (s < 28) continue
    if (!best || s > best.s) best = { s, row }
  }
  if (best) {
    const row = best.row
    const unitPrice =
      category === 'chapa'
        ? Number(row.price_per_sheet) || Number(row.unit_price) || Number(row.price_per_m2) || 0
        : Number(row.unit_price) || 0
    if (unitPrice > 0) {
      return {
        unitPrice,
        unit: row.unit || (category === 'chapa' ? 'chapa' : 'un'),
        usingMarket: false,
        id: row.id,
        matched: row.name,
      }
    }
  }
  const pool = (book.market || [])
    .filter((r) => !category || r.category === category || scoreMatch(r.item_pattern, name) >= 28)
    .map((r) => ({ r, s: scoreMatch(r.item_pattern, name) }))
    .filter((x) => x.s >= 28 && Number(x.r.estimated_market_price) > 0)
  if (pool.length) {
    const avg = pool.reduce((s, x) => s + Number(x.r.estimated_market_price), 0) / pool.length
    return {
      unitPrice: Math.round(avg * 100) / 100,
      unit: pool[0].r.unit || 'chapa',
      usingMarket: true,
      id: null,
      matched: `média mercado (${pool.length})`,
    }
  }
  // contingência chapa
  const n = norm(name)
  const amadeirado = /freijo|noite|carvalho|amadeir|toronto/.test(n)
  return {
    unitPrice: amadeirado ? 500 : 280,
    unit: 'chapa',
    usingMarket: true,
    id: null,
    matched: 'preço médio estimado',
  }
}

async function invokePhase(body) {
  const res = await fetch(`${url}/functions/v1/orcamentos-ia-pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: anonKey || serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok || !payload?.ok) throw new Error(payload?.error || `Edge ${res.status}`)
  return payload
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function pieceAreaM2(w, h, q) {
  return ((Number(w) || 0) * (Number(h) || 0) * (Number(q) || 1)) / 1_000_000
}

function asArr(v) {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []
}

async function persist(analysisId, companyId, extraction, inventory, pagePaths, book) {
  const { data: oldEnvs } = await admin.from('quote_environments').select('id').eq('analysis_id', analysisId)
  if (oldEnvs?.length) {
    await admin.from('quote_environments').delete().in(
      'id',
      oldEnvs.map((e) => e.id),
    )
  }

  let materialsSaved = 0
  const pagePath = (page) =>
    page && Number(page) >= 1
      ? `${companyId}/${analysisId}/pages/page-${String(Math.floor(Number(page))).padStart(3, '0')}.jpg`
      : null

  for (const [ei, env] of asArr(extraction.environments).entries()) {
    const { data: envRow, error: envErr } = await admin
      .from('quote_environments')
      .insert({ analysis_id: analysisId, name: env.name || 'Ambiente', sort_order: ei })
      .select('id')
      .single()
    if (envErr) throw new Error(envErr.message)

    for (const [mi, mod] of asArr(env.modules).entries()) {
      if (mod.out_of_scope === true) {
        await admin.from('quote_modules').insert({
          environment_id: envRow.id,
          name: mod.name || 'Fora do escopo',
          description: mod.description ?? null,
          dimensions: mod.dimensions ?? {},
          bounding_box: mod.bounding_box ?? null,
          page_number: mod.bounding_box?.page ?? null,
          page_image_path: pagePath(mod.bounding_box?.page),
          sort_order: mi,
          out_of_scope: true,
        })
        continue
      }

      const modPage = mod.bounding_box?.page ?? mod.page_number ?? null
      const { data: modRow, error: modErr } = await admin
        .from('quote_modules')
        .insert({
          environment_id: envRow.id,
          name: mod.name || 'Módulo',
          description: mod.description ?? null,
          dimensions: mod.dimensions ?? {},
          bounding_box: mod.bounding_box ?? null,
          page_number: modPage,
          page_image_path: pagePath(modPage),
          sort_order: mi,
          out_of_scope: false,
        })
        .select('id')
        .single()
      if (modErr) throw new Error(modErr.message)

      const rows = []
      const sheetAgg = new Map()

      const addCutting = (label, materialName, w, h, t, q, notes) => {
        const area = pieceAreaM2(w, h, q)
        const key = String(materialName || 'MDF').trim()
        const prev = sheetAgg.get(key) || { area: 0 }
        prev.area += area
        sheetAgg.set(key, prev)
        rows.push({
          module_id: modRow.id,
          raw_name: `${label} — ${key}`,
          category: 'chapa',
          using_market_price: false,
          market_price_confirmed: true,
          unit_price: 0,
          exact_quantity: q || 1,
          full_units_quantity: Math.ceil(q || 1),
          unit_measure: 'un',
          notes: `${CUTTING}; ${notes}; ${w}x${h}x${t}mm × ${q || 1}`,
          bounding_box: mod.bounding_box ?? null,
          page_image_path: pagePath(modPage),
        })
      }

      for (const p of asArr(mod.caixaria)) {
        addCutting(
          p.name || 'Peça',
          p.material_name || 'MDF',
          p.width_mm,
          p.height_mm,
          p.thickness_mm || 15,
          p.quantity || 1,
          `função=${p.function || 'outro'}`,
        )
      }
      for (const f of asArr(mod.frentes_portas)) {
        addCutting(
          f.name || 'Frente',
          f.material_name || 'MDF',
          f.width_mm,
          f.height_mm,
          f.thickness_mm || 15,
          f.quantity || 1,
          `tipo=${f.kind || 'porta'}`,
        )
      }

      for (const [matName, agg] of sheetAgg.entries()) {
        const sheets = Math.max(1, Math.ceil((agg.area * LOSS) / SHEET_AREA))
        const price = resolvePrice(book, matName, 'chapa')
        rows.push({
          module_id: modRow.id,
          raw_name: `Chapa — ${matName}`,
          category: 'chapa',
          system_material_id: price.id,
          using_market_price: price.usingMarket,
          market_price_confirmed: !price.usingMarket,
          unit_price: price.unitPrice,
          exact_quantity: sheets,
          full_units_quantity: sheets,
          unit_measure: 'chapa',
          notes: `módulo: ${agg.area.toFixed(3)} m² de corte + 15% perda → ${sheets} chapa(s) · ${price.matched}`,
          bounding_box: mod.bounding_box ?? null,
          page_image_path: pagePath(modPage),
        })
      }

      for (const fita of asArr(mod.fitas_borda_m)) {
        const meters = Number(fita.meters) || 0
        if (!(meters > 0)) continue
        const label = fita.tape_name || `Fita ${fita.width_mm || 22} mm`
        const price = resolvePrice(book, label, 'fita_borda')
        rows.push({
          module_id: modRow.id,
          raw_name: label,
          category: 'fita_borda',
          system_material_id: price.id,
          using_market_price: price.usingMarket,
          market_price_confirmed: !price.usingMarket,
          unit_price: price.unit === 'chapa' ? 1.1 : price.unitPrice,
          exact_quantity: meters,
          full_units_quantity: Math.ceil(meters),
          unit_measure: 'm',
          notes: price.usingMarket ? 'Preço médio de mercado — confira' : null,
          bounding_box: mod.bounding_box ?? null,
          page_image_path: pagePath(modPage),
        })
      }

      for (const ferr of asArr(mod.ferragens)) {
        const q = Number(ferr.exact_quantity ?? ferr.quantity) || 1
        const name = ferr.raw_name || ferr.name || 'Ferragem'
        const cat = ferr.category || 'ferragem'
        const price = resolvePrice(book, name, cat === 'puxador' ? 'puxador' : 'ferragem')
        rows.push({
          module_id: modRow.id,
          raw_name: name,
          category: cat === 'puxador' ? 'puxador' : 'ferragem',
          system_material_id: price.id,
          using_market_price: price.usingMarket,
          market_price_confirmed: !price.usingMarket,
          unit_price: price.unitPrice,
          exact_quantity: q,
          full_units_quantity: Math.ceil(q),
          unit_measure: ferr.unit_measure || price.unit || 'un',
          notes: ferr.notes ?? (price.usingMarket ? 'Preço médio de mercado — confira' : null),
          bounding_box: mod.bounding_box ?? null,
          page_image_path: pagePath(modPage),
        })
      }

      if (rows.length) {
        const { error } = await admin.from('quote_materials').insert(rows)
        if (error) throw new Error(error.message)
        materialsSaved += rows.length
      }
    }
  }

  const modules = asArr(extraction.environments).flatMap((e) => asArr(e.modules).map((m) => m.name))
  await admin
    .from('quote_analyses')
    .update({
      status: 'COMPLETED',
      error_message: null,
      updated_at: new Date().toISOString(),
      totals: {
        materials_count: materialsSaved,
        environments: asArr(extraction.environments).length,
        modules: modules.length,
        inventory,
        auditor_notes: extraction.auditor_notes || [],
        warnings: extraction.warnings || [],
        last_extraction: extraction,
        pages_processed: pagePaths.length,
        reprocessed_at: new Date().toISOString(),
        pricing_note: 'v11: lista de corte + Chapa agregada (estoque→mercado→média)',
        pipeline_stage: 'completed',
        pipeline_detail: 'Reprocessamento v11 concluído — revise Chapas e confirme preços de mercado.',
      },
    })
    .eq('id', analysisId)

  return materialsSaved
}

async function main() {
  console.log('Reprocess v11', ANALYSIS_ID)
  const { data: analysis, error } = await admin
    .from('quote_analyses')
    .select('id, company_id, mode, source_pdf_path')
    .eq('id', ANALYSIS_ID)
    .single()
  if (error || !analysis) throw new Error(error?.message || 'Análise não encontrada')

  const folder = `${analysis.company_id}/${analysis.id}/pages`
  const { data: objects, error: listErr } = await admin.storage
    .from('orcamentos-ia')
    .list(folder, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
  if (listErr) throw new Error(listErr.message)
  const pagePaths = (objects || [])
    .filter((o) => /\.(png|jpe?g|webp)$/i.test(o.name || ''))
    .map((o) => `${folder}/${o.name}`)
    .sort()
  if (!pagePaths.length) throw new Error('Sem páginas no Storage')

  const book = await loadPriceBook(analysis.company_id)
  console.log('Estoque', book.inventory.length, 'mercado', book.market.length, 'páginas', pagePaths.length)

  const mode = analysis.mode === 'pro' ? 'pro' : 'max'
  const base = { analysisId: analysis.id, companyId: analysis.company_id, mode }

  await admin
    .from('quote_analyses')
    .update({
      status: 'READING_LAYOUT',
      totals: { pipeline_stage: 'reading_inventory', pipeline_detail: 'Inventário…' },
      updated_at: new Date().toISOString(),
    })
    .eq('id', ANALYSIS_ID)

  console.log('inventory…')
  const invPayload = await invokePhase({
    ...base,
    pagePaths,
    phase: 'inventory',
  })
  const inventory = Array.isArray(invPayload.inventory) ? invPayload.inventory : []
  console.log(
    'inventário',
    inventory.map((e) => `${e.environment}: ${(e.modules || []).join(', ')}`),
  )

  const batches = chunk(pagePaths, 6)
  const parts = []
  for (let i = 0; i < batches.length; i++) {
    console.log(`extract lote ${i + 1}/${batches.length}`)
    await admin
      .from('quote_analyses')
      .update({
        status: 'EXTRACTING_MODULES',
        totals: {
          pipeline_stage: 'extracting_batch',
          pipeline_detail: `Lote ${i + 1}/${batches.length}`,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', ANALYSIS_ID)
    const part = await invokePhase({
      ...base,
      pagePaths: batches[i],
      phase: 'extract',
      inventory,
    })
    if (part.extraction) parts.push(part.extraction)
  }

  // merge simples
  const envMap = new Map()
  const notes = []
  const warnings = []
  for (const part of parts) {
    for (const env of asArr(part.environments)) {
      const key = norm(env.name)
      if (!envMap.has(key)) envMap.set(key, { name: env.name, modules: [] })
      const bucket = envMap.get(key)
      for (const mod of asArr(env.modules)) {
        const exists = bucket.modules.some((m) => norm(m.name) === norm(mod.name))
        if (!exists) bucket.modules.push(mod)
      }
    }
    for (const n of part.auditor_notes || []) if (typeof n === 'string') notes.push(n)
    for (const w of part.warnings || []) if (typeof w === 'string') warnings.push(w)
  }
  let extraction = {
    environments: [...envMap.values()],
    auditor_notes: [...new Set(notes)],
    warnings: [...new Set(warnings)],
  }

  if (mode === 'max') {
    console.log('audit…')
    await admin
      .from('quote_analyses')
      .update({
        status: 'AUDITING_REVISION',
        totals: { pipeline_stage: 'auditing', pipeline_detail: 'Auditoria…' },
        updated_at: new Date().toISOString(),
      })
      .eq('id', ANALYSIS_ID)
    try {
      const aud = await invokePhase({
        ...base,
        pagePaths: pagePaths.slice(0, 24),
        phase: 'audit',
        inventory,
        extraction,
      })
      if (aud.extraction) extraction = aud.extraction
      console.log('audit score', aud.hallucinationScore, 'needsRerun', aud.auditNeedsRerun)
    } catch (e) {
      console.warn('audit falhou:', e.message)
      extraction.warnings.push(`Auditoria incompleta: ${e.message}`)
    }
  }

  console.log(
    'módulos',
    asArr(extraction.environments).map((e) => ({
      env: e.name,
      mods: asArr(e.modules).map((m) => m.name),
    })),
  )

  const saved = await persist(ANALYSIS_ID, analysis.company_id, extraction, inventory, pagePaths, book)
  console.log('materials saved', saved)

  // 2ª passagem de auditoria (só estrutura) se Painel TV sumiu
  const hasPainel = asArr(extraction.environments).some((e) =>
    asArr(e.modules).some((m) => /painel\s*tv|tv/i.test(m.name || '')),
  )
  if (!hasPainel) {
    console.log('Painel TV ausente — 2ª auditoria…')
    try {
      const aud2 = await invokePhase({
        ...base,
        pagePaths: pagePaths.slice(0, 24),
        phase: 'audit',
        inventory,
        extraction,
      })
      if (aud2.extraction) {
        extraction = aud2.extraction
        const saved2 = await persist(
          ANALYSIS_ID,
          analysis.company_id,
          extraction,
          inventory,
          pagePaths,
          book,
        )
        console.log('materials after 2nd audit', saved2)
      }
    } catch (e) {
      console.warn('2nd audit:', e.message)
    }
  }

  // snapshot final
  const { data: envs } = await admin.from('quote_environments').select('id,name').eq('analysis_id', ANALYSIS_ID)
  const { data: mods } = await admin
    .from('quote_modules')
    .select('id,name,page_number')
    .in(
      'environment_id',
      envs.map((e) => e.id),
    )
  const { data: mats } = await admin
    .from('quote_materials')
    .select('raw_name,unit_price,notes,category')
    .in(
      'module_id',
      mods.map((m) => m.id),
    )
  const billableZeros = mats.filter(
    (m) =>
      !(m.notes || '').includes(CUTTING) &&
      ['chapa', 'fita_borda', 'ferragem', 'puxador', 'consumivel'].includes(m.category) &&
      !(Number(m.unit_price) > 0),
  )
  console.log('FINAL modules', mods.map((m) => `${m.name}@${m.page_number}`))
  console.log('billableZeros', billableZeros.length, billableZeros.map((m) => m.raw_name))
  console.log(
    'hasPainel',
    mods.some((m) => /painel/i.test(m.name)),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
