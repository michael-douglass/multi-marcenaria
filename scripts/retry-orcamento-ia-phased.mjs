/**
 * Reprocessa análise em fases (inventory → extract lotes → audit) até COMPLETED.
 * Uso: node --env-file=.env scripts/retry-orcamento-ia-phased.mjs [analysisId]
 */
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const ANALYSIS_ID = process.argv[2] || '287a24e0-0ec5-4a02-aa2a-c09b7ac72a0e'
const MAX_ATTEMPTS = 3
const EXTRACT_BATCH = 6
const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !serviceKey) {
  console.error('Faltam VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function asArr(v) {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []
}

function isDiningTableHint(nameKey, descKey, h, d, w) {
  const blob = `${nameKey} ${descKey}`
  if (/jantar|belize|organico|escrivaninha|tampo organico|mesa de jantar/.test(blob)) return true
  if (h >= 700 && h <= 820 && (d >= 900 || w >= 2400)) return true
  return false
}

/** Remove módulos vazios / corrige mesa↔bancada / separa Lavabo. */
function pruneExtraction(raw) {
  if (!raw || typeof raw !== 'object') return { environments: [], auditor_notes: [], warnings: [] }
  const notes = [...(Array.isArray(raw.auditor_notes) ? raw.auditor_notes : [])]
  const warnings = [...(Array.isArray(raw.warnings) ? raw.warnings : [])]
  const buckets = new Map()

  const put = (envName, mod) => {
    const key = normalizeKey(envName)
    const prev = buckets.get(key)
    if (!prev) {
      buckets.set(key, { name: envName, modules: [mod] })
      return
    }
    prev.modules.push(mod)
  }

  for (const env of asArr(raw.environments)) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    const envKey = normalizeKey(envName)
    for (const mod of asArr(env.modules)) {
      if (mod.out_of_scope !== true) {
        const total =
          asArr(mod.caixaria).length +
          asArr(mod.frentes_portas).length +
          asArr(mod.ferragens).length +
          asArr(mod.fitas_borda_m).length
        if (total === 0) {
          notes.push(`Removido "${mod.name || 'Modulo'}": sem materiais`)
          continue
        }
      }

      let modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const nameKey = normalizeKey(modName)
      const descKey = normalizeKey(typeof mod.description === 'string' ? mod.description : '')
      const dims = mod.dimensions && typeof mod.dimensions === 'object' ? mod.dimensions : null
      const h = Number(dims?.height_mm) || 0
      const d = Number(dims?.depth_mm) || 0
      const w = Number(dims?.width_mm) || 0

      if (
        /bancada/.test(nameKey) &&
        !/lavabo|pia|cooktop|ilha|churras/.test(`${nameKey} ${descKey}`) &&
        isDiningTableHint(nameKey, descKey, h, d, w)
      ) {
        const renamed = modName.replace(/bancada/gi, 'Mesa')
        notes.push(`Renomeado "${modName}" → "${renamed}"`)
        modName = renamed
      } else if (
        /\bmesa\b/.test(nameKey) &&
        !/jantar|belize|organico|escrivaninha|cabeceira|centro/.test(nameKey) &&
        !isDiningTableHint(nameKey, descKey, h, d, w) &&
        ((h >= 850 && h <= 980 && d >= 500 && d <= 750) ||
          /cooktop|pia|churras|bancada|ilha/.test(`${nameKey} ${descKey}`))
      ) {
        const renamed = modName.replace(/mesa/gi, 'Bancada')
        notes.push(`Renomeado "${modName}" → "${renamed}"`)
        modName = renamed
      }

      if (/guarda.?roupa|roupeiro|cabeceira/.test(normalizeKey(modName)) && /gourmet|cozinha|lavabo/.test(envKey)) {
        notes.push(`Removido "${modName}" de "${envName}" (tipologia de quarto)`)
        continue
      }

      let target = envName
      if (/lavabo/.test(normalizeKey(modName)) || /lavabo/.test(descKey)) target = 'Lavabo'
      else if (/gourmet|espaco gourmet/.test(envKey)) target = 'Espaço Gourmet'

      put(target, { ...mod, name: modName })
    }
  }

  return {
    ...raw,
    environments: [...buckets.values()].filter((e) => asArr(e.modules).length > 0),
    auditor_notes: [...new Set(notes)],
    warnings: [...new Set(warnings)],
  }
}

const BOX_MODULE_RE =
  /ilha|balcao|bancada|armario|torre|cristaleira|gaveteiro|aereo|roupeiro|paneleiro/

