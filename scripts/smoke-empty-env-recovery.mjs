/**
 * Smoke: environments [] + inventário → ensureExtractionHasEnvironments injeta stubs.
 */
function inventoryToCoverageItems(inventory) {
  const out = []
  for (const env of inventory) {
    for (const mod of env.modules || []) {
      out.push({ environment: env.environment, module: mod })
    }
  }
  return out
}

function ensureExtractionHasEnvironments(extraction, inventory) {
  const envs = Array.isArray(extraction?.environments) ? extraction.environments : []
  if (envs.length > 0) return extraction
  const missing = inventoryToCoverageItems(inventory)
  if (!missing.length) {
    return {
      ...extraction,
      environments: [{ name: 'Ambiente (lote parcial)', modules: [{ name: 'Módulo a confirmar' }] }],
    }
  }
  const byEnv = new Map()
  for (const item of missing) {
    if (!byEnv.has(item.environment)) byEnv.set(item.environment, [])
    byEnv.get(item.environment).push({
      name: item.module,
      description: `Injetado para cobrir inventário: ${item.module}`,
      dimensions: { width_mm: 800, height_mm: 720, depth_mm: 560 },
      caixaria: [{ name: 'Lateral', quantity: 2, width_mm: 560, height_mm: 720 }],
    })
  }
  return {
    ...extraction,
    environments: [...byEnv.entries()].map(([name, modules]) => ({ name, modules })),
    warnings: [
      ...(extraction.warnings || []),
      'Módulos injetados do inventário com cotas estimadas.',
    ],
  }
}

const inventory = [
  { environment: 'Cozinha', modules: ['Armário inferior', 'Prateleira'] },
  { environment: 'Sala de Jantar', modules: ['Mesa de jantar'] },
  { environment: 'Hall de Entrada', modules: ['Aparador'] },
]

const empty = {
  environments: [],
  warnings: ['Página 5 é imagem ilustrativa'],
  auditor_notes: ['sem cotas'],
}

const recovered = ensureExtractionHasEnvironments(empty, inventory)
if (!recovered.environments.length) {
  console.error('FAIL still empty')
  process.exit(1)
}
const modCount = recovered.environments.reduce((n, e) => n + e.modules.length, 0)
if (modCount !== 4) {
  console.error('FAIL modCount', modCount)
  process.exit(1)
}
console.log('OK smoke-empty-env-recovery', {
  environments: recovered.environments.length,
  modules: modCount,
})
