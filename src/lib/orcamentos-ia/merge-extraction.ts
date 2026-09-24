/**
 * Merge e dedupe de extracoes Planilha 4.0.
 * Ambiente/modulo com mesmo nome normalizado viram um so;
 * materiais iguais somam quantidade.
 */

export interface InventoryEnv {
  environment: string
  modules: string[]
}

export function normalizeExtractionKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type AnyRec = Record<string, unknown>

function asArray(value: unknown): AnyRec[] {
  if (!Array.isArray(value)) return []
  return value.filter((x) => x && typeof x === 'object') as AnyRec[]
}

function mergeNumeric(a: unknown, b: unknown): number {
  const na = Number(a)
  const nb = Number(b)
  const va = Number.isFinite(na) ? na : 0
  const vb = Number.isFinite(nb) ? nb : 0
  return va + vb
}

function materialKey(item: AnyRec, kind: string): string {
  const name =
    (typeof item.raw_name === 'string' && item.raw_name) ||
    (typeof item.material_name === 'string' && item.material_name) ||
    (typeof item.tape_name === 'string' && item.tape_name) ||
    (typeof item.name === 'string' && item.name) ||
    ''
  const cat = typeof item.category === 'string' ? item.category : kind
  return `${kind}|${cat}|${normalizeExtractionKey(name)}`
}

function mergeMaterialList(existing: AnyRec[], incoming: AnyRec[], kind: string): AnyRec[] {
  const map = new Map<string, AnyRec>()
  for (const item of [...existing, ...incoming]) {
    const key = materialKey(item, kind)
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { ...item })
      continue
    }
    const next = { ...prev }
    for (const qtyKey of ['quantity', 'exact_quantity', 'full_units_quantity', 'meters']) {
      if (qtyKey in item || qtyKey in prev) {
        next[qtyKey] = mergeNumeric(prev[qtyKey], item[qtyKey])
      }
    }
    map.set(key, next)
  }
  return [...map.values()]
}

function mergeModule(a: AnyRec, b: AnyRec): AnyRec {
  return {
    ...a,
    ...b,
    name: (typeof a.name === 'string' && a.name) || b.name,
    description: a.description || b.description,
    dimensions: a.dimensions && Object.keys(a.dimensions as object).length ? a.dimensions : b.dimensions,
    bounding_box: a.bounding_box || b.bounding_box,
    caixaria: mergeMaterialList(asArray(a.caixaria), asArray(b.caixaria), 'caixaria'),
    frentes_portas: mergeMaterialList(
      asArray(a.frentes_portas),
      asArray(b.frentes_portas),
      'frente',
    ),
    ferragens: mergeMaterialList(asArray(a.ferragens), asArray(b.ferragens), 'ferragem'),
    fitas_borda_m: mergeMaterialList(asArray(a.fitas_borda_m), asArray(b.fitas_borda_m), 'fita'),
  }
}

function mergeEnvironment(a: AnyRec, b: AnyRec): AnyRec {
  const modules = new Map<string, AnyRec>()
  for (const mod of [...asArray(a.modules), ...asArray(b.modules)]) {
    const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
    const key = normalizeExtractionKey(name)
    const prev = modules.get(key)
    modules.set(key, prev ? mergeModule(prev, mod) : { ...mod })
  }
  return {
    ...a,
    name: (typeof a.name === 'string' && a.name) || b.name,
    modules: [...modules.values()],
  }
}

