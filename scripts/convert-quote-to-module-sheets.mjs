/**
 * Converte um orçamento já extraído: peça × R$/m² → lista de corte + chapas do módulo.
 * Uso: node --env-file=.env scripts/convert-quote-to-module-sheets.mjs [analysisId]
 */
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'vite'

const ANALYSIS_ID = process.argv[2]
if (!ANALYSIS_ID) {
  console.error('Informe o ID do orçamento')
  process.exit(1)
}

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const vite = await createServer({
  configFile: false,
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

const { convertM2RowsToModuleSheets } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/module-sheet-pricing.ts',
)

const admin = createClient(url, key)

const { data: envs, error: envErr } = await admin
  .from('quote_environments')
  .select('id')
  .eq('analysis_id', ANALYSIS_ID)
if (envErr) throw new Error(envErr.message)
const envIds = (envs ?? []).map((e) => e.id)
if (!envIds.length) {
  console.error('Orçamento sem ambientes')
  process.exit(1)
}

const { data: mods, error: modErr } = await admin
  .from('quote_modules')
  .select('id')
  .in('environment_id', envIds)
if (modErr) throw new Error(modErr.message)
const modIds = (mods ?? []).map((m) => m.id)

const { data: materials, error: matErr } = await admin
  .from('quote_materials')
  .select(
    'id, module_id, raw_name, category, system_material_id, using_market_price, market_price_confirmed, unit_price, exact_quantity, full_units_quantity, unit_measure, bounding_box, notes, page_image_path',
  )
  .in('module_id', modIds)
if (matErr) throw new Error(matErr.message)

const rows = (materials ?? []).map((m) => ({
  ...m,
  unit_price: Number(m.unit_price) || 0,
  exact_quantity: Number(m.exact_quantity) || 0,
  full_units_quantity: Number(m.full_units_quantity) || 0,
}))

const beforeM2 = rows.filter((r) => r.unit_measure === 'm2' || r.unit_measure === 'm²').length
const converted = convertM2RowsToModuleSheets(rows)

if (converted.deleteIds.length) {
  const { error: delErr } = await admin.from('quote_materials').delete().in('id', converted.deleteIds)
  if (delErr) throw new Error(delErr.message)
}

if (converted.insert.length) {
  const { error: insErr } = await admin.from('quote_materials').insert(converted.insert)
  if (insErr) throw new Error(insErr.message)
}

const { data: after } = await admin
  .from('quote_materials')
  .select('unit_measure, raw_name, unit_price, exact_quantity, notes')
  .in('module_id', modIds)

const m2After = (after ?? []).filter((r) => r.unit_measure === 'm2' || r.unit_measure === 'm²').length
const chapas = (after ?? []).filter((r) => r.unit_measure === 'chapa')
const corte = (after ?? []).filter((r) => String(r.notes ?? '').includes('corte-peca'))

await vite.close()

console.log(
  JSON.stringify(
    {
      analysisId: ANALYSIS_ID,
      deletedM2Rows: converted.deleteIds.length,
      inserted: converted.insert.length,
      m2Before: beforeM2,
      m2After,
      sheetLines: chapas.map((c) => ({
        name: c.raw_name,
        qty: c.exact_quantity,
        unitPrice: c.unit_price,
      })),
      cuttingPieces: corte.length,
    },
    null,
    2,
  ),
)
if (m2After > 0) process.exit(1)
