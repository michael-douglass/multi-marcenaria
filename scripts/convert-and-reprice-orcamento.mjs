/**
 * Converte PDF→JPEG (Playwright/canvas), extrai via Edge e precifica com estoque.
 * Uso: node --env-file=.env scripts/convert-and-reprice-orcamento.mjs [analysisId]
 */
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const ANALYSIS_ID = process.argv[2] || '338bd682-9d91-493a-9448-9fd963a14515'
const MAX_PAGES = 40
const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !serviceKey) {
  console.error('Faltam VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey)

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
  if (cat === 'fita_borda' || n.includes('fita')) return { unitPrice: 2.5, unit: 'm', market: true, source: 'contingency', matched: null }
  if (n.includes('dobradica')) return { unitPrice: 15, unit: 'un', market: true, source: 'contingency', matched: null }
  if (n.includes('corredica')) return { unitPrice: 45, unit: 'par', market: true, source: 'contingency', matched: null }
  if (n.includes('puxador') || n.includes('perfil')) return { unitPrice: 85, unit: 'barra', market: true, source: 'contingency', matched: null }
  if (cat === 'chapa' || n.includes('mdf') || n.includes('chapa')) {
    return { unitPrice: 220, unit: 'chapa', market: true, source: 'contingency', matched: null }
  }
  return { unitPrice: 25, unit: 'un', market: true, source: 'contingency', matched: null }
}

function resolveFromInventory(inventory, name, category) {
  let best = null
  for (const row of inventory) {
    if (category && row.category && row.category !== category && category !== 'outro') {
      // still allow cross-category soft match with lower score
    }
    const score = scoreMatch(row.name, name)
    const catBonus = category && row.category === category ? 8 : 0
    const total = score + catBonus
    if (total < 28) continue
    if (!best || total > best.score) best = { score: total, row }
  }
  if (!best) return contingencyPrice(name, category)

  const row = best.row
  const cat = (row.category || '').toLowerCase()
  let unitPrice = Number(row.unit_price) || 0
  let unit = row.unit || 'un'
  if (cat === 'chapa') {
    unitPrice = Number(row.price_per_sheet) || Number(row.unit_price) || Number(row.price_per_m2) || 0
    unit = 'chapa'
  }
  if (!(unitPrice > 0)) return contingencyPrice(name, category)
  return {
    unitPrice,
    unit,
    market: false,
    source: 'inventory',
    matched: row.name,
    inventoryItemId: row.id,
  }
}

async function convertPdfToJpegs(pdfBytes) {
  const tmpPdf = join(tmpdir(), `orc-ia-${Date.now()}.pdf`)
  writeFileSync(tmpPdf, Buffer.from(pdfBytes))
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent(`<!DOCTYPE html><html><body>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs" type="module"></script>
      <script type="module">
        import * as pdfjs from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs'
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs'
        window.__pdfjs = pdfjs
        window.__ready = true
      </script>
    </body></html>`)
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 })

    const pdfB64 = Buffer.from(pdfBytes).toString('base64')
    const pages = await page.evaluate(
      async ({ b64, maxPages, maxEdge, quality }) => {
        const pdfjs = window.__pdfjs
        const raw = atob(b64)
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
        const pdf = await pdfjs.getDocument({ data: bytes }).promise
        const total = Math.min(pdf.numPages, maxPages)
        const out = []
        for (let n = 1; n <= total; n++) {
          const pg = await pdf.getPage(n)
          let viewport = pg.getViewport({ scale: 1.5 })
          if (Math.max(viewport.width, viewport.height) > maxEdge) {
            const scale = 1.5 * (maxEdge / Math.max(viewport.width, viewport.height))
            viewport = pg.getViewport({ scale })
          }
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          await pg.render({ canvasContext: ctx, viewport, canvas }).promise
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          out.push({ page: n, total, dataUrl })
          pg.cleanup?.()
        }
        await pdf.destroy()
        return out
      },
      { b64: pdfB64, maxPages: MAX_PAGES, maxEdge: 1600, quality: 0.82 },
    )
    return pages
  } finally {
    await browser.close()
    try {
      unlinkSync(tmpPdf)
    } catch {
      /* ignore */
    }
  }
}

function dataUrlToBlobBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  return Buffer.from(base64, 'base64')
}

