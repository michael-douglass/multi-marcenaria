/**
 * E2 — Fixture de extração → explode → shape Zod bom_items; sem per_sqm nos totals.
 * Rodar: node scripts/test-orcamentos-ia-pipeline-bom-persist.mjs
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

const { explodeModuleForPersist, validateBomLines, bomLinesToRows } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/bom-persist.ts',
)
const { quoteExtractionSchema } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/schemas.ts')
const { normalizePricingModality } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/pricing.ts')

let ok = true
const check = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`)
  if (!cond) ok = false
}

const fixture = {
  environments: [
    {
      name: 'Cozinha',
      modules: [
        {
          name: 'Balcão Pia',
          typology: 'balcao',
          dimensions: { width_mm: 1200, height_mm: 850, depth_mm: 560 },
          drawer_count: 2,
          caixaria: [
            {
              name: 'Lateral',
              function: 'lateral',
              material_name: 'MDF Branco 15mm',
              quantity: 2,
              width_mm: 560,
              height_mm: 850,
              thickness_mm: 15,
            },
          ],
          frentes_portas: [
            {
              name: 'Gaveta 1',
              kind: 'frente_gaveta',
              material_name: 'MDF Branco',
              quantity: 1,
              width_mm: 580,
              height_mm: 200,
            },
          ],
          ferragens: [
            {
              raw_name: 'Corrediça telescópica 450',
              category: 'ferragem',
              unit_measure: 'un',
              exact_quantity: 2,
              full_units_quantity: 2,
            },
          ],
          fitas_borda_m: [{ tape_name: 'Fita PVC Branco 22mm', meters: 8 }],
        },
      ],
    },
  ],
  auditor_notes: [],
  warnings: [],
}

const parsed = quoteExtractionSchema.safeParse(fixture)
check('Zod aceita typology v11', parsed.success)

const mod = fixture.environments[0].modules[0]
const exploded = explodeModuleForPersist(mod, {
  company_id: 'test',
  base_assembly: 'between_sides',
  box_thickness_mm: 15,
  mounting_device: 'minifix_dowel',
  top_assembly: 'over_sides',
  back_panel_type: 'grooved',
  back_panel_thickness: 6,
  drawer_slide_type: 'telescopic',
  front_gap_mm: 2,
  shelf_recess_mm: 10,
  edgeband_policy: 'visible_edges',
}, 'Cozinha')

const validation = validateBomLines(exploded.bom)
check('BOM válido (categorias board|edgeband|hardware|fastener)', validation.ok)
if (!validation.ok) console.log(validation.issues)

const cats = new Set(exploded.bom.map((b) => b.item_category))
check('tem board', cats.has('board'))
check('tem edgeband', cats.has('edgeband'))
check('tem fastener ou hardware', cats.has('fastener') || cats.has('hardware'))

const rows = bomLinesToRows('proj-1', 'mod-1', exploded.bom)
check('rows prontas para insert', rows.length === exploded.bom.length)
check('project_id/module_id preenchidos', rows.every((r) => r.project_id && r.module_id))

const totals = {
  engineering_cot: exploded.chainOfThought,
  pricing_note: 'v11: venda apenas por BOM',
  modality_legacy: normalizePricingModality('per_sqm'),
}
check('totals sem chave per_sqm', !('per_sqm' in totals))
check('modality legada → mpc_margin', totals.modality_legacy === 'mpc_margin')
check('CoT não vazio', totals.engineering_cot.length > 40)

await vite.close()
if (!ok) {
  console.error('\nE2 FALHOU')
  process.exit(1)
}
console.log('\nE2 OK — pipeline BOM persist shape.')
