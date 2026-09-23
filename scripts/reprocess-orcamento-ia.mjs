/**
 * Reprocessa um orçamento IA já existente (páginas no Storage + Edge pipeline + persistência).
 * Uso: node --env-file=.env scripts/reprocess-orcamento-ia.mjs [analysisId]
 */
import { createClient } from '@supabase/supabase-js'

const ANALYSIS_ID = process.argv[2] || 'dc58c6a4-ebf1-4a4d-a0d8-46165e8ee9fd'
const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !serviceKey) {
  console.error('Faltam VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const admin = createClient(url, serviceKey)

function contingencyPrice(name, category) {
  const n = String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  const cat = String(category || '').toLowerCase()
  if (cat === 'fita_borda' || n.includes('fita')) return { unitPrice: 2.5, unit: 'm', market: true }
  if (n.includes('dobradica')) return { unitPrice: 15, unit: 'un', market: true }
  if (n.includes('corredica')) return { unitPrice: 45, unit: 'par', market: true }
  if (n.includes('puxador') || n.includes('perfil')) return { unitPrice: 85, unit: 'barra', market: true }
  if (cat === 'chapa' || n.includes('mdf') || n.includes('chapa')) {
    return { unitPrice: 220, unit: 'chapa', market: true }
  }
  return { unitPrice: 25, unit: 'un', market: true }
}

/** Remove medidas ≤0 do módulo (mesmo critério do pipeline cliente / Zod). */
function sanitizeExtraction(raw) {
  if (!raw || typeof raw !== 'object') return raw
  const environments = (raw.environments || [])
    .map((env) => {
      if (!env || typeof env !== 'object') return null
      const modules = (env.modules || [])
        .map((mod) => {
          if (!mod || typeof mod !== 'object') return null
          const m = { ...mod }
          if (m.dimensions && typeof m.dimensions === 'object') {
            const d = { ...m.dimensions }
            for (const key of ['width_mm', 'height_mm', 'depth_mm']) {
              const n = Number(d[key])
              if (!Number.isFinite(n) || n <= 0) delete d[key]
            }
            m.dimensions =
              'width_mm' in d || 'height_mm' in d || 'depth_mm' in d ? d : undefined
          }
          return m
        })
        .filter(Boolean)
      if (!modules.length) return null
      return { ...env, modules }
    })
    .filter(Boolean)
  return { ...raw, environments }
}

async function main() {
  console.log('Reprocessando análise', ANALYSIS_ID)

  const { data: analysis, error: aErr } = await admin
    .from('quote_analyses')
    .select('id, company_id, mode, source_pdf_path, status')
    .eq('id', ANALYSIS_ID)
    .single()
  if (aErr || !analysis) throw new Error(aErr?.message || 'Análise não encontrada')

  const prefix = `${analysis.company_id}/${analysis.id}/pages/`
  const { data: objects, error: listErr } = await admin.storage
    .from('orcamentos-ia')
    .list(`${analysis.company_id}/${analysis.id}/pages`, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
  if (listErr) throw new Error(listErr.message)

  const pagePaths = (objects || [])
    .filter((o) => /\.(png|jpe?g|webp)$/i.test(o.name || ''))
    .map((o) => `${prefix}${o.name}`)
    .sort()

  if (!pagePaths.length) throw new Error('Nenhuma página PNG encontrada no Storage.')
  console.log(`Páginas: ${pagePaths.length}`)

  await admin
    .from('quote_analyses')
    .update({ status: 'EXTRACTING_MODULES', error_message: null, updated_at: new Date().toISOString() })
    .eq('id', ANALYSIS_ID)

  console.log('Chamando Edge orcamentos-ia-pipeline (pode levar vários minutos)…')
  const edgeRes = await fetch(`${url}/functions/v1/orcamentos-ia-pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: anonKey || serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      analysisId: ANALYSIS_ID,
      companyId: analysis.company_id,
      mode: analysis.mode === 'pro' ? 'pro' : 'max',
      pagePaths,
    }),
  })

  const payload = await edgeRes.json()
  if (!edgeRes.ok || !payload?.ok) {
    throw new Error(payload?.error || `Edge HTTP ${edgeRes.status}`)
  }

  const extraction = sanitizeExtraction(payload.extraction)
  const inventory = payload.inventory || []
  const coverage = payload.coverage || null
  console.log('Inventário:', JSON.stringify(inventory, null, 2))
  console.log('Cobertura:', JSON.stringify(coverage, null, 2))
  console.log(
    'Ambientes extraídos:',
    (extraction?.environments || []).map((e) => ({
      name: e.name,
      modules: (e.modules || []).map((m) => ({
        name: m.name,
        dimensions: m.dimensions ?? null,
      })),
    })),
  )

  // Limpa árvore antiga
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
  for (const [ei, env] of (extraction.environments || []).entries()) {
    const { data: envRow, error: envErr } = await admin
      .from('quote_environments')
      .insert({ analysis_id: ANALYSIS_ID, name: env.name, sort_order: ei })
      .select('id')
      .single()
    if (envErr) throw new Error(envErr.message)

    for (const [mi, mod] of (env.modules || []).entries()) {
      const companyId = analysis.company_id
      const analysisId = ANALYSIS_ID
      const pagePath = (page) =>
        page && Number(page) >= 1
          ? `${companyId}/${analysisId}/pages/page-${String(Math.floor(Number(page))).padStart(3, '0')}.jpg`
          : null
      const modPage = mod.bounding_box?.page ?? null

      const { data: modRow, error: modErr } = await admin
        .from('quote_modules')
        .insert({
          environment_id: envRow.id,
          name: mod.name,
          description: mod.description ?? null,
          dimensions: mod.dimensions ?? {},
          bounding_box: mod.bounding_box ?? null,
          page_number: modPage,
          page_image_path: pagePath(modPage),
          sort_order: mi,
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
          page_image_path: pagePath(page),
        })
      }

      for (const piece of mod.caixaria || []) {
        const p = contingencyPrice(piece.material_name, 'chapa')
        pushRow(
          {
            module_id: modRow.id,
            raw_name: `${piece.name} — ${piece.material_name}`,
            category: 'chapa',
            using_market_price: p.market,
            market_price_confirmed: false,
            unit_price: p.unitPrice,
            exact_quantity: piece.quantity || 1,
            full_units_quantity: Math.ceil(piece.quantity || 1),
            unit_measure: p.unit,
            notes: `função=${piece.function}`,
          },
          piece.bounding_box,
        )
      }
      for (const frente of mod.frentes_portas || []) {
        const p = contingencyPrice(frente.material_name, 'chapa')
        pushRow(
          {
            module_id: modRow.id,
            raw_name: `${frente.name} — ${frente.material_name}`,
            category: 'chapa',
            using_market_price: p.market,
            market_price_confirmed: false,
            unit_price: p.unitPrice,
            exact_quantity: frente.quantity || 1,
            full_units_quantity: Math.ceil(frente.quantity || 1),
            unit_measure: p.unit,
            notes: `tipo=${frente.kind}`,
          },
          frente.bounding_box,
        )
      }
      for (const fita of mod.fitas_borda_m || []) {
        const p = contingencyPrice(fita.tape_name, 'fita_borda')
        pushRow(
          {
            module_id: modRow.id,
            raw_name: fita.tape_name,
            category: 'fita_borda',
            using_market_price: p.market,
            market_price_confirmed: false,
            unit_price: p.unitPrice,
            exact_quantity: fita.meters || 1,
            full_units_quantity: Math.ceil(fita.meters || 1),
            unit_measure: 'm',
          },
          fita.bounding_box,
        )
      }
      for (const ferr of mod.ferragens || []) {
        const p = contingencyPrice(ferr.raw_name, ferr.category || 'ferragem')
        pushRow(
          {
            module_id: modRow.id,
            raw_name: ferr.raw_name,
            category: ferr.category || 'ferragem',
            using_market_price: p.market,
            market_price_confirmed: false,
            unit_price: p.unitPrice,
            exact_quantity: ferr.exact_quantity || 1,
            full_units_quantity: ferr.full_units_quantity || Math.ceil(ferr.exact_quantity || 1),
            unit_measure: ferr.unit_measure || 'un',
            notes: ferr.notes ?? null,
          },
          ferr.bounding_box,
        )
      }

      if (!rows.length) {
        const p = contingencyPrice('Fora de escopo', 'consumivel')
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

      const { error: matErr } = await admin.from('quote_materials').insert(rows)
      if (matErr) throw new Error(matErr.message)
      materialsSaved += rows.length
    }
  }

  await admin
    .from('quote_analyses')
    .update({
      status: 'COMPLETED',
      error_message: null,
      updated_at: new Date().toISOString(),
      totals: {
        materials_count: materialsSaved,
        environments: (extraction.environments || []).length,
        modules: (extraction.environments || []).reduce((n, e) => n + (e.modules?.length || 0), 0),
        inventory,
        coverage,
        auditor_notes: extraction.auditor_notes || [],
        warnings: extraction.warnings || [],
        pages_processed: pagePaths.length,
        reprocessed_at: new Date().toISOString(),
      },
    })
    .eq('id', ANALYSIS_ID)

  console.log(`OK — ${materialsSaved} materiais gravados.`)
}

main().catch((err) => {
  console.error('FALHA:', err.message || err)
  process.exit(1)
})