async function main() {
  console.log('=== Convert + reprice', ANALYSIS_ID)

  const { data: analysis, error: aErr } = await admin
    .from('quote_analyses')
    .select('id, company_id, mode, source_pdf_path, status')
    .eq('id', ANALYSIS_ID)
    .single()
  if (aErr || !analysis) throw new Error(aErr?.message || 'Análise não encontrada')
  if (!analysis.source_pdf_path) throw new Error('Sem PDF fonte')

  console.log('Status atual:', analysis.status)
  console.log('Baixando PDF…')
  const { data: pdfBlob, error: dlErr } = await admin.storage
    .from('orcamentos-ia')
    .download(analysis.source_pdf_path)
  if (dlErr || !pdfBlob) throw new Error(dlErr?.message || 'Falha ao baixar PDF')
  const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer())
  console.log('PDF bytes:', pdfBytes.byteLength)

  const pagesPrefix = `${analysis.company_id}/${ANALYSIS_ID}/pages`
  const { data: existingObjs } = await admin.storage
    .from('orcamentos-ia')
    .list(pagesPrefix, { limit: 80, sortBy: { column: 'name', order: 'asc' } })
  let pagePaths = (existingObjs || [])
    .filter((o) => /\.(jpe?g|png|webp)$/i.test(o.name || ''))
    .map((o) => `${pagesPrefix}/${o.name}`)
    .sort()

  if (pagePaths.length === 0) {
    await admin
      .from('quote_analyses')
      .update({
        status: 'CONVERTING_PAGES',
        error_message: null,
        updated_at: new Date().toISOString(),
        totals: {
          pipeline_stage: 'converting_pages',
          pipeline_detail: 'Convertendo PDF página a página (smoke script)…',
          pipeline_updated_at: new Date().toISOString(),
        },
      })
      .eq('id', ANALYSIS_ID)

    console.log('Convertendo com Playwright…')
    const pages = await convertPdfToJpegs(pdfBytes)
    console.log(`Páginas geradas: ${pages.length}`)

    pagePaths = []
    for (const p of pages) {
      const path = `${analysis.company_id}/${ANALYSIS_ID}/pages/page-${String(p.page).padStart(3, '0')}.jpg`
      const bytes = dataUrlToBlobBytes(p.dataUrl)
      const { error: upErr } = await admin.storage.from('orcamentos-ia').upload(path, bytes, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      })
      if (upErr) throw new Error(`Upload página ${p.page}: ${upErr.message}`)
      pagePaths.push(path)
      if (p.page === 1 || p.page % 3 === 0 || p.page === pages.length) {
        console.log(`  ↑ página ${p.page}/${pages.length} (${bytes.length} bytes)`)
        await admin
          .from('quote_analyses')
          .update({
            status: 'CONVERTING_PAGES',
            updated_at: new Date().toISOString(),
            totals: {
              pipeline_stage: 'converting_pages',
              pipeline_detail: `Transformando página ${p.page} de ${pages.length}…`,
              pages_processed: p.page,
              pages_total: pages.length,
              pipeline_updated_at: new Date().toISOString(),
            },
          })
          .eq('id', ANALYSIS_ID)
      }
    }
  } else {
    console.log(`Reusando ${pagePaths.length} página(s) já no Storage.`)
  }

  // Gateway Supabase ~150–300s: com muitos lotes pode 504 — usa até 8 páginas se necessário
  const edgePaths = pagePaths.length > 8 ? pagePaths.slice(0, 8) : pagePaths
  if (edgePaths.length < pagePaths.length) {
    console.log(`Edge com ${edgePaths.length}/${pagePaths.length} páginas (evitar timeout do gateway).`)
  }

  await admin
    .from('quote_analyses')
    .update({
      status: 'EXTRACTING_MODULES',
      error_message: null,
      updated_at: new Date().toISOString(),
      totals: {
        pipeline_stage: 'extracting_batch',
        pipeline_detail: 'Chamando Extrator na Edge…',
        pages_processed: pagePaths.length,
        pipeline_updated_at: new Date().toISOString(),
      },
    })
    .eq('id', ANALYSIS_ID)

  console.log('Chamando Edge orcamentos-ia-pipeline…')
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
      pagePaths: edgePaths,
    }),
  })
  const payload = await edgeRes.json()
  if (!edgeRes.ok || !payload?.ok) {
    throw new Error(payload?.error || `Edge HTTP ${edgeRes.status}`)
  }

  const extraction = payload.extraction
  const inventoryReport = payload.inventory || []
  const coverage = payload.coverage || null
  console.log(
    'Ambientes:',
    (extraction?.environments || []).map((e) => ({
      name: e.name,
      modules: (e.modules || []).length,
    })),
  )

  const { data: invRows } = await admin
    .from('inventory_items')
    .select('id, name, category, unit, unit_price, price_per_sheet, price_per_m2, active')
    .or(`company_id.eq.${analysis.company_id},company_id.is.null`)
    .eq('active', true)
  const inventory = invRows || []
  console.log('Itens de estoque para match:', inventory.length)

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
  let totalEstimate = 0
  const samples = []

  for (const [ei, env] of (extraction.environments || []).entries()) {
    const { data: envRow, error: envErr } = await admin
      .from('quote_environments')
      .insert({ analysis_id: ANALYSIS_ID, name: env.name, sort_order: ei })
      .select('id')
      .single()
    if (envErr) throw new Error(envErr.message)

    for (const [mi, mod] of (env.modules || []).entries()) {
      const modPage = mod.bounding_box?.page ?? null
      const pagePath = (page) =>
        page && Number(page) >= 1
          ? `${analysis.company_id}/${ANALYSIS_ID}/pages/page-${String(Math.floor(Number(page))).padStart(3, '0')}.jpg`
          : null

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
        const p = resolveFromInventory(inventory, piece.material_name, 'chapa')
        if (p.source === 'inventory') inventoryHits++
        else contingencyHits++
        const qty = piece.quantity || 1
        totalEstimate += p.unitPrice * Math.ceil(qty)
        if (samples.length < 12) {
          samples.push({
            raw: `${piece.name} — ${piece.material_name}`,
            price: p.unitPrice,
            source: p.source,
            matched: p.matched,
          })
        }
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
      for (const frente of mod.frentes_portas || []) {
        const p = resolveFromInventory(inventory, frente.material_name, 'chapa')
        if (p.source === 'inventory') inventoryHits++
        else contingencyHits++
        const qty = frente.quantity || 1
        totalEstimate += p.unitPrice * Math.ceil(qty)
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
      for (const fita of mod.fitas_borda_m || []) {
        const p = resolveFromInventory(inventory, fita.tape_name, 'fita_borda')
        if (p.source === 'inventory') inventoryHits++
        else contingencyHits++
        const meters = fita.meters || 1
        totalEstimate += p.unitPrice * Math.ceil(meters)
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
      for (const ferr of mod.ferragens || []) {
        const cat = ferr.category || 'ferragem'
        const p = resolveFromInventory(inventory, ferr.raw_name, cat)
        if (p.source === 'inventory') inventoryHits++
        else contingencyHits++
        const qty = ferr.exact_quantity || 1
        const full = ferr.full_units_quantity || Math.ceil(qty)
        totalEstimate += p.unitPrice * full
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

      if (!rows.length) {
        const p = contingencyPrice('Fora de escopo', 'consumivel')
        contingencyHits++
        totalEstimate += p.unitPrice
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
        inventory: inventoryReport,
        coverage,
        auditor_notes: extraction.auditor_notes || [],
        warnings: extraction.warnings || [],
        pages_processed: pagePaths.length,
        pricing_inventory_hits: inventoryHits,
        pricing_contingency_hits: contingencyHits,
        total_estimate: Math.round(totalEstimate * 100) / 100,
        pipeline_stage: 'completed',
        pipeline_detail: 'Análise concluída com preços.',
        pipeline_updated_at: new Date().toISOString(),
        smoke_reprocessed_at: new Date().toISOString(),
      },
    })
    .eq('id', ANALYSIS_ID)

  console.log('\n=== RESULTADO ===')
  console.log(`Materiais: ${materialsSaved}`)
  console.log(`Match estoque: ${inventoryHits} | Contingência: ${contingencyHits}`)
  console.log(`Total estimado: R$ ${totalEstimate.toFixed(2)}`)
  console.log('Amostras de preço:')
  for (const s of samples) {
    console.log(
      `  - ${s.raw.slice(0, 60)} → R$ ${s.price} (${s.source}${s.matched ? ` ≈ ${s.matched}` : ''})`,
    )
  }
  console.log(`\nAbrir Audit Workspace: /orcamentos-ia?audit=${ANALYSIS_ID}`)
}

main().catch((err) => {
  console.error('FALHA:', err.message || err)
  process.exit(1)
})
