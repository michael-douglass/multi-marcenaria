/**
 * Merge e dedupe de extracoes Planilha 4.0.
 * Ambiente/modulo com mesmo nome normalizado viram um so;
 * materiais iguais somam quantidade.
 */

export interface InventoryEnv {
  environment: string
  modules: string[]
}

const BEDROOM_ONLY_RE = /guarda.?roupa|roupeiro|cabeceira|criado.?mudo/
const SOCIAL_ENV_RE = /gourmet|cozinha|lavabo|lavanderia|jantar|area\s*gourmet|espaco\s*gourmet/

export function normalizeExtractionKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Limpa inventário: sem tipologias de quarto em gourmet/cozinha e sem "ferragens" genérico. */
export function sanitizeInventory(inventory: InventoryEnv[]): InventoryEnv[] {
  const byKey = new Map<string, InventoryEnv>()
  for (const env of inventory || []) {
    const envKey = normalizeExtractionKey(env.environment || '')
    if (!envKey) continue
    const modules = (env.modules || [])
      .map((m) => String(m || '').trim())
      .filter(Boolean)
      .filter((m) => {
        const modKey = normalizeExtractionKey(m)
        if (/^ferragens?$/.test(modKey)) return false
        if (BEDROOM_ONLY_RE.test(modKey) && SOCIAL_ENV_RE.test(envKey)) return false
        if (/lavanderia/.test(envKey) && !/lavanderia|tanque|maquina|máquina/.test(modKey)) return false
        return true
      })
    const prev = byKey.get(envKey)
    if (!prev) {
      byKey.set(envKey, { environment: env.environment, modules: [...new Set(modules)] })
    } else {
      prev.modules = [...new Set([...(prev.modules || []), ...modules])]
      if ((env.environment || '').length > (prev.environment || '').length) {
        prev.environment = env.environment
      }
    }
  }
  let cleaned = [...byKey.values()].filter((e) => e.modules.length > 0)

  const gourmet = cleaned.find((e) => /gourmet/.test(normalizeExtractionKey(e.environment)))
  const cozinha = cleaned.find((e) =>
    /^cozinha$|cozinha gourmet/.test(normalizeExtractionKey(e.environment)),
  )
  if (
    gourmet &&
    cozinha &&
    normalizeExtractionKey(gourmet.environment) !== normalizeExtractionKey(cozinha.environment)
  ) {
    const mergedMods = [...new Set([...(gourmet.modules || []), ...(cozinha.modules || [])])]
    cleaned = cleaned
      .filter((e) => normalizeExtractionKey(e.environment) !== normalizeExtractionKey(cozinha.environment))
      .map((e) =>
        normalizeExtractionKey(e.environment) === normalizeExtractionKey(gourmet.environment)
          ? { ...e, modules: mergedMods }
          : e,
      )
  }
  return cleaned
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
  /** Módulos cotados que não batem com o inventário (possível alucinação). */
  extras: CoverageItem[]
  coveredCount: number
  expectedCount: number
}

/** Match estrito + fuzzy mínimo (evita falso “coberto”). */
export function modulesMatchCoverage(a: string, b: string): boolean {
  const ak = normalizeExtractionKey(a)
  const bk = normalizeExtractionKey(b)
  if (!ak || !bk) return false
  if (ak === bk) return true
  if (ak.length >= 6 && bk.length >= 6 && (ak.includes(bk) || bk.includes(ak))) return true
  const tokensA = ak.split(' ').filter((t) => t.length >= 5)
  const tokensB = bk.split(' ').filter((t) => t.length >= 5)
  if (tokensA.length >= 2 && tokensA.every((t) => bk.includes(t))) return true
  if (tokensB.length >= 2 && tokensB.every((t) => ak.includes(t))) return true
  return false
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
        if (mod.out_of_scope === true) continue
        const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
        extracted.push({ environment: envName, module: modName })
      }
    }
  }

  const missing = expected.filter(
    (item) =>
      !extracted.some(
        (ex) =>
          modulesMatchCoverage(item.module, ex.module) &&
          (modulesMatchCoverage(item.environment, ex.environment) ||
            normalizeExtractionKey(item.environment) ===
              normalizeExtractionKey(ex.environment)),
      ),
  )

  const extras =
    expected.length === 0
      ? []
      : extracted.filter(
          (item) =>
            !expected.some(
              (ex) =>
                modulesMatchCoverage(item.module, ex.module) &&
                (modulesMatchCoverage(item.environment, ex.environment) ||
                  normalizeExtractionKey(item.environment) ===
                    normalizeExtractionKey(ex.environment)),
            ),
        )

  return {
    expected,
    extracted,
    missing,
    extras,
    coveredCount: expected.length - missing.length,
    expectedCount: expected.length,
  }
}

