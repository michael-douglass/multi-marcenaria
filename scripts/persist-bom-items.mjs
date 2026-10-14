/**
 * Persiste bom_items via motor determinístico (explodeFromExtractionModule)
 * a partir dos quote_modules / quote_materials já gravados.
 *
 * Uso: node --env-file=.env scripts/persist-bom-items.mjs [analysisId]
 */
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createClient } from '@supabase/supabase-js'

const ANALYSIS_ID = process.argv[2] || '7f377e15-ff4f-4dcc-a7ed-26663aea7975'
const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Faltam VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function parseFuncao(notes) {
  const m = String(notes || '').match(/fun[cç][aã]o\s*=\s*([a-z_]+)/i)
  return m ? m[1].toLowerCase() : null
}

function parseTipo(notes) {
  const m = String(notes || '').match(/tipo\s*=\s*([a-z_]+)/i)
  return m ? m[1].toLowerCase() : null
}

function inferTypologyFromName(name) {
  const n = String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  if (/painel|ripado/.test(n)) return 'painel'
  if (/mesa|jantar/.test(n)) return 'outro'
  if (/aereo|armario|torre|cristaleira/.test(n)) return 'armario_giro'
  if (/ilha|balcao|bancada|lavabo|gaveteiro/.test(n)) return 'balcao'
  return 'outro'
}

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
    const { explodeModuleForPersist, validateBomLines, bomLinesToRows } = await vite.ssrLoadModule(
      '/src/lib/orcamentos-ia/bom-persist.ts',
    )
    const { DEFAULT_SYSTEM_PREFERENCES } = await vite.ssrLoadModule(
      '/src/lib/orcamentos-ia/system-preferences.ts',
    )

    const { data: analysis, error: aErr } = await admin
      .from('quote_analyses')
      .select('id, company_id, status, totals')
      .eq('id', ANALYSIS_ID)
      .maybeSingle()
    if (aErr) throw new Error(aErr.message)
    if (!analysis) throw new Error(`Análise não encontrada: ${ANALYSIS_ID}`)

    const prefsRow = await admin
      .from('system_preferences')
      .select('*')
      .eq('company_id', analysis.company_id)
      .maybeSingle()
    const prefs = prefsRow.data || DEFAULT_SYSTEM_PREFERENCES(analysis.company_id)

    const { data: envs, error: eErr } = await admin
      .from('quote_environments')
      .select('id, name')
      .eq('analysis_id', ANALYSIS_ID)
    if (eErr) throw new Error(eErr.message)

    const envIds = (envs || []).map((e) => e.id)
    const envById = new Map((envs || []).map((e) => [e.id, e.name]))

    const { data: modules, error: mErr } = await admin
      .from('quote_modules')
      .select('id, name, dimensions, environment_id, out_of_scope')
      .in('environment_id', envIds)
    if (mErr) throw new Error(mErr.message)

    const modIds = (modules || []).map((m) => m.id)
    const { data: materials, error: matErr } = await admin
      .from('quote_materials')
      .select('module_id, raw_name, category, notes, unit_price, exact_quantity')
      .in('module_id', modIds)
    if (matErr) throw new Error(matErr.message)

    const matsByMod = new Map()
    for (const mat of materials || []) {
      const list = matsByMod.get(mat.module_id) || []
      list.push(mat)
      matsByMod.set(mat.module_id, list)
    }

    await admin.from('bom_items').delete().eq('project_id', ANALYSIS_ID)

    let totalBom = 0
    const cotParts = []

    for (const mod of modules || []) {
      if (mod.out_of_scope) continue
      const mats = matsByMod.get(mod.id) || []
      const caixaria = []
      const frentes_portas = []
      for (const mat of mats) {
        const cat = String(mat.category || '').toLowerCase()
        if (cat === 'chapa' || cat === 'board') {
          const fn = parseFuncao(mat.notes)
          const tipo = parseTipo(mat.notes)
          if (tipo) {
            frentes_portas.push({ name: mat.raw_name, kind: tipo, quantity: 1 })
          } else {
            caixaria.push({
              name: mat.raw_name,
              function: fn || 'outro',
              quantity: 1,
            })
          }
        }
      }

      const dims =
        mod.dimensions && typeof mod.dimensions === 'object' ? mod.dimensions : {}
      const extractionMod = {
        name: mod.name,
        typology: inferTypologyFromName(mod.name),
        dimensions: {
          width_mm: Number(dims.width_mm) || null,
          height_mm: Number(dims.height_mm) || null,
          depth_mm: Number(dims.depth_mm) || null,
        },
        caixaria,
        frentes_portas,
        door_count: frentes_portas.filter((f) => /porta/.test(f.kind)).length || null,
        shelf_count: caixaria.filter((c) => c.function === 'prateleira').length || null,
      }

      const roomTag = envById.get(mod.environment_id) || undefined
      const exploded = explodeModuleForPersist(extractionMod, prefs, roomTag)
      const check = validateBomLines(exploded.bom)
      if (!check.ok) {
        console.warn(`BOM inválido ${mod.name}:`, check.issues.slice(0, 3).join(' | '))
        continue
      }

      const rows = bomLinesToRows(ANALYSIS_ID, mod.id, exploded.bom)
      if (!rows.length) {
        console.warn(`BOM vazio: ${mod.name}`)
        continue
      }

      // Espelha unit_cost das chapas a partir do material precificado (quando houver)
      const sheetPrice = mats.find(
        (m) =>
          (m.category === 'chapa' || m.category === 'board') && Number(m.unit_price) > 0,
      )
      if (sheetPrice) {
        for (const row of rows) {
          if (row.item_category === 'board' && !(Number(row.unit_cost) > 0)) {
            row.unit_cost = Number(sheetPrice.unit_price)
          }
        }
      }

      const { error: insErr } = await admin.from('bom_items').insert(rows)
      if (insErr) throw new Error(`${mod.name}: ${insErr.message}`)
      totalBom += rows.length
      cotParts.push(`### ${mod.name}\n${exploded.chainOfThought}`)
      console.log(`OK ${mod.name}: ${rows.length} linhas BOM (${exploded.pieces.length} peças)`)
    }

    const prevTotals =
      analysis.totals && typeof analysis.totals === 'object' ? analysis.totals : {}
    await admin
      .from('quote_analyses')
      .update({
        totals: {
          ...prevTotals,
          bom_items_count: totalBom,
          engineering_cot: cotParts.join('\n\n'),
        },
      })
      .eq('id', ANALYSIS_ID)

    console.log(`\nPersistidos ${totalBom} bom_items em ${ANALYSIS_ID}`)
    if (totalBom <= 0) process.exit(2)
  } finally {
    await vite.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
