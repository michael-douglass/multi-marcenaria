/**
 * E1 — Motor de desmonte BOM.
 * Rodar: node scripts/test-orcamentos-ia-bom-engine.mjs
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

const { explodeModule } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/bom-engine/explode.ts')

let ok = true
const check = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`)
  if (!cond) ok = false
}

const balcao = explodeModule(
  {
    name: 'Balcão de Gavetas',
    typology: 'balcao',
    width_mm: 1000,
    height_mm: 800,
    depth_mm: 500,
    drawer_count: 3,
    shelf_count: 0,
  },
  {
    prefs: {
      company_id: 'test',
      base_assembly: 'between_sides',
      top_assembly: 'over_sides',
      box_thickness_mm: 15,
      mounting_device: 'minifix_dowel',
      back_panel_type: 'grooved',
      back_panel_thickness: 6,
      drawer_slide_type: 'telescopic',
      front_gap_mm: 2,
      shelf_recess_mm: 10,
      edgeband_policy: 'visible_edges',
    },
  },
)

const laterals = balcao.pieces.filter((p) => p.role === 'lateral')
const base = balcao.pieces.find((p) => p.role === 'base')
const boards = balcao.bom.filter((b) => b.item_category === 'board')
const tapes = balcao.bom.filter((b) => b.item_category === 'edgeband')

check('2 laterais (qtd)', laterals.some((p) => p.quantity === 2))
check('lateral profundidade = 500', laterals[0]?.width_mm === 500)
check('lateral altura = 800', laterals[0]?.height_mm === 800)
check('base entre laterais = 1000 − 2×15 = 970', base?.width_mm === 970)
check('área de chapas > 0', boards[0]?.quantity > 0)
check('metragem de fita > 0', tapes.reduce((s, t) => s + t.quantity, 0) > 0)
check('CoT menciona preferências', balcao.chainOfThought.includes('between_sides'))
check('corrediças presentes', balcao.bom.some((b) => /Corrediça/i.test(b.item_description)))

const nicho = explodeModule(
  {
    name: 'Nicho Aberto',
    typology: 'nicho',
    width_mm: 600,
    height_mm: 400,
    depth_mm: 300,
  },
  { prefs: { company_id: 'test', mounting_device: 'minifix_dowel', box_thickness_mm: 15 } },
)

check('nicho força dowel_only', nicho.mountingDevice === 'dowel_only')
check('nicho sem fundo rasgado', !nicho.pieces.some((p) => p.role === 'fundo'))
check(
  'nicho só cavilha (sem minifix)',
  nicho.bom.some((b) => /Cavilha/i.test(b.item_description)) &&
    !nicho.bom.some((b) => /Minifix/i.test(b.item_description)),
)

await vite.close()
if (!ok) {
  console.error('\nE1 FALHOU')
  process.exit(1)
}
console.log('\nE1 OK — desmonte BOM determinístico.')
