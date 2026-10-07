/**
 * Reprocessa orçamento via pipeline do app + reaudita até cobertura ok / Painel TV presente.
 * Uso: node --env-file=.env scripts/tmp-reprocess-and-reaudit.mjs [analysisId]
 */
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createClient } from '@supabase/supabase-js'

const ANALYSIS_ID = process.argv[2] || '4b7ce4a9-73f5-47e8-8ce2-575d30e16028'
const COMPANY_ID = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'

const admin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

async function snapshot(label) {
  const { data: envs } = await admin
    .from('quote_environments')
    .select('id,name')
    .eq('analysis_id', ANALYSIS_ID)
  const envIds = (envs || []).map((e) => e.id)
  if (!envIds.length) {
    console.log(label, 'sem ambientes')
    return { mods: [], billableZeros: 999, hasPainel: false }
  }
  const { data: mods } = await admin
    .from('quote_modules')
    .select('id,name,page_number,page_image_path')
    .in('environment_id', envIds)
  const { data: mats } = await admin
    .from('quote_materials')
    .select('module_id,raw_name,category,unit_price,notes')
    .in(
      'module_id',
      mods.map((m) => m.id),
    )
  const billableZeros = (mats || []).filter(
    (m) =>
      !(m.notes || '').includes('corte-peca') &&
      ['chapa', 'fita_borda', 'ferragem', 'puxador', 'consumivel'].includes(m.category) &&
      !(Number(m.unit_price) > 0),
  )
  const names = (mods || []).map((m) => m.name)
  const hasPainel = names.some((n) => /painel\s*tv|tv\s*painel/i.test(n))
  const painel = (mods || []).find((m) => /painel\s*tv|tv\s*painel/i.test(m.name))
  console.log(
    label,
    JSON.stringify({
      modules: names,
      hasPainel,
      painelPage: painel?.page_number ?? null,
      billableZeros: billableZeros.length,
      mats: mats?.length ?? 0,
    }),
  )
  return { mods: mods || [], billableZeros: billableZeros.length, hasPainel, painel }
}

const vite = await createServer({
  configFile: false,
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

const { reprocessOrcamentosIaPipeline, reauditOrcamentosIaAnalysis } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/pipeline.ts',
)

console.log('=== REPROCESS', ANALYSIS_ID, '===')
await snapshot('antes')
const rep = await reprocessOrcamentosIaPipeline({
  analysisId: ANALYSIS_ID,
  companyId: COMPANY_ID,
})
console.log('reprocess result', rep)
if (!rep.ok) {
  await vite.close()
  process.exit(1)
}

let snap = await snapshot('após reprocess')

for (let i = 1; i <= 3; i++) {
  const needs =
    !snap.hasPainel ||
    snap.billableZeros > 0 ||
    (snap.painel && Number(snap.painel.page_number) !== 6)
  console.log(`=== REAUDIT ${i}/3 needsWork=${needs} ===`)
  const aud = await reauditOrcamentosIaAnalysis({
    analysisId: ANALYSIS_ID,
    companyId: COMPANY_ID,
  })
  console.log('reaudit', aud)
  snap = await snapshot(`após reaudit ${i}`)
  if (snap.hasPainel && snap.billableZeros === 0) {
    // Painel page 6 is ideal but content-dependent; accept 5-7
    const p = Number(snap.painel?.page_number)
    if (p >= 5 && p <= 7) break
    if (snap.hasPainel && snap.billableZeros === 0 && i >= 2) break
  }
}

const ok = snap.billableZeros === 0 && snap.mods.length >= 5
console.log(ok ? 'SATISFATÓRIO' : 'AINDA INCOMPLETO', {
  hasPainel: snap.hasPainel,
  billableZeros: snap.billableZeros,
  modules: snap.mods.length,
})

await vite.close()
process.exit(ok ? 0 : 2)
