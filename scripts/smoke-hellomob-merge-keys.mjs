/**
 * Smoke E5 — tipologias HelloMob não colapsam na chave de merge.
 * Uso: node scripts/smoke-hellomob-merge-keys.mjs
 */
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { dirname, join } from 'node:path'

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

const vite = await createServer({
  configFile: false,
  resolve: { alias: { '@': join(root, 'src') } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

const { canonicalModuleName, moduleFamilyKey } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/merge-extraction.ts',
)

const a = 'Armário com 1 coluna 860 mm x 750 mm x 600 mm'
const b = 'Armário com 1 coluna 900 mm x 1180 mm x 600 mm'
ok(canonicalModuleName(a) !== canonicalModuleName(b), 'colunas distintas')
ok(moduleFamilyKey(a) !== moduleFamilyKey(b), 'family keys distintas')

ok(
  canonicalModuleName('Lateral de tamponamento 560x2400x18') ===
    'Lateral de tamponamento 560x2400x18' ||
    /Lateral de tamponamento/.test(canonicalModuleName('Lateral de tamponamento 560x2400x18')),
  'preserva Lateral de tamponamento',
)
ok(
  /Rodapé/.test(canonicalModuleName('Estrutura rodape avulsa 2000x100x15')),
  `Rodapé canônico (got ${canonicalModuleName('Estrutura rodape avulsa 2000x100x15')})`,
)
ok(
  /Vista horizontal/.test(canonicalModuleName('Vista horizontal 800x100')),
  'Vista horizontal',
)
ok(
  /Balcão gavetas/.test(canonicalModuleName('Balcão gavetas iguais 800x720x560')),
  `Balcão gavetas (got ${canonicalModuleName('Balcão gavetas iguais 800x720x560')})`,
)
ok(
  canonicalModuleName('Balcão gavetas iguais') === 'Balcão gavetas',
  'Balcão gavetas sem dims não vira Bancada',
)
ok(
  canonicalModuleName('Painel avulso') === 'Painel avulso',
  'Painel avulso (não Painel TV genérico obrigatório)',
)

const latA = moduleFamilyKey('Lateral de tamponamento', {
  dimensions: { width_mm: 560, height_mm: 2400, depth_mm: 18 },
})
const latB = moduleFamilyKey('Lateral de tamponamento', {
  dimensions: { width_mm: 400, height_mm: 2100, depth_mm: 18 },
})
ok(latA !== latB, `laterais com dims distintas não colapsam (${latA} vs ${latB})`)

await vite.close()

if (failed) {
  console.error(`FAILED ${failed}`)
  process.exit(1)
}
console.log('OK hellomob merge keys E5')
