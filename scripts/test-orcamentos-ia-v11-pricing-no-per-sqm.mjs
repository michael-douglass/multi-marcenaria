/**
 * E0 — Trava anti-m² de venda (PRD v11).
 * Rodar: node scripts/test-orcamentos-ia-v11-pricing-no-per-sqm.mjs
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

const pricing = await vite.ssrLoadModule('/src/lib/orcamentos-ia/pricing.ts')

let ok = true
const check = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`)
  if (!cond) ok = false
}

check('PricingModality não inclui per_sqm', !('per_sqm' in pricing.PRICING_MODALITY_LABEL))
check(
  'normalizePricingModality(per_sqm) → mpc_margin',
  pricing.normalizePricingModality('per_sqm') === 'mpc_margin',
)
check(
  'normalizePricingModality(material_multiplier) preserva',
  pricing.normalizePricingModality('material_multiplier') === 'material_multiplier',
)

const cost = 1000
const legacyParams = {
  modality: 'per_sqm',
  mpcPercent: 45,
  materialMultiplier: 2.5,
  pricePerSqm: 2500,
}
const sale = pricing.calculateSalePrice(cost, legacyParams, 10)
check('calculateSalePrice com modality legada não usa área × R$/m²', sale.modality === 'mpc_margin')
check('venda legada ≈ custo÷(1-0.45)', Math.abs(sale.salePrice - cost / 0.55) < 0.02)
check(
  'venda legada ≠ 10×2500 (fachada)',
  Math.abs(sale.salePrice - 25000) > 1,
)

const sheets = pricing.sheetsFromAreaM2(5.0875, 15)
check('sheetsFromAreaM2(5.0875, 15%) === 2 (chapa + perda)', sheets === 2)

check(
  'DEFAULT_PRICING_PARAMS.modality é mpc_margin',
  pricing.DEFAULT_PRICING_PARAMS.modality === 'mpc_margin',
)

await vite.close()
if (!ok) {
  console.error('\nE0 FALHOU')
  process.exit(1)
}
console.log('\nE0 OK — venda por m² de fachada bloqueada; chapas por área mantidas.')