/** Completa caixaria mínima (laterais/base/fundo/tampo) quando a IA devolve 1 peça. */
function enrichMinimalCaixaria(mod) {
  if (mod.out_of_scope === true) return mod
  const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
  const nameKey = normalizeKey(name)
  if (!BOX_MODULE_RE.test(nameKey)) return mod

  const dims = mod.dimensions && typeof mod.dimensions === 'object' ? mod.dimensions : {}
  let caixaria = asArr(mod.caixaria)
  const first = caixaria[0] || {}
  const mat = typeof first.material_name === 'string' ? first.material_name : 'MDF 15mm'
  const thickness = Number(first.thickness_mm) > 0 ? Number(first.thickness_mm) : 15
  const w = Number(dims.width_mm) > 0 ? Number(dims.width_mm) : Number(first.width_mm) > 0 ? Number(first.width_mm) : 800
  const h = Number(dims.height_mm) > 0 ? Number(dims.height_mm) : Number(first.height_mm) > 0 ? Number(first.height_mm) : 720
  const d = Number(dims.depth_mm) > 0 ? Number(dims.depth_mm) : 500
  const openFront = /ilha|bancada/.test(nameKey)
  const hasFn = (fn) => caixaria.some((c) => c.function === fn)
  const bandFront = (meters) => ({
    C1: true,
    C2: false,
    L1: false,
    L2: false,
    tape_name: 'Fita 22 mm',
    meters,
  })

  if (!hasFn('lateral')) {
    caixaria.push({
      name: 'Lateral esquerda',
      function: 'lateral',
      width_mm: d,
      height_mm: h,
      thickness_mm: thickness,
      material_name: mat,
      quantity: 1,
      edge_banding: bandFront(Math.round((h / 1000) * 1000) / 1000),
      dimensions_estimated: true,
    })
    caixaria.push({
      name: 'Lateral direita',
      function: 'lateral',
      width_mm: d,
      height_mm: h,
      thickness_mm: thickness,
      material_name: mat,
      quantity: 1,
      edge_banding: bandFront(Math.round((h / 1000) * 1000) / 1000),
      dimensions_estimated: true,
    })
  }
  if (!hasFn('base')) {
    caixaria.push({
      name: 'Base',
      function: 'base',
      width_mm: w,
      height_mm: d,
      thickness_mm: thickness,
      material_name: mat,
      quantity: 1,
      edge_banding: bandFront(Math.round((w / 1000) * 1000) / 1000),
      dimensions_estimated: true,
    })
  }
  if (!hasFn('fundo') && !openFront) {
    caixaria.push({
      name: 'Fundo',
      function: 'fundo',
      width_mm: w,
      height_mm: h,
      thickness_mm: 6,
      material_name: 'MDF 6mm',
      quantity: 1,
      edge_banding: { C1: false, C2: false, L1: false, L2: false, meters: 0 },
      dimensions_estimated: true,
    })
  }
  if (!hasFn('tampo') && !hasFn('sarrafo') && openFront) {
    caixaria.push({
      name: 'Tampo',
      function: 'tampo',
      width_mm: w,
      height_mm: d,
      thickness_mm: thickness,
      material_name: mat,
      quantity: 1,
      edge_banding: {
        C1: true,
        C2: true,
        L1: true,
        L2: true,
        tape_name: 'Fita 22 mm',
        meters: Math.round(((2 * (w + d)) / 1000) * 1000) / 1000,
      },
      dimensions_estimated: true,
    })
  }

  let fitas = asArr(mod.fitas_borda_m)
  if (!fitas.length) {
    let meters = 0
    for (const p of caixaria) {
      const m = Number(p.edge_banding?.meters)
      if (Number.isFinite(m) && m > 0) meters += m * (Number(p.quantity) || 1)
    }
    if (meters > 0) fitas = [{ tape_name: 'Fita 22 mm', meters: Math.round(meters * 1000) / 1000 }]
  }

  return {
    ...mod,
    caixaria,
    fitas_borda_m: fitas,
    dimensions: { width_mm: w, height_mm: h, depth_mm: d, ...dims },
  }
}

function enrichExtraction(raw) {
  if (!raw || typeof raw !== 'object') return raw
  return {
    ...raw,
    environments: asArr(raw.environments).map((env) => ({
      ...env,
      modules: asArr(env.modules).map(enrichMinimalCaixaria),
    })),
  }
}