/** Une varias extracoes em uma, sem duplicar ambiente/modulo/material. */
export function mergeExtractions(parts: unknown[]): AnyRec {
  const environments = new Map<string, AnyRec>()
  const auditorNotes: string[] = []
  const warnings: string[] = []

  for (const part of parts) {
    if (!part || typeof part !== 'object') continue
    const root = part as AnyRec
    if (Array.isArray(root.auditor_notes)) {
      for (const n of root.auditor_notes) {
        if (typeof n === 'string' && n.trim()) auditorNotes.push(n.trim())
      }
    }
    if (Array.isArray(root.warnings)) {
      for (const w of root.warnings) {
        if (typeof w === 'string' && w.trim()) warnings.push(w.trim())
      }
    }
    for (const env of asArray(root.environments)) {
      const name = typeof env.name === 'string' ? env.name : 'Ambiente'
      const key = normalizeExtractionKey(name)
      const prev = environments.get(key)
      environments.set(key, prev ? mergeEnvironment(prev, env) : { ...env })
    }
  }

  return {
    environments: [...environments.values()],
    auditor_notes: [...new Set(auditorNotes)],
    warnings: [...new Set(warnings)],
  }
}

export interface CoverageItem {
  environment: string
  module: string
}

export interface CoverageReport {
  expected: CoverageItem[]
  extracted: CoverageItem[]
  missing: CoverageItem[]
  coveredCount: number
  expectedCount: number
}

export function buildCoverageReport(
  inventory: InventoryEnv[],
  extraction: unknown,
): CoverageReport {
  const expected: CoverageItem[] = []
  for (const env of inventory) {
    for (const mod of env.modules) {
      expected.push({ environment: env.environment, module: mod })
    }
  }

  const extracted: CoverageItem[] = []
  if (extraction && typeof extraction === 'object') {
    for (const env of asArray((extraction as AnyRec).environments)) {
      const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
      for (const mod of asArray(env.modules)) {
        const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
        extracted.push({ environment: envName, module: modName })
      }
    }
  }

  const extractedKeys = new Set(
    extracted.map(
      (i) => `${normalizeExtractionKey(i.environment)}::${normalizeExtractionKey(i.module)}`,
    ),
  )

  const missing = expected.filter((item) => {
    const key = `${normalizeExtractionKey(item.environment)}::${normalizeExtractionKey(item.module)}`
    if (extractedKeys.has(key)) return false
    const modKey = normalizeExtractionKey(item.module)
    for (const k of extractedKeys) {
      const extractedMod = k.split('::')[1] || ''
      if (!extractedMod) continue
      if (extractedMod === modKey) return false
      if (extractedMod.includes(modKey) || modKey.includes(extractedMod)) return false
      const tokensExp = modKey.split(' ').filter((t) => t.length >= 4)
      if (tokensExp.length && tokensExp.every((t) => extractedMod.includes(t))) return false
      const tokensExt = extractedMod.split(' ').filter((t) => t.length >= 4)
      if (tokensExt.length >= 2 && tokensExt.filter((t) => modKey.includes(t)).length >= 2) {
        return false
      }
    }
    return true
  })

  return {
    expected,
    extracted,
    missing,
    coveredCount: expected.length - missing.length,
    expectedCount: expected.length,
  }
}

/**
 * Marca `out_of_scope` em pedra/alvenaria/decoração sem MDF.
 * Não cria mais ferragem placeholder — esses módulos ficam fora do custo.
 * Bancada de MDF sob granito (com caixaria/frentes) continua no escopo.
 */
export function ensureModulePlaceholder(mod: AnyRec): AnyRec {
  if (isStoreBoughtModule(mod)) return { ...mod, out_of_scope: true }
  const mdfPieces = asArray(mod.caixaria).length + asArray(mod.frentes_portas).length
  if (mdfPieces > 0) {
    return mod.out_of_scope === true ? { ...mod, out_of_scope: false } : mod
  }
  if (!isOutOfScopeModule(mod)) return mod
  return { ...mod, out_of_scope: true }
}

const OUT_OF_SCOPE_HINTS = [
  'tapete',
  'quadro',
  'puff',
  'pendente',
  'arandela',
  'led',
  'luminaria',
  'luminária',
  'westwing',
  'nordecor',
  'portofino',
  'pendurador',
  'espelho',
  'almofada',
  'cortina',
  'vaso',
  'planta',
  'objeto decor',
  'decoracao',
  'decoração',
  // Marmoraria / obra civil — cotados por terceiros
  'granito',
  'marmore',
  'mármore',
  'quartzo',
  'silestone',
  'dekton',
  'porcelanato',
  'alvenaria',
  'gesso',
  'drywall',
]

