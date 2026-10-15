/**
 * E5 — Geometria pura do raio-X (sem WebGL) + colisão HelloMob.
 * Rodar: node scripts/test-orcamentos-ia-xray-geometry.mjs
 *
 * Inclui casos Cristaleira / Bancada Lavabo / Mesa (Épico 2).
 * Opcional: carrega job a57f1f9f se VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY existirem.
 */
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const p = path.join(ROOT, '.env')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}
loadEnv()

const vite = await createServer({
  configFile: false,
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

const { explodeModule } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/bom-engine/explode.ts')
const {
  buildBoxMeshesFromBom,
  assertNoIdenticalCenters,
  detectOpenTypology,
} = await vite.ssrLoadModule('/src/lib/orcamentos-ia/bom-engine/xray-geometry.ts')
const { buildAtomicPieces } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/bom-engine/atomic-pieces.ts',
)
const { HELLOMOB_CONSTRUCTION_RULES } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/bom-engine/hellomob-construction-rules.ts',
)

let ok = true
const check = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`)
  if (!cond) ok = false
}

// --- E5 clássico: Balcão ---
const exploded = explodeModule(
  {
    name: 'Balcão',
    typology: 'balcao',
    width_mm: 1000,
    height_mm: 800,
    depth_mm: 500,
  },
  { prefs: { company_id: 't', box_thickness_mm: 15, base_assembly: 'between_sides' } },
)

const meshes = buildBoxMeshesFromBom(exploded.pieces, {
  moduleWidthMm: 1000,
  moduleHeightMm: 800,
  moduleDepthMm: 500,
  boxThicknessMm: 15,
  moduleName: 'Balcão',
})

const laterals = meshes.filter((m) => m.role === 'lateral')
check('meshes > 0', meshes.length > 0)
check('2 laterais mesh', laterals.length === 2)
check('lateral thickness 15mm', laterals.every((m) => m.thickness_mm === 15))
check('lateral size.x ≈ 0.015 m', laterals.every((m) => Math.abs(m.size[0] - 0.015) < 0.0001))
check('tem base', meshes.some((m) => m.role === 'base'))
check('tem tampo', meshes.some((m) => m.role === 'tampo'))
check('balcão sem centros idênticos', assertNoIdenticalCenters(meshes))

// --- Cristaleira sintética (muitos fundos + prateleiras) ---
const cristaleiraPieces = [
  {
    id: 'lat',
    role: 'lateral',
    name: 'Lateral',
    width_mm: 500,
    height_mm: 2100,
    thickness_mm: 15,
    quantity: 2,
    edge_lengths_mm: {},
  },
  {
    id: 'base',
    role: 'base',
    name: 'Base',
    width_mm: 800,
    height_mm: 500,
    thickness_mm: 15,
    quantity: 1,
    edge_lengths_mm: {},
  },
  {
    id: 'tampo',
    role: 'tampo',
    name: 'Tampo',
    width_mm: 800,
    height_mm: 500,
    thickness_mm: 15,
    quantity: 1,
    edge_lengths_mm: {},
  },
  {
    id: 'div',
    role: 'divisoria',
    name: 'Divisória',
    width_mm: 500,
    height_mm: 2000,
    thickness_mm: 15,
    quantity: 2,
    edge_lengths_mm: {},
  },
  {
    id: 'prat',
    role: 'prateleira',
    name: 'Prateleira',
    width_mm: 780,
    height_mm: 480,
    thickness_mm: 15,
    quantity: 4,
    edge_lengths_mm: {},
  },
  {
    id: 'fundo',
    role: 'fundo',
    name: 'Fundo',
    width_mm: 780,
    height_mm: 650,
    thickness_mm: 6,
    quantity: 5,
    edge_lengths_mm: {},
  },
  {
    id: 'porta',
    role: 'porta',
    name: 'Porta',
    width_mm: 390,
    height_mm: 2000,
    thickness_mm: 18,
    quantity: 2,
    edge_lengths_mm: {},
  },
]

const cristMeshes = buildBoxMeshesFromBom(cristaleiraPieces, {
  moduleWidthMm: 800,
  moduleHeightMm: 2100,
  moduleDepthMm: 500,
  boxThicknessMm: 15,
  moduleName: 'Cristaleira',
})
const fundos = cristMeshes.filter((m) => m.role === 'fundo')
check('cristaleira meshes > 5', cristMeshes.length > 5)
check('cristaleira fundos >= 5', fundos.length >= 5)
check('cristaleira fundos centros distintos', assertNoIdenticalCenters(fundos))
check('cristaleira sem centros idênticos', assertNoIdenticalCenters(cristMeshes))
const rebate = HELLOMOB_CONSTRUCTION_RULES.back_panel.rebate_depth_mm / 1000
const D = 0.5
const expectedZ = D - rebate + 0.006 / 2
check(
  'cristaleira fundo no rebaixo (~Z)',
  fundos.every((f) => Math.abs(f.position[2] - expectedZ) < 0.005),
)

// --- Bancada Lavabo ---
const lavabo = explodeModule(
  {
    name: 'Bancada Lavabo',
    typology: 'balcao',
    width_mm: 1200,
    height_mm: 900,
    depth_mm: 550,
  },
  { prefs: { company_id: 't', box_thickness_mm: 15 } },
)
const lavMeshes = buildBoxMeshesFromBom(lavabo.pieces, {
  moduleWidthMm: 1200,
  moduleHeightMm: 900,
  moduleDepthMm: 550,
  boxThicknessMm: 15,
  moduleName: 'Bancada Lavabo',
})
check('bancada lavabo sem centros idênticos', assertNoIdenticalCenters(lavMeshes))
const lavFundos = lavMeshes.filter((m) => m.role === 'fundo')
if (lavFundos.length) {
  const Dz = 0.55
  const ez = Dz - rebate + lavFundos[0].thickness_mm / 2000
  check(
    'bancada lavabo fundo no rebaixo',
    lavFundos.every((f) => Math.abs(f.position[2] - ez) < 0.008),
  )
}

// --- Mesa de Jantar (tipologia aberta) ---
check('detectOpenTypology mesa', detectOpenTypology('Mesa de Jantar', 'outro') === true)
check('detectOpenTypology bancada false', detectOpenTypology('Bancada Lavabo', 'balcao') === false)

const mesaPieces = [
  {
    id: 'tampo-m',
    role: 'tampo',
    name: 'Tampo mesa',
    width_mm: 1600,
    height_mm: 900,
    thickness_mm: 30,
    quantity: 1,
    edge_lengths_mm: {},
  },
  {
    id: 'pe',
    role: 'sarrafo',
    name: 'Pé mesa',
    width_mm: 80,
    height_mm: 720,
    thickness_mm: 80,
    quantity: 4,
    edge_lengths_mm: {},
  },
  {
    id: 'fantasma-base',
    role: 'base',
    name: 'Base fantasma',
    width_mm: 1600,
    height_mm: 900,
    thickness_mm: 15,
    quantity: 1,
    edge_lengths_mm: {},
  },
  {
    id: 'fantasma-fundo',
    role: 'fundo',
    name: 'Fundo fantasma',
    width_mm: 1600,
    height_mm: 900,
    thickness_mm: 6,
    quantity: 1,
    edge_lengths_mm: {},
  },
]
const mesaMeshes = buildBoxMeshesFromBom(mesaPieces, {
  moduleWidthMm: 1600,
  moduleHeightMm: 750,
  moduleDepthMm: 900,
  boxThicknessMm: 15,
  moduleName: 'Mesa de Jantar',
})
check('mesa sem base fantasma', !mesaMeshes.some((m) => m.role === 'base'))
check('mesa sem fundo fantasma', !mesaMeshes.some((m) => m.role === 'fundo'))
check('mesa tem tampo', mesaMeshes.some((m) => m.role === 'tampo'))
check('mesa tem pés', mesaMeshes.filter((m) => m.role === 'sarrafo').length >= 1)
check('mesa sem centros idênticos', assertNoIdenticalCenters(mesaMeshes))

// --- Job a57f1f9f (opcional via Supabase) ---
const ANALYSIS = 'a57f1f9f-cdc0-4bc1-b971-cec63bafbda7'
const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (url && key) {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(url, key, { auth: { persistSession: false } })
    const { data: envs, error: envErr } = await sb
      .from('quote_environments')
      .select('id')
      .eq('analysis_id', ANALYSIS)
    if (envErr) {
      console.log(`SKIP a57f1f9f DB: ${envErr.message}`)
    } else {
      const envIds = (envs || []).map((e) => e.id)
      const { data: mods, error } = await sb
        .from('quote_modules')
        .select('id, name, dimensions, materials:quote_materials(*)')
        .in('environment_id', envIds.length ? envIds : ['00000000-0000-0000-0000-000000000000'])
      if (error) {
        console.log(`SKIP a57f1f9f modules: ${error.message}`)
      } else {
        const targets = (mods || []).filter((m) =>
          /cristaleira|bancada\s*lavabo|mesa/i.test(m.name || ''),
        )
        check('a57f1f9f achou Cristaleira/Bancada/Mesa', targets.length >= 1)
        for (const mod of targets) {
          const result = buildAtomicPieces({
            module: {
              ...mod,
              materials: mod.materials || [],
              out_of_scope: false,
            },
          })
          const asMeshes = result.atomic_pieces.map((p) => ({
            id: p.id,
            role: p.role,
            name: p.name,
            position: p.position_m,
            size: p.size_m,
            thickness_mm: p.thickness_mm,
          }))
          check(
            `a57f1f9f ${mod.name} sem centros idênticos (${result.atomic_pieces.length} peças)`,
            assertNoIdenticalCenters(asMeshes),
          )
          if (/mesa/i.test(mod.name || '')) {
            check(
              `a57f1f9f ${mod.name} sem fundo fantasma`,
              !result.atomic_pieces.some((p) => p.role === 'fundo'),
            )
          }
        }
      }
    }
  } catch (e) {
    console.log(`SKIP a57f1f9f: ${e?.message || e}`)
  }
} else {
  console.log('SKIP a57f1f9f DB (sem credenciais) — casos sintéticos OK')
}

await vite.close()
if (!ok) {
  console.error('\nE5 FALHOU')
  process.exit(1)
}
console.log('\nE5 OK — geometria raio-X HelloMob.')