function moduleDims(mod: AnyRec): { h: number; d: number; w: number } {
  const dims =
    mod.dimensions && typeof mod.dimensions === 'object' ? (mod.dimensions as AnyRec) : null
  return {
    h: Number(dims?.height_mm) || 0,
    d: Number(dims?.depth_mm) || 0,
    w: Number(dims?.width_mm) || 0,
  }
}

function isDiningTableHint(nameKey: string, descKey: string, h: number, d: number, w: number): boolean {
  const blob = `${nameKey} ${descKey}`
  if (/jantar|belize|organico|escrivaninha|tampo organico|mesa de jantar/.test(blob)) return true
  if (h >= 700 && h <= 820 && (d >= 900 || w >= 2400)) return true
  return false
}

function shouldRenameMesaToBancada(nameKey: string, descKey: string, h: number, d: number): boolean {
  if (!/\bmesa\b/.test(nameKey)) return false
  if (/cabeceira|centro|jantar|belize|organico|escrivaninha/.test(nameKey)) return false
  if (isDiningTableHint(nameKey, descKey, h, d, 0)) return false
  const bancadaDims = h >= 850 && h <= 980 && d >= 500 && d <= 750
  const counterHint = /cooktop|pia|churras|bancada|ilha|balcao|fogao|forno/.test(`${nameKey} ${descKey}`)
  return bancadaDims || counterHint
}

function fixWrongBancadaLabel(
  modName: string,
  descKey: string,
  h: number,
  d: number,
  w: number,
): string | null {
  const nameKey = normalizeExtractionKey(modName)
  if (!/bancada/.test(nameKey)) return null
  if (/lavabo|pia|cooktop|ilha|churras|balcao/.test(`${nameKey} ${descKey}`)) return null
  if (isDiningTableHint(nameKey, descKey, h, d, w) || /mesa|jantar|belize|organico/.test(descKey)) {
    return modName.replace(/bancada/gi, 'Mesa')
  }
  return null
}

/** Separa Lavabo real; funde Cozinha+Gourmet; ignora Lavanderia fantasma do ASSUNTO. */
export function rebalanceEnvironments(extraction: unknown): unknown {
  if (!extraction || typeof extraction !== 'object') return extraction
  const root = extraction as AnyRec
  const notes: string[] = Array.isArray(root.auditor_notes)
    ? [...(root.auditor_notes as string[])]
    : []
  const buckets = new Map<string, { name: string; modules: AnyRec[] }>()

  const put = (envName: string, mod: AnyRec) => {
    const key = normalizeExtractionKey(envName)
    const prev = buckets.get(key)
    const modKey = normalizeExtractionKey(typeof mod.name === 'string' ? mod.name : 'Modulo')
    if (!prev) {
      buckets.set(key, { name: envName, modules: [mod] })
      return
    }
    const existing = prev.modules.findIndex(
      (m) => normalizeExtractionKey(typeof m.name === 'string' ? m.name : '') === modKey,
    )
    if (existing >= 0) prev.modules[existing] = { ...prev.modules[existing], ...mod }
    else prev.modules.push(mod)
    if (envName.length > prev.name.length) prev.name = envName
  }

  const hasGourmetLabel = asArray(root.environments).some((e) =>
    /gourmet/.test(normalizeExtractionKey(typeof e.name === 'string' ? e.name : '')),
  )
  const defaultSocial = hasGourmetLabel ? 'Espaço Gourmet' : 'Cozinha'

  for (const env of asArray(root.environments)) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    const envKey = normalizeExtractionKey(envName)
    for (const mod of asArray(env.modules)) {
      let modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const descKey = normalizeExtractionKey(
        typeof mod.description === 'string' ? mod.description : '',
      )
      let nameKey = normalizeExtractionKey(modName)
      const blob = `${nameKey} ${descKey}`
      const { h, d, w } = moduleDims(mod)

      const fixed = fixWrongBancadaLabel(modName, descKey, h, d, w)
      if (fixed) {
        notes.push(`Renomeado "${modName}" → "${fixed}" (mesa de jantar, não bancada).`)
        modName = fixed
        nameKey = normalizeExtractionKey(modName)
      }

      if (BEDROOM_ONLY_RE.test(nameKey) && SOCIAL_ENV_RE.test(envKey)) {
        notes.push(`Removido "${modName}" de "${envName}": tipologia de quarto sem evidência.`)
        continue
      }

      const isKitchenFurniture =
        /cooktop|churras|ilha|geladeira|cristaleira|forno|fogao|fogão|gourmet|adega|microondas/.test(
          blob,
        ) || (/bancada/.test(nameKey) && /pia|cooktop|churras/.test(blob))
      const isLavabo = /lavabo/.test(blob) || (/lavabo/.test(envKey) && !isKitchenFurniture)
      const isLavanderia = /lavanderia|tanque|maquina de lavar|máquina de lavar/.test(blob)

      let target = defaultSocial
      if (isLavabo && !isKitchenFurniture) {
        target = 'Lavabo'
        if (!/lavobo|lavabo/.test(nameKey)) {
          modName = /bancada/.test(nameKey) ? 'Bancada Lavabo' : `${modName} Lavabo`
          nameKey = normalizeExtractionKey(modName)
        }
      } else if (isLavanderia && !isKitchenFurniture) target = 'Lavanderia'
      else if (
        !isKitchenFurniture &&
        !/mesa|jantar|painel|armario|armário|ripado|cristaleira|ilha|bancada|torre/.test(blob) &&
        !/cozinha|gourmet|lavabo|lavanderia/.test(envKey)
      ) {
        target = envName
      }

      put(target, { ...mod, name: modName })
    }
  }

  return {
    ...root,
    environments: [...buckets.values()].filter((e) => e.modules.length > 0),
    auditor_notes: [...new Set(notes)],
  }
}