/** Móveis/decoração comprados prontos em loja — nunca são marcenaria, mesmo com "peças". */
const STORE_BRAND_HINTS = ['westwing', 'nordecor', 'portofino', 'tok stok', 'tokstok', 'mobly', 'etna', 'desk design', 'oppa']

export function isStoreBoughtModule(mod: AnyRec): boolean {
  const name = normalizeExtractionKey(typeof mod.name === 'string' ? mod.name : '')
  return STORE_BRAND_HINTS.some((h) => name.includes(normalizeExtractionKey(h)))
}

export function isOutOfScopeModule(mod: AnyRec): boolean {
  if (mod.out_of_scope === true) return true
  const name = normalizeExtractionKey(typeof mod.name === 'string' ? mod.name : '')
  return OUT_OF_SCOPE_HINTS.some((h) => name.includes(normalizeExtractionKey(h)))
}

export function isPlaceholderFerragem(item: AnyRec): boolean {
  const raw = typeof item.raw_name === 'string' ? item.raw_name : ''
  return /a confirmar|placeholder|fora de escopo/i.test(raw)
}

export interface BomGap {
  environment: string
  module: string
  reason: string
}

/** Checklist: módulo de marcenaria precisa de chapa (caixaria/frente) e sem placeholder. */
export function findMarcenariaBomGaps(extraction: unknown): BomGap[] {
  const gaps: BomGap[] = []
  if (!extraction || typeof extraction !== 'object') return gaps
  for (const env of asArray((extraction as AnyRec).environments)) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    for (const mod of asArray(env.modules)) {
      const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      if (isOutOfScopeModule(mod)) continue
      const caixaria = asArray(mod.caixaria)
      const frentes = asArray(mod.frentes_portas)
      const ferragens = asArray(mod.ferragens)
      const hasChapa = caixaria.length + frentes.length > 0
      if (!hasChapa) {
        gaps.push({
          environment: envName,
          module: modName,
          reason: 'Sem caixaria/frente (chapa MDF) cotada',
        })
      }
      if (ferragens.some(isPlaceholderFerragem) && caixaria.length + frentes.length === 0) {
        gaps.push({
          environment: envName,
          module: modName,
          reason: 'Apenas placeholder — falta detalhar chapas e ferragens',
        })
      }
      if (!hasChapa && ferragens.length === 0 && asArray(mod.fitas_borda_m).length === 0) {
        gaps.push({
          environment: envName,
          module: modName,
          reason: 'Módulo de marcenaria sem materiais',
        })
      }
    }
  }
  // dedupe by env+module+reason
  const seen = new Set<string>()
  return gaps.filter((g) => {
    const k = `${g.environment}|${g.module}|${g.reason}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export function buildPageImagePath(
  companyId: string,
  analysisId: string,
  page: number | null | undefined,
  existingPaths?: string[] | null,
): string | null {
  const n = Number(page)
  if (!Number.isFinite(n) || n < 1) return null
  const stem = `page-${String(Math.floor(n)).padStart(3, '0')}.`
  const fromExisting = (existingPaths || []).find((p) => {
    const name = p.split('/').pop() || p
    return name.toLowerCase().startsWith(stem)
  })
  if (fromExisting) return fromExisting
  // Pipeline atual grava JPEG; análises antigas podem ter .png no Storage.
  return `${companyId}/${analysisId}/pages/page-${String(Math.floor(n)).padStart(3, '0')}.jpg`
}

export function pageFromBoundingBox(bbox: unknown): number | null {
  if (!bbox || typeof bbox !== 'object') return null
  const page = Number((bbox as AnyRec).page)
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : null
}
