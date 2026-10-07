/**
 * Injeta Painel TV (pág. 6) + BOM/chapa no orçamento atual e corrige páginas conhecidas.
 */
import { createClient } from '@supabase/supabase-js'

const ANALYSIS_ID = '4b7ce4a9-73f5-47e8-8ce2-575d30e16028'
const COMPANY = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'
const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const SHEET_AREA = 5.0875
const LOSS = 1.15
const CUTTING = 'corte-peca'

async function invoke(body) {
  const res = await fetch(`${url}/functions/v1/orcamentos-ia-pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: anon || serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`)
  return j
}

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
  const hits = tb.filter((t) => [...ta].some((x) => x === t || x.includes(t) || t.includes(x))).length
  return tb.length ? Math.round((hits / tb.length) * 80) : 0
}

async function resolveChapa(name) {
  const { data: inv } = await admin
    .from('inventory_items')
    .select('id,name,unit_price,price_per_sheet,price_per_m2,unit,category')
    .eq('active', true)
    .eq('category', 'chapa')
    .or(`company_id.eq.${COMPANY},company_id.is.null`)
    .limit(500)
  let best = null
  for (const row of inv || []) {
    const s = scoreMatch(row.name, name)
    if (s < 28) continue
    if (!best || s > best.s) best = { s, row }
  }
  if (best) {
    const unitPrice =
      Number(best.row.price_per_sheet) || Number(best.row.unit_price) || Number(best.row.price_per_m2) || 0
    if (unitPrice > 0) {
      return { unitPrice, id: best.row.id, usingMarket: false, matched: best.row.name }
    }
  }
  const amadeirado = /noite|freijo|amadeir/.test(norm(name))
  return { unitPrice: amadeirado ? 500 : 280, id: null, usingMarket: true, matched: 'média' }
}

const folder = `${COMPANY}/${ANALYSIS_ID}/pages`
const paths = [5, 6, 7, 8].map((n) => `${folder}/page-${String(n).padStart(3, '0')}.jpg`)
const inventory = [
  { environment: 'Espaço Gourmet', modules: ['Ilha', 'Armário', 'Cristaleira', 'Bancada', 'Painel TV'] },
  { environment: 'Lavabo', modules: ['Bancada Lavabo'] },
]

console.log('extract…')
const part = await invoke({
  analysisId: ANALYSIS_ID,
  companyId: COMPANY,
  mode: 'max',
  pagePaths: paths,
  phase: 'extract',
  inventory,
})

const painel = (part.extraction?.environments || [])
  .flatMap((e) => (e.modules || []).map((m) => ({ env: e.name, mod: m })))
  .find((x) => /painel/i.test(x.mod?.name || ''))
if (!painel) throw new Error('Painel TV não veio na extração')

console.log('Painel', painel.mod.name, painel.mod.bounding_box)

const { data: envs } = await admin.from('quote_environments').select('id,name').eq('analysis_id', ANALYSIS_ID)
let gourmet = envs.find((e) => /gourmet/i.test(e.name))
if (!gourmet) {
  const { data: created } = await admin
    .from('quote_environments')
    .insert({ analysis_id: ANALYSIS_ID, name: 'Espaço Gourmet', sort_order: 0 })
    .select('id,name')
    .single()
  gourmet = created
}

const { data: existingMods } = await admin
  .from('quote_modules')
  .select('id,name')
  .eq('environment_id', gourmet.id)
const already = existingMods?.find((m) => /painel/i.test(m.name))
if (already) {
  console.log('Painel já existe', already.id, '— atualizando página')
  await admin
    .from('quote_modules')
    .update({
      page_number: 6,
      page_image_path: `${folder}/page-006.jpg`,
      bounding_box: painel.mod.bounding_box || { page: 6, x: 0.15, y: 0.28, width: 0.21, height: 0.32 },
      description: painel.mod.description || 'Painel para TV',
    })
    .eq('id', already.id)
} else {
  const page = painel.mod.bounding_box?.page || 6
  const { data: modRow, error: modErr } = await admin
    .from('quote_modules')
    .insert({
      environment_id: gourmet.id,
      name: 'Painel TV',
      description: painel.mod.description || 'Painel para TV com iluminação',
      dimensions: painel.mod.dimensions || { width_mm: 2100, height_mm: 3200, depth_mm: 20 },
      bounding_box: painel.mod.bounding_box || { page: 6, x: 0.15, y: 0.28, width: 0.21, height: 0.32 },
      page_number: page,
      page_image_path: `${folder}/page-${String(page).padStart(3, '0')}.jpg`,
      sort_order: (existingMods?.length || 0) + 1,
      out_of_scope: false,
    })
    .select('id')
    .single()
  if (modErr) throw new Error(modErr.message)

  const rows = []
  const sheetAgg = new Map()
  const addCut = (label, mat, w, h, t, q, note) => {
    const area = ((Number(w) || 0) * (Number(h) || 0) * (Number(q) || 1)) / 1e6
    const key = String(mat || 'MDF Noite').trim()
    sheetAgg.set(key, { area: (sheetAgg.get(key)?.area || 0) + area })
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
      notes: `${CUTTING}; ${note}; ${w}x${h}x${t}mm × ${q || 1}`,
      bounding_box: painel.mod.bounding_box,
      page_image_path: `${folder}/page-006.jpg`,
    })
  }

  const caixaria = Array.isArray(painel.mod.caixaria) ? painel.mod.caixaria : []
  const frentes = Array.isArray(painel.mod.frentes_portas) ? painel.mod.frentes_portas : []
  if (!caixaria.length && !frentes.length) {
    // fallback mínimo a partir das cotas da vista 02
    addCut('Painel', 'MDF Noite', 2100, 3200, 15, 1, 'função=painel')
  } else {
    for (const p of caixaria) {
      addCut(p.name || 'Peça', p.material_name || 'MDF Noite', p.width_mm, p.height_mm, p.thickness_mm || 15, p.quantity || 1, `função=${p.function || 'outro'}`)
    }
    for (const f of frentes) {
      addCut(f.name || 'Frente', f.material_name || 'MDF Noite', f.width_mm, f.height_mm, f.thickness_mm || 15, f.quantity || 1, `tipo=${f.kind || 'porta'}`)
    }
  }

  for (const [matName, agg] of sheetAgg.entries()) {
    const sheets = Math.max(1, Math.ceil((agg.area * LOSS) / SHEET_AREA))
    const price = await resolveChapa(matName)
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
      notes: `módulo: ${agg.area.toFixed(3)} m² + 15% → ${sheets} chapa(s) · ${price.matched}`,
      bounding_box: painel.mod.bounding_box,
      page_image_path: `${folder}/page-006.jpg`,
    })
  }

  // LED tipico do detalhe
  const led = await resolveChapa('Perfil de LED')
  rows.push({
    module_id: modRow.id,
    raw_name: 'Perfil de LED',
    category: 'ferragem',
    using_market_price: true,
    market_price_confirmed: false,
    unit_price: 110,
    exact_quantity: 4,
    full_units_quantity: 4,
    unit_measure: 'un',
    notes: 'Preço médio de mercado — confira',
    page_image_path: `${folder}/page-006.jpg`,
  })

  const { error: insErr } = await admin.from('quote_materials').insert(rows)
  if (insErr) throw new Error(insErr.message)
  console.log('Painel TV inserido com', rows.length, 'linhas')
}

