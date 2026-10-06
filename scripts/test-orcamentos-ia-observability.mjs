/**
 * E4 — CoT + Auditor + JSON; total = soma quantity × unit_cost.
 * Rodar: node scripts/test-orcamentos-ia-observability.mjs
 */
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const vite = await createServer({
  configFile: false,
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

const { buildObservabilityBlocks, sumAuditorRows } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/observability.ts',
)
const { explodeModule } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/bom-engine/explode.ts')

let ok = true
const check = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`)
  if (!cond) ok = false
}

const exploded = explodeModule({
  name: 'Balcão',
  typology: 'balcao',
  width_mm: 900,
  height_mm: 720,
  depth_mm: 500,
  drawer_count: 2,
})

const blocks = buildObservabilityBlocks({
  chainOfThought: exploded.chainOfThought,
  bom: exploded.bom,
  pricing: { modality: 'mpc_margin', mpcPercent: 45, materialMultiplier: 2.5 },
  promptTraces: [{ agent: 'extractor', raw: { ok: true } }],
})

check('CoT texto presente', blocks.chainOfThought.length > 20)
check('auditor tem linhas', blocks.priceAuditor.length > 0)
check('JSON tem bom', Array.isArray(blocks.responseJson.bom))
check(
  'total auditor = soma q×custo',
  Math.abs(blocks.priceAuditorTotal - sumAuditorRows(blocks.priceAuditor)) < 0.001,
)
const manual = exploded.bom.reduce((s, l) => s + l.quantity * l.unit_cost, 0)
check('total bate com BOM', Math.abs(blocks.priceAuditorTotal - Math.round(manual * 100) / 100) < 0.02)
check('venda MPC > custo', blocks.salePrice > blocks.priceAuditorTotal)
check('modality mpc_margin', blocks.modality === 'mpc_margin')

await vite.close()
if (!ok) {
  console.error('\nE4 FALHOU')
  process.exit(1)
}
console.log('\nE4 OK — observabilidade 3 blocos.')