function contingencyPrice(name, category) {
  const n = normalizeKey(name)
  const cat = String(category || '').toLowerCase()
  if (cat === 'fita_borda' || n.includes('fita')) return { unitPrice: 1.3, unit: 'm', market: true }
  if (n.includes('dobradica')) return { unitPrice: 20, unit: 'un', market: true }
  if (n.includes('corredica')) return { unitPrice: 75, unit: 'un', market: true }
  if (n.includes('minifix')) return { unitPrice: 1, unit: 'un', market: true }
  if (cat === 'chapa' || n.includes('mdf') || n.includes('chapa')) {
    return { unitPrice: 280, unit: 'chapa', market: true }
  }
  return { unitPrice: 25, unit: 'un', market: true }
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
  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.error || `Edge HTTP ${res.status}`)
  }
  return payload
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function persistTree(analysisId, companyId, extraction, inventory, coverage, pagePaths) {
  const { data: oldEnvs } = await admin
    .from('quote_environments')
    .select('id')
    .eq('analysis_id', analysisId)
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
      .insert({ analysis_id: analysisId, name: env.name, sort_order: ei })
      .select('id')
      .single()
    if (envErr) throw new Error(envErr.message)

    for (const [mi, mod] of (env.modules || []).entries()) {
      const pagePath = (page) =>
        page && Number(page) >= 1
          ? `${companyId}/${analysisId}/pages/page-${String(Math.floor(Number(page))).padStart(3, '0')}.jpg`
          : null
      const modPage = mod.bounding_box?.page ?? mod.page_number ?? null
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
          out_of_scope: mod.out_of_scope === true,
        })
        .select('id')
        .single()
      if (modErr) throw new Error(modErr.message)

      const rows = []
      const push = (row, bbox) => {
        const page = bbox?.page ?? modPage
        rows.push({
          ...row,
          bounding_box: bbox ?? mod.bounding_box ?? null,
          page_image_path: pagePath(page),
        })
      }

      for (const piece of mod.caixaria || []) {
        const p = contingencyPrice(piece.material_name, 'chapa')
        push(
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
            notes: `função=${piece.function || ''}`,
          },
          piece.bounding_box,
        )
      }
      for (const frente of mod.frentes_portas || []) {
        const p = contingencyPrice(frente.material_name, 'chapa')
        push(
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
            notes: `tipo=${frente.kind || ''}`,
          },
          frente.bounding_box,
        )
      }
      for (const fita of mod.fitas_borda_m || []) {
        const p = contingencyPrice(fita.tape_name, 'fita_borda')
        push(
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
        push(
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

      if (rows.length) {
        const { error: matErr } = await admin.from('quote_materials').insert(rows)
        if (matErr) throw new Error(matErr.message)
        materialsSaved += rows.length
      }
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
        pricing_note: 'v11: venda apenas por BOM — reprocess phased retry',
      },
    })
    .eq('id', analysisId)

  return materialsSaved
}