/**
 * Rede de segurança no client: mesa↔bancada só com evidência
 * e remove guarda-roupa sem evidência (página/peças).
 */
export function applyAntiHallucinationHeuristics(extraction: unknown): unknown {
  if (!extraction || typeof extraction !== 'object') return extraction
  const root = extraction as AnyRec
  const notes: string[] = Array.isArray(root.auditor_notes)
    ? [...(root.auditor_notes as string[])]
    : []
  const warnings: string[] = Array.isArray(root.warnings) ? [...(root.warnings as string[])] : []

  const environments = asArray(root.environments)
    .map((env) => {
      const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
      const modules = asArray(env.modules)
        .map((mod) => {
          if (mod.out_of_scope === true) return mod
          const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
          const nameKey = normalizeExtractionKey(modName)
          const descKey = normalizeExtractionKey(
            typeof mod.description === 'string' ? mod.description : '',
          )
          const { h, d, w } = moduleDims(mod)

          const fixedBancada = fixWrongBancadaLabel(modName, descKey, h, d, w)
          if (fixedBancada) {
            notes.push(`Renomeado "${modName}" → "${fixedBancada}" (mesa de jantar, não bancada).`)
            return { ...mod, name: fixedBancada, typology: 'outro' }
          }

          if (shouldRenameMesaToBancada(nameKey, descKey, h, d)) {
            const renamed = modName.replace(/mesa/gi, 'Bancada')
            notes.push(`Renomeado "${modName}" → "${renamed}" (evidência de bancada/ilha).`)
            return { ...mod, name: renamed, typology: 'balcao' }
          }
          return mod
        })
        .filter((mod) => {
          if (mod.out_of_scope === true) return true
          const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
          const nameKey = normalizeExtractionKey(modName)
          const mdf = asArray(mod.caixaria).length + asArray(mod.frentes_portas).length
          const ferragens = asArray(mod.ferragens).length
          const fitas = asArray(mod.fitas_borda_m).length
          const total = mdf + ferragens + fitas
          const page =
            Number(mod.page_number) ||
            (mod.bounding_box && typeof mod.bounding_box === 'object'
              ? Number((mod.bounding_box as AnyRec).page)
              : 0) ||
            0
          // Schema Zod exige ≥1 material: módulo vazio derruba o orçamento inteiro
          if (total === 0) {
            notes.push(
              `Removido "${modName}": sem chapas/ferragens/fitas (vazio ou alucinação).`,
            )
            return false
          }
          if (mdf === 0 && !page && /guarda.?roupa|roupeiro|cabeceira/.test(nameKey)) {
            notes.push(`Removido "${modName}": sem evidência de página/peças (alucinação).`)
            return false
          }
          return true
        })
      return { ...env, modules }
    })
    .filter((env) => asArray(env.modules).length > 0)

  return rebalanceEnvironments({
    ...root,
    environments,
    auditor_notes: [...new Set(notes)],
    warnings: [...new Set(warnings)],
  })
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
