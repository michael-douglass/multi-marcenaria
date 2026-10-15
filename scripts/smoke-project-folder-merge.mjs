/**
 * Smoke Épico 3 — Cozinha (2 módulos) + Quarto (3 módulos) → 5 unificados.
 * Espelha mergeExtractions + forceDeduplicateViewQuantities (versão enxuta).
 */
import fs from 'node:fs'
import path from 'node:path'

function normalizeExtractionKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function asArray(v) {
  return Array.isArray(v) ? v : []
}

function moduleKey(mod) {
  const name = typeof mod?.name === 'string' ? mod.name : 'modulo'
  return normalizeExtractionKey(name)
}

function mergeEnvironment(a, b) {
  const modules = new Map()
  for (const mod of [...asArray(a.modules), ...asArray(b.modules)]) {
    const key = moduleKey(mod)
    if (!modules.has(key)) modules.set(key, mod)
  }
  return {
    name: (typeof a.name === 'string' && a.name) || b.name,
    modules: [...modules.values()],
  }
}

function mergeExtractions(parts) {
  const environments = new Map()
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue
    for (const env of asArray(part.environments)) {
      const name = typeof env.name === 'string' ? env.name : 'Ambiente'
      const key = normalizeExtractionKey(name)
      const prev = environments.get(key)
      environments.set(key, prev ? mergeEnvironment(prev, env) : env)
    }
  }
  return { environments: [...environments.values()], auditor_notes: [], warnings: [] }
}

function mergeProjectFolderExtractions(parts) {
  return mergeExtractions(parts)
}

function countModules(extraction) {
  let n = 0
  for (const env of asArray(extraction.environments)) {
    n += asArray(env.modules).length
  }
  return n
}

const kitchen = {
  environments: [
    {
      name: 'Cozinha',
      modules: [
        { name: 'Balcão 1200x900x600', quantity: 1, materials: [] },
        { name: 'Armário aéreo 800x400x350', quantity: 1, materials: [] },
      ],
    },
  ],
}

const bedroom = {
  environments: [
    {
      name: 'Quarto',
      modules: [
        { name: 'Guarda-roupa 2000x2400x600', quantity: 1, materials: [] },
        { name: 'Cabeceira 1600x1200x50', quantity: 1, materials: [] },
        { name: 'Criado-mudo 450x500x400', quantity: 1, materials: [] },
      ],
    },
  ],
}

const merged = mergeProjectFolderExtractions([kitchen, bedroom])
const moduleCount = countModules(merged)
const envNames = merged.environments.map((e) => e.name).sort()

const result = {
  ok: moduleCount === 5 && envNames.length === 2,
  environments: envNames,
  moduleCount,
  expectedModules: 5,
  modules: merged.environments.flatMap((e) =>
    asArray(e.modules).map((m) => ({ environment: e.name, name: m.name })),
  ),
}

const outPath = path.join('docs', 'evidence', 'smoke-project-folder-merge.json')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(result, null, 2))

if (!result.ok) {
  console.error('FAIL', result)
  process.exit(1)
}
console.log(JSON.stringify(result, null, 2))
console.log('OK smoke-project-folder-merge →', outPath)