async function runOnce(analysis) {
  const prefix = `${analysis.company_id}/${analysis.id}/pages/`
  const { data: objects, error: listErr } = await admin.storage
    .from('orcamentos-ia')
    .list(`${analysis.company_id}/${analysis.id}/pages`, {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    })
  if (listErr) throw new Error(listErr.message)

  const pagePaths = (objects || [])
    .filter((o) => /\.(png|jpe?g|webp)$/i.test(o.name || ''))
    .map((o) => `${prefix}${o.name}`)
    .sort()
  if (!pagePaths.length) throw new Error('Nenhuma página no Storage.')

  console.log(`Páginas: ${pagePaths.length}`)
  const mode = analysis.mode === 'pro' ? 'pro' : 'max'
  const base = {
    analysisId: analysis.id,
    companyId: analysis.company_id,
    mode,
  }

  await admin
    .from('quote_analyses')
    .update({
      status: 'READING_LAYOUT',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', analysis.id)

  console.log('Fase inventory…')
  // Envia TODAS as páginas — a Edge amostra capa+meio+fim (Lavabo fica nas pranchas do meio)
  const inv = await invokePhase({
    ...base,
    pagePaths,
    phase: 'inventory',
  })
  const inventory = Array.isArray(inv.inventory) ? inv.inventory : []
  console.log('Inventário ambientes:', inventory.length, JSON.stringify(inventory))

  const batches = chunk(pagePaths, EXTRACT_BATCH)
  const parts = []
  for (let i = 0; i < batches.length; i++) {
    console.log(`Extract lote ${i + 1}/${batches.length}…`)
    await admin
      .from('quote_analyses')
      .update({
        status: 'EXTRACTING_MODULES',
        updated_at: new Date().toISOString(),
        totals: {
          pipeline_stage: 'extracting_batch',
          pipeline_detail: `Lote ${i + 1}/${batches.length}`,
        },
      })
      .eq('id', analysis.id)
    const part = await invokePhase({
      ...base,
      pagePaths: batches[i],
      phase: 'extract',
      inventory,
    })
    if (part.extraction) parts.push(part.extraction)
  }

  // merge raso: concat environments
  let extraction = { environments: [], auditor_notes: [], warnings: [] }
  for (const part of parts) {
    for (const env of asArr(part.environments)) {
      const name = env.name || 'Ambiente'
      let target = extraction.environments.find((e) => normalizeKey(e.name) === normalizeKey(name))
      if (!target) {
        target = { name, modules: [] }
        extraction.environments.push(target)
      }
      for (const mod of asArr(env.modules)) {
        const exists = target.modules.some((m) => normalizeKey(m.name) === normalizeKey(mod.name))
        if (!exists) target.modules.push(mod)
      }
    }
    for (const n of part.auditor_notes || []) if (typeof n === 'string') extraction.auditor_notes.push(n)
    for (const w of part.warnings || []) if (typeof w === 'string') extraction.warnings.push(w)
  }

  if (mode === 'max') {
    console.log('Fase audit (até 3 passagens na Edge)…')
    await admin
      .from('quote_analyses')
      .update({
        status: 'AUDITING_REVISION',
        updated_at: new Date().toISOString(),
        totals: { pipeline_stage: 'auditing', pipeline_detail: 'Auditoria anti-alucinação…' },
      })
      .eq('id', analysis.id)
    try {
      const aud = await invokePhase({
        ...base,
        pagePaths: pagePaths.slice(0, 24),
        phase: 'audit',
        inventory,
        extraction,
      })
      if (aud.extraction) extraction = aud.extraction
      console.log('Audit passes:', aud.auditPasses, 'score:', aud.hallucinationScore)
    } catch (e) {
      console.warn('Audit falhou, seguindo com extração:', e.message)
      extraction.warnings.push(`Auditoria incompleta: ${e.message}`)
    }
  }

  extraction = enrichExtraction(pruneExtraction(extraction))
  if (!extraction.environments.length) {
    throw new Error('Após limpeza, nenhum ambiente com materiais restou.')
  }

  console.log(
    'Módulos finais:',
    extraction.environments.map((e) => ({
      env: e.name,
      mods: (e.modules || []).map((m) => m.name),
    })),
  )

  const materialsSaved = await persistTree(
    analysis.id,
    analysis.company_id,
    extraction,
    inventory,
    null,
    pagePaths,
  )
  console.log(`COMPLETED — ${materialsSaved} materiais`)
  return materialsSaved
}

async function main() {
  console.log('Retry phased', ANALYSIS_ID)
  const { data: analysis, error } = await admin
    .from('quote_analyses')
    .select('id, company_id, mode, source_pdf_path, status')
    .eq('id', ANALYSIS_ID)
    .single()
  if (error || !analysis) throw new Error(error?.message || 'Análise não encontrada')

  let lastErr = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`\n=== Tentativa ${attempt}/${MAX_ATTEMPTS} ===`)
    try {
      await runOnce(analysis)
      lastErr = null
      break
    } catch (err) {
      lastErr = err
      console.error('Falhou:', err.message || err)
      await admin
        .from('quote_analyses')
        .update({
          status: 'FAILED',
          error_message: String(err.message || err).slice(0, 500),
          updated_at: new Date().toISOString(),
          totals: {
            pipeline_stage: 'failed',
            pipeline_detail: String(err.message || err).slice(0, 250),
          },
        })
        .eq('id', ANALYSIS_ID)
    }
  }

  if (lastErr) {
    console.error('Esgotaram as tentativas.')
    process.exit(1)
  }

  // v11.3: desmonte determinístico → bom_items (caminho Edge/retry não passa pelo pipeline client)
  console.log('\nPersistindo bom_items…')
  const bomRun = spawnSync(
    process.execPath,
    ['--env-file=.env', 'scripts/persist-bom-items.mjs', ANALYSIS_ID],
    { stdio: 'inherit', cwd: process.cwd(), env: process.env },
  )
  if (bomRun.status !== 0) {
    console.error('Falha ao persistir bom_items (exit', bomRun.status, ')')
    process.exit(bomRun.status || 1)
  }

  const { data: final } = await admin
    .from('quote_analyses')
    .select('id, status, totals')
    .eq('id', ANALYSIS_ID)
    .single()
  console.log('\nStatus final:', final?.status, 'módulos:', final?.totals?.modules)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
