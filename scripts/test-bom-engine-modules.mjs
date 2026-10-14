/**
 * Fixture ad-hoc HelloMob (PRD v11) — exige `tsx` via pnpm.
 * Uso: pnpm exec tsx scripts/test-bom-engine-modules.mjs
 */
import { explodeModule } from '../src/lib/orcamentos-ia/bom-engine/explode.ts'
import { applyEdgebandPolicy } from '../src/lib/orcamentos-ia/bom-engine/edgeband.ts'
import { buildIndustrialLabels } from '../src/lib/orcamentos-ia/bom-engine/labels.ts'

const prefs = {
  company_id: 'test',
  base_assembly: 'under_sides',
  top_assembly: 'over_sides',
  mounting_device: 'minifix_dowel',
  back_panel_type: 'grooved',
  back_panel_thickness: 6,
  drawer_slide_type: 'telescopic',
  front_gap_mm: 2,
  box_thickness_mm: 15,
  shelf_recess_mm: 10,
  edgeband_policy: 'front_only',
}

let failed = 0
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name)
    failed++
  } else {
    console.log('OK  ', name)
  }
}

const m1 = explodeModule(
  {
    name: 'Balcão pia',
    typology: 'balcao',
    width_mm: 800,
    height_mm: 720,
    depth_mm: 580,
    drawer_count: 0,
    door_count: 2,
  },
  { prefs },
)
ok('M1 peças laterais', m1.pieces.some((p) => p.role === 'lateral'))
ok(
  'M1 VB35 no BOM',
  m1.bom.some((b) => b.item_description.includes('VB35')),
)

const m2 = explodeModule(
  {
    name: 'Aéreo',
    typology: 'aereo',
    width_mm: 800,
    height_mm: 400,
    depth_mm: 350,
    door_count: 1,
    handle_recess_mm: 40,
    door_overhang_mm: 20,
  },
  { prefs },
)
ok(
  'M2 travessa cava',
  m2.pieces.some((p) => p.name.includes('cava 40')),
)
ok(
  'M2 avanço porta',
  m2.pieces.some((p) => p.name.includes('avanço 20')),
)

const edge = applyEdgebandPolicy(
  {
    id: 'x',
    role: 'base',
    name: 'Base',
    width_mm: 800,
    height_mm: 550,
    thickness_mm: 15,
    quantity: 1,
    edge_lengths_mm: { front: 800, left: 550, right: 550 },
  },
  'front_only',
)
ok('M4 front_only', edge.front === 800 && edge.left == null)

const labels = buildIndustrialLabels(m1.pieces, {
  name: 'Balcão pia',
  room_tag: 'Cozinha',
})
ok(
  'M5-6 labels',
  labels.length === m1.pieces.length && labels[0].barcode_payload.includes('COZINHA'),
)

const m7 = explodeModule(
  {
    name: 'Roupeiro correr',
    typology: 'armario_correr',
    width_mm: 2000,
    height_mm: 2400,
    depth_mm: 600,
    sliding_doors: 2,
    sliding_envelope: true,
  },
  { prefs },
)
ok(
  'M7 tamponamento',
  m7.pieces.some((p) => p.name.includes('Tamponamento')),
)
ok(
  'M7 trilhos',
  m7.bom.some((b) => b.item_description.includes('Trilho')),
)

const m8 = explodeModule(
  {
    name: 'Roupeiro giro',
    typology: 'armario_giro',
    width_mm: 1800,
    height_mm: 2400,
    depth_mm: 600,
    column_widths_mm: [900, 900],
    top_shelf: true,
    door_count: 2,
  },
  { prefs },
)
ok(
  'M8 colunas',
  m8.pieces.some((p) => p.column_index === 1) &&
    m8.pieces.some((p) => p.column_index === 2),
)
ok(
  'M8 maleiro/prateleira',
  m8.pieces.some((p) => p.role === 'prateleira'),
)

const m11 = explodeModule(
  {
    name: 'Nicho aberto',
    typology: 'nicho',
    width_mm: 800,
    height_mm: 400,
    depth_mm: 300,
  },
  { prefs },
)
ok('M11 sem fundo', !m11.pieces.some((p) => p.role === 'fundo'))
ok('M11 cavilha', m11.mountingDevice === 'dowel_only')

if (failed) {
  console.error(`${failed} falha(s)`)
  process.exit(1)
}
console.log('Todos os fixtures BOM OK')