// Corrige páginas conhecidas
const fixes = [
  { match: /^ilha$/i, page: 3 },
  { match: /painel/i, page: 6 },
  { match: /cristaleira/i, page: 7 },
  { match: /^arm[aá]rio$/i, page: 7 },
]
const { data: allMods } = await admin
  .from('quote_modules')
  .select('id,name,environment_id,quote_environments!inner(analysis_id)')
  .eq('quote_environments.analysis_id', ANALYSIS_ID)

for (const mod of allMods || []) {
  const fix = fixes.find((f) => f.match.test(mod.name))
  if (!fix) continue
  await admin
    .from('quote_modules')
    .update({
      page_number: fix.page,
      page_image_path: `${folder}/page-${String(fix.page).padStart(3, '0')}.jpg`,
      bounding_box: { page: fix.page, x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    })
    .eq('id', mod.id)
  console.log('page fix', mod.name, '->', fix.page)
}

// Garantir que todo corte-peca tem Chapa agregada no módulo
const { data: mods2 } = await admin
  .from('quote_modules')
  .select('id,name')
  .in(
    'environment_id',
    (await admin.from('quote_environments').select('id').eq('analysis_id', ANALYSIS_ID)).data.map((e) => e.id),
  )
for (const mod of mods2 || []) {
  const { data: mats } = await admin.from('quote_materials').select('*').eq('module_id', mod.id)
  const cutting = (mats || []).filter((m) => (m.notes || '').includes(CUTTING))
  const chapas = (mats || []).filter((m) => /^chapa\s*[—\-–]/i.test(m.raw_name) && !(m.notes || '').includes(CUTTING))
  if (cutting.length && !chapas.length) {
    console.log('módulo sem Chapa — gerando', mod.name)
    const area = cutting.length * 0.5
    const sheets = Math.max(1, Math.ceil((area * LOSS) / SHEET_AREA))
    const price = await resolveChapa('MDF Noite')
    await admin.from('quote_materials').insert({
      module_id: mod.id,
      raw_name: 'Chapa — MDF Noite',
      category: 'chapa',
      system_material_id: price.id,
      using_market_price: price.usingMarket,
      market_price_confirmed: !price.usingMarket,
      unit_price: price.unitPrice,
      exact_quantity: sheets,
      full_units_quantity: sheets,
      unit_measure: 'chapa',
      notes: `auto: ${sheets} chapa(s) · ${price.matched}`,
    })
  }
}

const { data: finalMods } = await admin
  .from('quote_modules')
  .select('id,name,page_number')
  .in(
    'environment_id',
    (await admin.from('quote_environments').select('id').eq('analysis_id', ANALYSIS_ID)).data.map((e) => e.id),
  )
const { data: finalMats } = await admin
  .from('quote_materials')
  .select('raw_name,unit_price,notes,category,module_id')
  .in(
    'module_id',
    finalMods.map((m) => m.id),
  )
const zeros = finalMats.filter(
  (m) =>
    !(m.notes || '').includes(CUTTING) &&
    ['chapa', 'fita_borda', 'ferragem', 'puxador', 'consumivel'].includes(m.category) &&
    !(Number(m.unit_price) > 0),
)
console.log(
  'FINAL',
  finalMods.map((m) => `${m.name}@${m.page_number}`),
)
console.log('billableZeros', zeros.length)
console.log(
  'Painel',
  finalMods.find((m) => /painel/i.test(m.name)),
)
