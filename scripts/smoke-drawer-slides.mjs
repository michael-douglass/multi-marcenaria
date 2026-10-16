/**
 * Gate E4 — gavetas → corrediças (1 par por gaveta).
 * Uso: node scripts/smoke-drawer-slides.mjs
 */
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createServer } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
let failed = 0

function ok(cond, msg) {
  if (cond) console.log('OK', msg)
  else {
    console.error('FAIL', msg)
    failed++
  }
}

const drawerSrc = readFileSync(join(root, 'src/lib/orcamentos-ia/drawer-slides.ts'), 'utf8')
const consolidateSrc = readFileSync(join(root, 'src/lib/orcamentos-ia/bom-consolidate.ts'), 'utf8')
const aliasSrc = readFileSync(join(root, 'src/lib/orcamentos-ia/hardware-alias.ts'), 'utf8')
const pipeSrc = readFileSync(join(root, 'src/lib/orcamentos-ia/pipeline.ts'), 'utf8')

ok(drawerSrc.includes('ensureDrawerSlidesInExtraction'), 'ensureDrawerSlidesInExtraction')
ok(drawerSrc.includes('countModuleDrawers'), 'countModuleDrawers')
ok(consolidateSrc.includes('ensureDrawerSlidesInExtraction'), 'consolidate chama ensure')
ok(aliasSrc.includes('corredica_oculta_45'), 'alias oculta')
ok(aliasSrc.includes('corredica_teles_25'), 'alias teles')
ok(/\bcorredic/.test(aliasSrc) || aliasSrc.includes('\\bcorredic'), 'alias genérico corrediça')
ok(pipeSrc.includes('E4 desmonte') || pipeSrc.includes('corredic'), 'pipeline espelha corrediças')

const vite = await createServer({
  configFile: false,
  resolve: { alias: { '@': join(root, 'src') } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

const {
  countModuleDrawers,
  ensureDrawerSlidesInModule,
  ensureDrawerSlidesInExtraction,
  sumCorredicaPairs,
} = await vite.ssrLoadModule('/src/lib/orcamentos-ia/drawer-slides.ts')
const { mapHardwareAlias } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/hardware-alias.ts')
const { consolidateExtractionForPricing } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/bom-consolidate.ts',
)

ok(mapHardwareAlias('Corrediça telescópica 450mm').key === 'corredica_teles_25', 'teles antes de genérico')
ok(mapHardwareAlias('corrediça').key === 'corredica_oculta_45', 'genérico → oculta')
ok(mapHardwareAlias('CORREDIÇA OCULTA 45').key === 'corredica_oculta_45', 'canônico oculta')

ok(countModuleDrawers({ name: 'Gaveteiro', typology: 'gaveteiro' }) === 3, 'gaveteiro default 3')
ok(
  countModuleDrawers({
    name: 'Balcão',
    frentes_portas: [
      { kind: 'frente_gaveta', name: 'G1', quantity: 1 },
      { kind: 'frente_gaveta', name: 'G2', quantity: 1 },
    ],
  }) === 2,
  '2 frentes_gaveta → 2',
)
ok(
  countModuleDrawers({
    name: 'Balcão gavetas iguais',
    typology: 'balcao',
    drawer_count: 0,
  }) >= 3,
  'nome Balcão gavetas → ≥3',
)

const bare = ensureDrawerSlidesInModule({
  name: 'Gaveteiro',
  typology: 'gaveteiro',
  caixaria: [],
  frentes_portas: [],
  ferragens: [],
})
ok((bare.ferragens || []).length === 1, 'injeta 1 linha de corrediça')
ok(
  /corredi/i.test(bare.ferragens[0].raw_name) || /OCULTA|TELES/i.test(bare.ferragens[0].raw_name),
  `nome canônico corrediça (got ${bare.ferragens[0].raw_name})`,
)
ok(bare.ferragens[0].exact_quantity === 3, '3 pares para gaveteiro')

const already = ensureDrawerSlidesInModule({
  name: 'Gaveteiro',
  typology: 'gaveteiro',
  ferragens: [
    {
      raw_name: 'corrediça',
      category: 'ferragem',
      unit_measure: 'un',
      exact_quantity: 1,
      full_units_quantity: 1,
    },
  ],
})
ok(already.ferragens[0].exact_quantity === 3, 'eleva qty 1→3')

const noDrawer = ensureDrawerSlidesInModule({
  name: 'Painel',
  typology: 'painel',
  ferragens: [],
})
ok((noDrawer.ferragens || []).length === 0, 'painel sem gaveta → sem injeção')

const tree = ensureDrawerSlidesInExtraction({
  environments: [
    {
      name: 'Recepção',
      modules: [
        {
          name: 'Balcão Com Gavetas',
          typology: 'balcao',
          out_of_scope: false,
          caixaria: [
            {
              name: 'Lateral',
              function: 'lateral',
              width_mm: 500,
              height_mm: 700,
              thickness_mm: 15,
              material_name: 'MDF Branco TX',
              quantity: 2,
            },
          ],
          frentes_portas: [
            {
              name: 'Gaveta 1',
              kind: 'frente_gaveta',
              width_mm: 400,
              height_mm: 150,
              thickness_mm: 18,
              material_name: 'MDF Salerno',
              quantity: 1,
            },
            {
              name: 'Gaveta 2',
              kind: 'frente_gaveta',
              width_mm: 400,
              height_mm: 150,
              thickness_mm: 18,
              material_name: 'MDF Salerno',
              quantity: 1,
            },
          ],
          ferragens: [],
          fitas_borda_m: [],
        },
      ],
    },
  ],
  auditor_notes: [],
  warnings: [],
})

const pairs = sumCorredicaPairs(tree.environments[0].modules[0].ferragens)
ok(pairs === 2, `tree inject 2 pares (got ${pairs})`)

const priced = consolidateExtractionForPricing(tree)
const hw = priced.consolidatedBom.hardware.filter(
  (h) => h.key.startsWith('corredica') || /corredic/i.test(h.canonicalName),
)
const hwQty = hw.reduce((s, h) => s + h.quantity, 0)
ok(hwQty >= 2, `consolidate BOM corrediça ≥2 (got ${hwQty})`)
ok(hwQty > 0, 'gate E4: corredica agregada > 0')

await vite.close()

if (failed) {
  console.error(`FAILED ${failed}`)
  process.exit(1)
}
console.log('OK all drawer-slides E4 cases')
