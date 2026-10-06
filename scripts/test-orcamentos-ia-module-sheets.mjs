/**
 * Peças em m² viram lista de corte + chapas do módulo.
 * Rodar: node scripts/test-orcamentos-ia-module-sheets.mjs
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

const {
  convertM2RowsToModuleSheets,
  sheetUnitPrice,
  sheetsForModuleArea,
  CUTTING_LIST_TAG,
} = await vite.ssrLoadModule('/src/lib/orcamentos-ia/module-sheet-pricing.ts')
const { materialLineCost } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/pricing.ts')

let ok = true
const check = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`)
  if (!cond) ok = false
}

const packed = sheetsForModuleArea(5.0875)
check('1 chapa de área + 15% = 2', packed.sheets === 2)
check(
  'preço da chapa = R$/m² × 5,0875',
  Math.abs(sheetUnitPrice({ unitPrice: 43.24, unit: 'm2', pricePerM2: 43.24 }) - 43.24 * 5.0875) < 0.02,
)

const rows = [
  {
    id: 'a',
    module_id: 'mod1',
    raw_name: 'Lateral — MDF Branco 15mm',
    category: 'chapa',
    unit_measure: 'm2',
    unit_price: 43.24,
    exact_quantity: 0.8,
    full_units_quantity: 1,
    notes: 'função=lateral; 500x800x15mm × 2',
    using_market_price: true,
    market_price_confirmed: false,
    system_material_id: null,
  },
  {
    id: 'b',
    module_id: 'mod1',
    raw_name: 'Prateleira — MDF Branco 15mm',
    category: 'chapa',
    unit_measure: 'm2',
    unit_price: 43.24,
    exact_quantity: 0.4,
    full_units_quantity: 1,
    notes: 'função=prateleira; 970x400x15mm × 1',
    using_market_price: true,
    market_price_confirmed: false,
    system_material_id: null,
  },
  {
    id: 'c',
    module_id: 'mod1',
    raw_name: 'Dobradiça',
    category: 'ferragem',
    unit_measure: 'un',
    unit_price: 15,
    exact_quantity: 4,
    full_units_quantity: 4,
    notes: null,
    using_market_price: false,
    market_price_confirmed: true,
    system_material_id: null,
  },
]

const out = convertM2RowsToModuleSheets(rows)
check('remove 2 linhas m²', out.deleteIds.length === 2)
check('mantém ferragem', out.keep.length === 1 && out.keep[0].id === 'c')
const corte = out.insert.filter((r) => String(r.notes).includes(CUTTING_LIST_TAG))
const chapa = out.insert.find((r) => r.unit_measure === 'chapa')
check('2 peças na lista de corte', corte.length === 2)
check('corte sem custo', corte.every((r) => r.unit_price === 0))
check('1 linha de chapa no módulo', Boolean(chapa) && chapa.raw_name.startsWith('Chapa —'))
check('chapa não está em m²', chapa?.unit_measure === 'chapa')
check(
  'custo da peça de corte = 0',
  materialLineCost({ ...corte[0], notes: corte[0].notes }, 15) === 0,
)

await vite.close()
if (!ok) {
  console.error('\nmodule-sheets FALHOU')
  process.exit(1)
}
console.log('\nOK — precificação por módulo (chapas), não por m² de peça.')
