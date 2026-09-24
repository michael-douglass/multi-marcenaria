/**
 * Teste: schema do Extrator aceita medidas zeradas/nulas (estimativa por tipo)
 * e marca pedra/decoração como fora de escopo.
 * Rodar: node scripts/test-orcamentos-ia-schemas.mjs
 */
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// Usa o Vite só como loader de TS com o alias @/ (sem plugins do app)
const vite = await createServer({
  configFile: false,
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})
const { quoteExtractionSchema } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/schemas.ts')
const { ensureModulePlaceholder } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/merge-extraction.ts')

const piece = (over) => ({
  name: 'Lateral',
  function: 'lateral',
  material_name: 'MDF Branco TX 15mm',
  quantity: 2,
  ...over,
})

const extraction = {
  environments: [
    {
      name: 'Escritório',
      modules: [
        {
          name: 'Mesa com Saia',
          dimensions: { width_mm: 0, height_mm: null, depth_mm: -5 },
          caixaria: [
            piece({ width_mm: 0, height_mm: 0 }),
            piece({ name: 'Fundo', function: 'fundo', width_mm: null, height_mm: '700', thickness_mm: 0 }),
            piece({
              name: 'Tampo',
              function: 'tampo',
              width_mm: 1400,
              height_mm: 700,
              bounding_box: { page: 2, x: 1.4, y: -0.2, width: 0.3, height: 0.2 },
            }),
            piece({ name: 'Saia', function: 'outro', width_mm: 1300, height_mm: 100, bounding_box: { page: 0, x: 0.1, y: 0.1, width: 0.1, height: 0.1 } }),
          ],
          frentes_portas: [
            { name: 'Gaveta', kind: 'frente_gaveta', width_mm: -1, height_mm: 0, material_name: 'MDF Branco', quantity: 1 },
          ],
        },
        ensureModulePlaceholder({
          name: 'Tampo em granito São Gabriel',
          dimensions: { width_mm: 1800, height_mm: 0, depth_mm: 0 },
        }),
        ensureModulePlaceholder({
          name: 'Mesa Lateral Apoio Chanfrada - Westwing',
          caixaria: [piece({ width_mm: 600, height_mm: 400 })],
        }),
        ensureModulePlaceholder({
          name: 'Bancada granito',
          caixaria: [piece({ width_mm: 1800, height_mm: 600 })],
        }),
      ],
    },
  ],
}

const parsed = quoteExtractionSchema.safeParse(extraction)
let ok = true
const check = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`)
  if (!cond) ok = false
}

check('Zod aprova extração sem cotas', parsed.success)
if (!parsed.success) {
  console.log(parsed.error.issues)
  await vite.close()
  process.exit(1)
}

const [mesa, granito, westwing, bancada] = parsed.data.environments[0].modules
const [lateral, fundo, tampo, saia] = mesa.caixaria
check('lateral 0×0 → 550×700 estimada', lateral.width_mm === 550 && lateral.height_mm === 700 && lateral.dimensions_estimated === true)
check('fundo: largura estimada, altura "700" mantida, espessura 6', fundo.width_mm === 800 && fundo.height_mm === 700 && fundo.thickness_mm === 6)
check('tampo com cota não é marcado como estimado', tampo.width_mm === 1400 && !tampo.dimensions_estimated)
check('bounding_box fora de 0–1 é limitado', tampo.bounding_box?.x === 1 && tampo.bounding_box?.y === 0)
check('bounding_box com página 0 é descartado', saia.bounding_box === undefined)
check('frente de gaveta → 400×180', mesa.frentes_portas[0].width_mm === 400 && mesa.frentes_portas[0].height_mm === 180)
check('módulo mesa: dimensões estimadas 1200×750×600', mesa.dimensions?.width_mm === 1200 && mesa.dimensions?.depth_mm === 600 && mesa.dimensions?.estimated === true)
check('tampo de granito sem MDF → out_of_scope', granito.out_of_scope === true && granito.caixaria.length === 0)
check('fora do escopo com medidas 0 → dimensões descartadas (sem erro Zod)', granito.dimensions === undefined)
check('móvel de loja (Westwing) → out_of_scope mesmo com peças', westwing.out_of_scope === true)
check('bancada de MDF com granito no nome → continua no escopo', !bancada.out_of_scope && bancada.caixaria.length === 1)

// Precificação: chapa em m² (não uma chapa inteira por peça)
const { sumMaterialsCost, buildShoppingList, STANDARD_SHEET_AREA_M2 } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/pricing.ts',
)
const perM2 = 220 / STANDARD_SHEET_AREA_M2
const mat = (id, raw, area) => ({
  id,
  module_id: 'm1',
  raw_name: raw,
  category: 'chapa',
  unit_price: perM2,
  exact_quantity: area,
  full_units_quantity: 1,
  unit_measure: 'm2',
  notes: null,
})
const mats = [
  mat('a', 'Lateral — MDF Branco TX 15mm', 0.77),
  mat('b', 'Base — MDF Branco TX 15mm', 0.44),
  mat('c', 'Prateleira — MDF Branco TX 15mm', 0.405),
]
const cost = sumMaterialsCost(mats, 15)
check(`custo m² com perda 15% ≈ R$ ${cost.toFixed(2)} (< 1 chapa)`, cost > 0 && cost < 220)
const tree = { environments: [{ modules: [{ out_of_scope: false, materials: mats }] }] }
const chapas = buildShoppingList(tree, { sheetLossPct: 15 }).filter((i) => i.category === 'chapa')
check(
  'lista de compras agrupa peças do mesmo MDF em 1 linha / 1 chapa',
  chapas.length === 1 && chapas[0].purchaseQuantity === 1 && chapas[0].name === 'MDF Branco TX 15mm',
)

await vite.close()
process.exit(ok ? 0 : 1)
