/**
 * E7 — Migração de modalidade per_sqm → mpc_margin.
 * Rodar: node scripts/test-orcamentos-ia-migrate-modality.mjs
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

const { migrateLegacyPricingParams } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/migrate-modality.ts',
)
const { calculateSalePrice } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/pricing.ts')

let ok = true
const check = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`)
  if (!cond) ok = false
}

const legacy = {
  modality: 'per_sqm',
  mpcPercent: 40,
  materialMultiplier: 2.2,
  pricePerSqm: 2800,
  sheetLossPct: 15,
}

const migrated = migrateLegacyPricingParams(legacy)
check('wasPerSqm', migrated.wasPerSqm)
check('modality → mpc_margin', migrated.params.modality === 'mpc_margin')
check('preserva mpcPercent 40', migrated.params.mpcPercent === 40)
check('notice presente', Boolean(migrated.notice))

const sale = calculateSalePrice(1000, migrated.params, 12)
check('venda ≠ 12×2800', Math.abs(sale.salePrice - 33600) > 1)
check('venda ≈ 1000/0.6', Math.abs(sale.salePrice - 1000 / 0.6) < 0.05)

const okMult = migrateLegacyPricingParams({ modality: 'material_multiplier', materialMultiplier: 3 })
check('preserva ×N', okMult.params.modality === 'material_multiplier')

await vite.close()
if (!ok) {
  console.error('\nE7 FALHOU')
  process.exit(1)
}
console.log('\nE7 OK — migrate modality.')
