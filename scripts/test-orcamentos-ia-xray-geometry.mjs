/**
 * E5 — Geometria pura do raio-X (sem WebGL).
 * Rodar: node scripts/test-orcamentos-ia-xray-geometry.mjs
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
const { buildBoxMeshesFromBom } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/bom-engine/xray-geometry.ts',
)

let ok = true
const check = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`)
  if (!cond) ok = false
}

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
})

const laterals = meshes.filter((m) => m.role === 'lateral')
check('meshes > 0', meshes.length > 0)
check('2 laterais mesh', laterals.length === 2)
check('lateral thickness 15mm', laterals.every((m) => m.thickness_mm === 15))
check('lateral size.x ≈ 0.015 m', laterals.every((m) => Math.abs(m.size[0] - 0.015) < 0.0001))
check('tem base', meshes.some((m) => m.role === 'base'))
check('tem tampo', meshes.some((m) => m.role === 'tampo'))

await vite.close()
if (!ok) {
  console.error('\nE5 FALHOU')
  process.exit(1)
}
console.log('\nE5 OK — geometria raio-X.')
