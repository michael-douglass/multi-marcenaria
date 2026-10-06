/**
 * E6 — Tipologias avançadas (correr, giro, nicho, engrosso).
 * Rodar: node scripts/test-orcamentos-ia-tipologias.mjs
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
const { edgebandWidthForPiece } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/bom-engine/edgeband.ts',
)

let ok = true
const check = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`)
  if (!cond) ok = false
}

const correr = explodeModule({
  name: 'Roupeiro de Correr',
  typology: 'armario_correr',
  width_mm: 2400,
  height_mm: 2700,
  depth_mm: 600,
  sliding_doors: 2,
  drawer_count: 2,
})
check(
  'correr: kit deslizante 2 portas',
  correr.bom.some((b) => /Kit deslizante 2/i.test(b.item_description)),
)
check('correr: sarrafo unilateral', correr.pieces.some((p) => p.role === 'sarrafo'))
check('correr: 2 portas mesh', correr.pieces.some((p) => p.role === 'porta' && p.quantity === 2))

const giro = explodeModule({
  name: 'Guarda-roupa Giro',
  typology: 'armario_giro',
  width_mm: 1800,
  height_mm: 2600,
  depth_mm: 580,
  column_widths_mm: [900, 900],
  door_count: 2,
  shelf_count: 2,
})
check('giro: colunas no CoT', /colunas independentes/i.test(giro.chainOfThought))
check(
  'giro: dobradiças',
  giro.bom.some((b) => /Dobradiça/i.test(b.item_description)),
)
check('giro: laterais em mais de um par', giro.pieces.filter((p) => p.role === 'lateral').length >= 2)

const nicho = explodeModule({
  name: 'Nicho',
  typology: 'nicho',
  width_mm: 500,
  height_mm: 400,
  depth_mm: 300,
})
check('nicho: dowel_only', nicho.mountingDevice === 'dowel_only')
check('nicho: só cavilha', nicho.bom.some((b) => /Cavilha/i.test(b.item_description)))

const engrosso = explodeModule({
  name: 'Painel Engrossado',
  typology: 'painel',
  width_mm: 1200,
  height_mm: 800,
  depth_mm: 36,
  doubled_top: true,
}, { prefs: { company_id: 't', box_thickness_mm: 18 } })

const doubled = engrosso.pieces.find((p) => p.doubled)
check('engrosso: peça doubled', Boolean(doubled))
check('engrosso: fita 35 ou 45', doubled ? [35, 45].includes(edgebandWidthForPiece(doubled)) : false)
check(
  'engrosso: BOM fita larga',
  engrosso.bom.some((b) => /Fita de Borda (35|45)mm/.test(b.item_description)),
)

await vite.close()
if (!ok) {
  console.error('\nE6 FALHOU')
  process.exit(1)
}
console.log('\nE6 OK — tipologias avançadas.')
