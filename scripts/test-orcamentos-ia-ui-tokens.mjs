/**
 * E3 — Smoke tokens Corte Claude (accent #0066FF, sem purple genérico).
 * Rodar: node scripts/test-orcamentos-ia-ui-tokens.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vite = await createServer({
  configFile: false,
  resolve: { alias: { '@': join(root, 'src') } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

const tokens = await vite.ssrLoadModule('/src/lib/orcamentos-ia/ui-tokens.ts')

let ok = true
const check = (label, cond) => {
  console.log(`${cond ? 'OK' : 'FAIL'} ${label}`)
  if (!cond) ok = false
}

check('accent é #0066FF', tokens.CORTE_CLAUDE_TOKENS.accent === '#0066FF')
check('CSS var --cc-accent', tokens.CORTE_CLAUDE_CSS_VARS['--cc-accent'] === '#0066FF')

const forbidden = tokens.FORBIDDEN_PURPLE_MARKERS
const moduleFiles = [
  'src/pages/orcamentos-ia/index.tsx',
  'src/components/orcamentos-ia/OrcamentosIaShaderBackdrop.tsx',
]
for (const rel of moduleFiles) {
  const src = readFileSync(join(root, rel), 'utf8')
  const hit = forbidden.find((m) => src.includes(m))
  check(`${rel} sem purple genérico`, !hit)
  if (hit) console.log(`  encontrado: ${hit}`)
}
check('lista FORBIDDEN_PURPLE_MARKERS não vazia', forbidden.length > 0)

const indexSrc = readFileSync(join(root, 'src/pages/orcamentos-ia/index.tsx'), 'utf8')
check('hub menciona Corte Claude', indexSrc.includes('Corte Claude'))
check('hub usa CORTE_CLAUDE_CSS_VARS', indexSrc.includes('CORTE_CLAUDE_CSS_VARS'))
check('shader backdrop ainda #0066FF / 0.4,1.0', indexSrc.includes('OrcamentosIaShaderBackdrop'))

const shader = readFileSync(
  join(root, 'src/components/orcamentos-ia/OrcamentosIaShaderBackdrop.tsx'),
  'utf8',
)
check('shader CNC com grade blueprint', shader.includes('blueprint') && shader.includes('0.4, 1.0'))

await vite.close()
if (!ok) {
  console.error('\nE3 FALHOU')
  process.exit(1)
}
console.log('\nE3 OK — tokens e identidade Corte Claude.')
