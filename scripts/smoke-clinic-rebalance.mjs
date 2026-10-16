/**
 * Smoke E6 — clínica não cria Quarto Suíte fantasma.
 * Uso: node scripts/smoke-clinic-rebalance.mjs
 */
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
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

const { rebalanceEnvironments } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/rebalance.ts',
)
const { evaluateCircuitBreaker, findDrawerSlideGaps } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/circuit-breaker.ts',
)

const clinic = rebalanceEnvironments(
  {
    environments: [
      {
        name: 'Recepção',
        modules: [{ name: 'Painel avulso', typology: 'painel', caixaria: [], frentes_portas: [], ferragens: [] }],
      },
      {
        name: 'Quarto Suíte',
        modules: [
          {
            name: 'Gaveteiro',
            typology: 'gaveteiro',
            drawer_count: 3,
            caixaria: [],
            frentes_portas: [{ kind: 'frente_gaveta', name: 'G1', quantity: 1 }],
            ferragens: [],
          },
        ],
      },
      {
        name: 'Banheiros',
        modules: [{ name: 'Nicho', typology: 'nicho', caixaria: [], frentes_portas: [], ferragens: [] }],
      },
    ],
    auditor_notes: [],
  },
  // Inventário antigo com fantasma — não deve “ligar” modo dormitório
  [
    { environment: 'Recepção', modules: ['Painel'] },
    { environment: 'Sala Renata', modules: ['Balcão'] },
    { environment: 'Quarto Suíte', modules: ['Gaveteiro'] },
  ],
)

const envNames = (clinic.environments || []).map((e) => e.name)
ok(!envNames.some((n) => /quarto|banheiro/i.test(n)), `sem fantasma (envs=${envNames.join(', ')})`)
ok(envNames.some((n) => /recep/i.test(n)), 'mantém Recepção')

const gap = findDrawerSlideGaps(
  {
    environments: [
      {
        name: 'Recepção',
        modules: [
          {
            name: 'Balcão gavetas',
            typology: 'balcao',
            frentes_portas: [
              { kind: 'frente_gaveta', name: 'G1', quantity: 1 },
              { kind: 'frente_gaveta', name: 'G2', quantity: 1 },
            ],
            ferragens: [],
          },
        ],
      },
    ],
  },
  [],
)
ok(gap.drawerModules === 1 && gap.corredicaPairs === 0, 'detecta gap gaveta sem corrediça')

const breaker = evaluateCircuitBreaker({
  extraction: {
    environments: [
      {
        name: 'Recepção',
        modules: [
          {
            name: 'Balcão gavetas',
            typology: 'balcao',
            out_of_scope: false,
            frentes_portas: [{ kind: 'frente_gaveta', name: 'G1', quantity: 2 }],
            ferragens: [],
            caixaria: [],
          },
        ],
      },
    ],
  },
  materials: [{ raw_name: 'Chapa — MDF', category: 'chapa', unit_price: 100 }],
  coverage: { expected: [], extracted: [], missing: [], extras: [] },
  pricing: { sale_price: 1000, materials_cost: 500, mpc_margin_pct: 45, pricing_modality: 'mpc_margin' },
  enforceBrancoTx: false,
})
ok(!breaker.ok, 'circuit breaker bloqueia')
ok(
  breaker.blockers.some((b) => /corredi/i.test(b)),
  `blocker menciona corrediças (${breaker.blockers.join(' | ')})`,
)

await vite.close()
if (failed) {
  console.error(`FAILED ${failed}`)
  process.exit(1)
}
console.log('OK clinic rebalance + drawer coverage E6')
