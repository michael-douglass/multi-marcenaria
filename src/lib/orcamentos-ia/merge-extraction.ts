/**
 * Merge e dedupe de extracoes Planilha 4.0 / Corte Claude v12.
 * Ambiente/modulo com mesmo nome normalizado viram um so;
 * peças com mesma chave (função|nome|cotas) usam MAX — nunca somam lotes/vistas.
 */

import { rebalanceEnvironments } from '@/lib/orcamentos-ia/rebalance'

export { rebalanceEnvironments } from '@/lib/orcamentos-ia/rebalance'
export {
  clampGeometryBounds,
  splitMixedPainelModules,
  GEOMETRY_BOUNDS,
} from '@/lib/orcamentos-ia/geometry-bounds'

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

const MATERIAL_COLOR_TOKENS = new Set([
  'noite',
  'branco',
  'tx',
  'louro',
  'freijo',
  'carvalho',
  'hanover',
  'reflecta',
  'mdf',
  'arauco',
  'duratex',
  'cor',
  'projeto',
  'mm',
])

/** Extrai cotas L×A(×P) do nome (HelloMob / Cortecloud). */
export function dimsTokenFromName(raw: string): string | null {
  const m = String(raw || '')
    .replace(/,/g, '.')
    .match(
      /(\d+(?:\.\d+)?)\s*(?:mm)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?(?:\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?)?/i,
    )
  if (!m) return null
  const a = Math.round(Number(m[1]))
  const b = Math.round(Number(m[2]))
  if (!(a > 0 && b > 0)) return null
  const c = m[3] != null ? Math.round(Number(m[3])) : null
  return c != null && c > 0 ? `${a}x${b}x${c}` : `${a}x${b}`
}

function dimsTokenFromMod(mod?: Record<string, unknown> | null): string | null {
  if (!mod?.dimensions || typeof mod.dimensions !== 'object') return null
  const d = mod.dimensions as Record<string, unknown>
  const w = Number(d.width_mm)
  const h = Number(d.height_mm)
  const depth = Number(d.depth_mm)
  if (!(w > 0 && h > 0)) return null
  return depth > 0 ? `${Math.round(w)}x${Math.round(h)}x${Math.round(depth)}` : `${Math.round(w)}x${Math.round(h)}`
}

/**
 * Nome curto alinhado ao inventário (sem cor/material/sufixos de vista).
 * HelloMob: preserva tipologia + cotas (Armário 1 coluna 860x750x600 ≠ 900x1180x600).
 * Ex.: "Ilha (Noite)" → "Ilha"; "Mesa Belize 3,00 m" → "Mesa de jantar".
 */
export function canonicalModuleName(name: string): string {
  let raw = String(name || '').trim()
  if (!raw) return 'Modulo'
  // Remove parênteses e sufixo após " - "
  raw = raw.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ')
  const dash = raw.indexOf(' - ')
  if (dash > 0) raw = raw.slice(0, dash)
  const dims = dimsTokenFromName(raw)
  let key = normalizeExtractionKey(raw)

  // ── HelloMob atômico (NÃO colapsar tipologias fabril DET_CLÍNICA / Quarto) ──
  if (/\b1\s*coluna\b/.test(key) || /armario\s+com\s+1\s+coluna/.test(key)) {
    return dims ? `Armário 1 coluna ${dims}` : 'Armário 1 coluna'
  }
  if (/porta\s+avulsa/.test(key)) {
    return dims ? `Porta avulsa ${dims}` : 'Porta avulsa'
  }
  if (/vista\s+horizontal/.test(key)) {
    return dims ? `Vista horizontal ${dims}` : 'Vista horizontal'
  }
  if (/vista\s+vertical/.test(key)) {
    return dims ? `Vista vertical ${dims}` : 'Vista vertical'
  }
  if (/lateral\s+(de\s+)?tamponamento|tamponamento\s+lateral|^lateral\s+de\s+tamponamento/.test(key)) {
    return dims ? `Lateral de tamponamento ${dims}` : 'Lateral de tamponamento'
  }
  if (/tampo\s+(para\s+)?tamponamento|tamponamento\s+tampo/.test(key)) {
    return dims ? `Tampo para tamponamento ${dims}` : 'Tampo para tamponamento'
  }
  if (/estrutura\s+rodape|rodape\s+avuls|\brodape\b/.test(key)) {
    return dims ? `Rodapé ${dims}` : 'Rodapé'
  }
  if (/balcao\s+gavetas|balcao_gavetas|gavetas\s+iguais/.test(key)) {
    return dims ? `Balcão gavetas ${dims}` : 'Balcão gavetas'
  }
  if (/balcao\s+(para\s+)?forno|forno\s+embutido/.test(key)) {
    return dims ? `Balcão forno ${dims}` : 'Balcão forno'
  }
  if (/nicho\s+(com\s+)?prateleiras|\bnicho\b/.test(key) && dims) return `Nicho ${dims}`
  if (/gaveteiro/.test(key) && dims) return `Gaveteiro ${dims}`
  if (/\baereo\b/.test(key) && dims) return `Aéreo ${dims}`
  if (/\bbalcao\b/.test(key) && dims) return `Balcão ${dims}`
  if (/\b(painel\s+ripad|brise|ripado)\b/.test(key)) {
    return dims ? `Painel ripado ${dims}` : 'Painel ripado'
  }
  if (/\bpainel\b/.test(key) && /\b(tv|liso|avulso)\b/.test(key)) {
    return dims ? `Painel avulso ${dims}` : 'Painel avulso'
  }

  key = key
    .replace(/\b\d+([.,]\d+)?\s*(mm|m|cm)\b/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const tokens = key.split(' ').filter((t) => t && !MATERIAL_COLOR_TOKENS.has(t))
  key = tokens.join(' ').trim()

  if (/\b(painel\s+ripad|brise|ripado)\b/.test(key)) return 'Painel ripado'
  if (/\bpainel\b/.test(key) && /\b(tv|liso|avulso)\b/.test(key)) return 'Painel avulso'
  if (/^painel$/.test(key)) return 'Painel avulso'
  if (/estrutura\s+rodape|rodape\s+avuls|\brodape\b/.test(key)) return 'Rodapé'
  if (/vista\s+horizontal/.test(key)) return 'Vista horizontal'
  if (/vista\s+vertical/.test(key)) return 'Vista vertical'
  if (/lateral\s+(de\s+)?tamponamento|tamponamento\s+lateral/.test(key)) {
    return 'Lateral de tamponamento'
  }
  if (/tampo\s+(para\s+)?tamponamento|tamponamento\s+tampo/.test(key)) {
    return 'Tampo para tamponamento'
  }
  if (/balcao\s+gavetas|balcao_gavetas|gavetas\s+iguais/.test(key)) return 'Balcão gavetas'
  if (/balcao\s+(para\s+)?forno|forno\s+embutido/.test(key)) return 'Balcão forno'
  // Aceita "mesa de jantar", "mesa belize", "mesa organica" (tokens no meio)
  if (
    /\bmesa\b/.test(key) &&
    (/\b(jantar|belize|organica)\b/.test(key) || /^mesa$/.test(key))
  ) {
    return 'Mesa de jantar'
  }
  if (/torre|geladeira|paneleiro/.test(key) && /torre|geladeira/.test(key)) {
    return 'Torre geladeira'
  }
  if (/cristaleira|adega/.test(key)) return 'Cristaleira'
  if (/lavabo/.test(key) && /bancada|balcao/.test(key)) return 'Bancada Lavabo'
  if (/^ilha\b|\bilha\b/.test(key)) return 'Ilha'
  // Bancada genérica — NÃO engolir "Balcão gavetas" (já tratado acima)
  if (/bancada|balcao\s*inferior|balcao\s*parede/.test(key) && !/gavet/.test(key)) {
    return 'Bancada'
  }
  if (/gaveteiro/.test(key)) return 'Gaveteiro'
  if (/aereo|aereos/.test(key)) return 'Aéreo'
  if (/\bbalcao\b/.test(key) && /gavet/.test(key)) return 'Balcão gavetas'
  if (/\bbalcao\b/.test(key)) return 'Balcão'
  // Guarda-roupas monolítico sem cotas → Armário (auditor deve splitar)
  if (/guarda\s*roupas?|roupeiro/.test(key)) return 'Armário'
  if (/armario/.test(key)) return 'Armário'

  // Title-case residual short name
  if (!key) return 'Modulo'
  return key
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Chave de família física para merge (Ilha Noite ≡ Ilha balcão; colunas HelloMob ≠ entre si). */
export function moduleFamilyKey(name: string, mod?: Record<string, unknown> | null): string {
  const canon = canonicalModuleName(name)
  let key = normalizeExtractionKey(canon)
  if (/\d+\s*x\s*\d+/.test(key)) return key
  const dims = dimsTokenFromMod(mod) || dimsTokenFromName(name)
  if (
    dims &&
    /(armario|balcao|bancada|nicho|gaveteiro|porta|painel|vista|lateral|tampo|rodape|forno)/.test(
      key,
    )
  ) {
    return normalizeExtractionKey(`${canon} ${dims}`)
  }
  return key
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
        // Quarto em ambiente social: remove. Armário/organizador em lavanderia: mantém.
        if (BEDROOM_ONLY_RE.test(modKey) && SOCIAL_ENV_RE.test(envKey)) return false
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

/** Quantidades entre lotes: MAX (anti-inflação por fusão de vistas). */
function mergeNumericMax(a: unknown, b: unknown): number {
  const na = Number(a)
  const nb = Number(b)
  const va = Number.isFinite(na) ? na : 0
  const vb = Number.isFinite(nb) ? nb : 0
  return Math.max(va, vb)
}

function pieceDimKey(item: AnyRec): string {
  const w = Math.round(Number(item.width_mm) || 0)
  const h = Math.round(Number(item.height_mm) || 0)
  const t = Math.round(Number(item.thickness_mm) || 0)
  const fn =
    typeof item.function === 'string'
      ? item.function
      : typeof item.kind === 'string'
        ? item.kind
        : ''
  return `${normalizeExtractionKey(fn)}|${w}x${h}x${t}`
}

function materialKey(item: AnyRec, kind: string): string {
  const name =
    (typeof item.raw_name === 'string' && item.raw_name) ||
    (typeof item.material_name === 'string' && item.material_name) ||
    (typeof item.tape_name === 'string' && item.tape_name) ||
    (typeof item.name === 'string' && item.name) ||
    ''
  const cat = typeof item.category === 'string' ? item.category : kind
  const dims = kind === 'ferragem' || kind === 'fita' ? '' : `|${pieceDimKey(item)}`
  return `${kind}|${cat}|${normalizeExtractionKey(name)}${dims}`
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
        next[qtyKey] = mergeNumericMax(prev[qtyKey], item[qtyKey])
      }
    }
    // Preferir bounding_box da peça com mais evidência de página
    const prevPage = pageFromBoundingBox(prev.bounding_box) || 0
    const nextPage = pageFromBoundingBox(item.bounding_box) || 0
    if (nextPage > 0 && (prevPage === 0 || nextPage < prevPage)) {
      next.bounding_box = item.bounding_box
    }
    map.set(key, next)
  }
  return [...map.values()]
}

function moduleRichness(mod: AnyRec): number {
  return (
    asArray(mod.caixaria).length +
    asArray(mod.frentes_portas).length +
    asArray(mod.ferragens).length +
    asArray(mod.fitas_borda_m).length
  )
}

function dimsConflict(a: AnyRec, b: AnyRec, tol = 80): boolean {
  const da = moduleDims(a)
  const db = moduleDims(b)
  if (da.w <= 0 || db.w <= 0) return false
  return (
    Math.abs(da.w - db.w) > tol ||
    Math.abs(da.h - db.h) > tol ||
    Math.abs(da.d - db.d) > tol
  )
}

function preferredCanonicalName(a: AnyRec, b: AnyRec): string {
  const richer = moduleRichness(b) > moduleRichness(a) ? b : a
  const raw =
    (typeof richer.name === 'string' && richer.name) ||
    (typeof a.name === 'string' && a.name) ||
    (typeof b.name === 'string' && b.name) ||
    'Modulo'
  return canonicalModuleName(raw)
}

function mergeModule(a: AnyRec, b: AnyRec): AnyRec {
  // Vistas conflitantes da mesma família: fica a mais rica (evita somar Ilha pág.4 + pág.9)
  if (dimsConflict(a, b)) {
    const keep = moduleRichness(b) > moduleRichness(a) ? b : a
    const drop = keep === a ? b : a
    const notes = Array.isArray(keep.auditor_notes) ? [...(keep.auditor_notes as string[])] : []
    notes.push(
      `Vista espelho descartada em "${String(keep.name)}": cotas divergentes entre lotes (anti-fusão v12).`,
    )
    return {
      ...keep,
      name: preferredCanonicalName(a, b),
      _discarded_view: {
        name: drop.name,
        dimensions: drop.dimensions,
        richness: moduleRichness(drop),
      },
      auditor_notes: notes,
    }
  }

  return {
    ...a,
    ...b,
    name: preferredCanonicalName(a, b),
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

export interface DuplicateViewFlag {
  environment: string
  module: string
  reason: string
  laterals?: number
  doors?: number
  tops?: number
}

function pieceAreaScore(p: AnyRec): number {
  const w = Math.max(0, Number(p.width_mm) || 0)
  const h = Math.max(0, Number(p.height_mm) || 0)
  const q = Math.max(1, Number(p.quantity) || 1)
  return w * h * q
}

function maxLateralsCap(mod: AnyRec): number {
  const fam = moduleFamilyKey(typeof mod.name === 'string' ? mod.name : '')
  // Painel/mesa: estrutura pode ter mais peças; caixa tipica = 2 laterais
  if (/painel|mesa|nicho/.test(fam)) return 4
  return 2
}

function maxDoorsCap(mod: AnyRec): number {
  const { w } = moduleDims(mod)
  return w > 0 ? Math.max(4, Math.ceil(w / 300) + 2) : 8
}

/** Mantém peças até o teto de qty (prioriza maior área×quantidade). */
function clampPieceGroup(
  pieces: AnyRec[],
  pred: (p: AnyRec) => boolean,
  maxQty: number,
): { kept: AnyRec[]; removedQty: number } {
  const target = pieces.filter(pred)
  const others = pieces.filter((p) => !pred(p))
  if (target.length === 0 || maxQty < 0) return { kept: pieces, removedQty: 0 }
  const total = target.reduce((s, p) => s + Math.max(1, Number(p.quantity) || 1), 0)
  if (total <= maxQty) return { kept: pieces, removedQty: 0 }

  const sorted = [...target].sort((a, b) => pieceAreaScore(b) - pieceAreaScore(a))
  const keptTarget: AnyRec[] = []
  let remaining = maxQty
  let removedQty = 0
  for (const p of sorted) {
    const q = Math.max(1, Number(p.quantity) || 1)
    if (remaining <= 0) {
      removedQty += q
      continue
    }
    if (q <= remaining) {
      keptTarget.push(p)
      remaining -= q
    } else {
      keptTarget.push({ ...p, quantity: remaining })
      removedQty += q - remaining
      remaining = 0
    }
  }
  return { kept: [...others, ...keptTarget], removedQty }
}

/**
 * Corrige fusão de vistas: colapsa famílias e aplica tetos geométricos
 * (laterais / portas / tampos). Fonte da verdade pós-LLM.
 */
export function forceDeduplicateViewQuantities(extraction: unknown): AnyRec {
  if (!extraction || typeof extraction !== 'object') {
    return { environments: [], auditor_notes: [], warnings: [] }
  }
  const root = extraction as AnyRec
  const globalNotes = Array.isArray(root.auditor_notes)
    ? [...(root.auditor_notes as string[])]
    : []

  const environments = asArray(root.environments).map((env) => {
    const collapsed = collapseModulesByFamily(env)
    const modules = asArray(collapsed.modules).map((mod) => {
      if (mod.out_of_scope === true) {
        return { ...mod, name: canonicalModuleName(typeof mod.name === 'string' ? mod.name : 'Modulo') }
      }
      const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const canon = canonicalModuleName(modName)
      const notes = Array.isArray(mod.auditor_notes) ? [...(mod.auditor_notes as string[])] : []
      let caixaria = asArray(mod.caixaria)
      let frentes = asArray(mod.frentes_portas)

      const latCap = maxLateralsCap({ ...mod, name: canon })
      const lat = clampPieceGroup(
        caixaria,
        (p) => /lateral/.test(normalizeExtractionKey(typeof p.function === 'string' ? p.function : '')),
        latCap,
      )
      caixaria = lat.kept
      if (lat.removedQty > 0) {
        notes.push(
          `Dedup geométrico: laterais reduzidas (~${lat.removedQty} un.) — teto ${latCap} em "${canon}".`,
        )
      }

      const top = clampPieceGroup(
        caixaria,
        (p) => /tampo/.test(normalizeExtractionKey(typeof p.function === 'string' ? p.function : '')),
        2,
      )
      caixaria = top.kept
      if (top.removedQty > 0) {
        notes.push(
          `Dedup geométrico: tampos reduzidos (~${top.removedQty} un.) — teto 2 em "${canon}".`,
        )
      }

      const doorCap = maxDoorsCap({ ...mod, name: canon })
      const doors = clampPieceGroup(frentes, () => true, doorCap)
      frentes = doors.kept
      if (doors.removedQty > 0) {
        notes.push(
          `Dedup geométrico: portas/frentes reduzidas (~${doors.removedQty} un.) — teto ${doorCap} em "${canon}".`,
        )
      }

      return {
        ...mod,
        name: canon,
        caixaria,
        frentes_portas: frentes,
        auditor_notes: notes,
      }
    })
    return { ...collapsed, modules }
  })

  return {
    ...root,
    environments,
    auditor_notes: [...new Set(globalNotes)],
  }
}

/** Tetos plausíveis por módulo — flag para circuit breaker (pós-clamp). */
export function validatePlausibleQuantities(extraction: unknown): DuplicateViewFlag[] {
  const flags: DuplicateViewFlag[] = []
  if (!extraction || typeof extraction !== 'object') return flags
  for (const env of asArray((extraction as AnyRec).environments)) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    for (const mod of asArray(env.modules)) {
      if (mod.out_of_scope === true) continue
      const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      let laterals = 0
      let tops = 0
      for (const p of asArray(mod.caixaria)) {
        const fn = normalizeExtractionKey(typeof p.function === 'string' ? p.function : '')
        const q = Math.max(1, Number(p.quantity) || 1)
        if (/lateral/.test(fn)) laterals += q
        if (/tampo/.test(fn)) tops += q
      }
      let doors = 0
      for (const f of asArray(mod.frentes_portas)) {
        doors += Math.max(1, Number(f.quantity) || 1)
      }
      const maxLaterals = maxLateralsCap(mod)
      const maxDoors = maxDoorsCap(mod)
      if (laterals > maxLaterals) {
        flags.push({
          environment: envName,
          module: modName,
          reason: `Laterais=${laterals} > ${maxLaterals} (possível fusão de vistas)`,
          laterals,
          doors,
          tops,
        })
      }
      if (doors > maxDoors) {
        flags.push({
          environment: envName,
          module: modName,
          reason: `Portas/frentes=${doors} > teto ${maxDoors}`,
          laterals,
          doors,
          tops,
        })
      }
      if (tops > 2) {
        flags.push({
          environment: envName,
          module: modName,
          reason: `Tampos=${tops} > 2 (possível duplicata de lote)`,
          laterals,
          doors,
          tops,
        })
      }
    }
  }
  return flags
}

/** Colapsa variantes do mesmo móvel físico dentro de um ambiente. */
function collapseModulesByFamily(env: AnyRec): AnyRec {
  const modules = new Map<string, AnyRec>()
  for (const mod of asArray(env.modules)) {
    const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
    const key = moduleFamilyKey(name, mod)
    const normalized = { ...mod, name: canonicalModuleName(name) }
    const prev = modules.get(key)
    modules.set(key, prev ? mergeModule(prev, normalized) : normalized)
  }
  return {
    ...env,
    modules: [...modules.values()],
  }
}

function mergeEnvironment(a: AnyRec, b: AnyRec): AnyRec {
  const modules = new Map<string, AnyRec>()
  for (const mod of [...asArray(a.modules), ...asArray(b.modules)]) {
    const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
    const key = moduleFamilyKey(name, mod)
    const normalized = { ...mod, name: canonicalModuleName(name) }
    const prev = modules.get(key)
    modules.set(key, prev ? mergeModule(prev, normalized) : normalized)
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
  const paletteByKey = new Map<string, AnyRec>()

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
    if (Array.isArray(root.project_sheet_palette)) {
      for (const row of root.project_sheet_palette) {
        if (!row || typeof row !== 'object') continue
        const r = row as AnyRec
        const label = typeof r.label === 'string' ? r.label.trim() : ''
        if (!label || /jatob/i.test(label)) continue
        const th = Number(r.thickness_mm) || 15
        const role = typeof r.role === 'string' ? r.role : 'front_color'
        const key = `${label.toLowerCase()}|${th}|${role}`
        if (!paletteByKey.has(key)) {
          paletteByKey.set(key, { label, thickness_mm: th, role })
        }
      }
    }
    for (const env of asArray(root.environments)) {
      const name = typeof env.name === 'string' ? env.name : 'Ambiente'
      const key = normalizeExtractionKey(name)
      const collapsed = collapseModulesByFamily(env)
      const prev = environments.get(key)
      environments.set(key, prev ? mergeEnvironment(prev, collapsed) : collapsed)
    }
  }

  return {
    environments: [...environments.values()],
    auditor_notes: [...new Set(auditorNotes)],
    warnings: [...new Set(warnings)],
    project_sheet_palette: [...paletteByKey.values()],
  }
}

/**
 * Fusão incremental da Pasta de Precificação.
 * Une last_extraction de vários lotes e aplica dedupe de vistas (MAX, não soma).
 */
export function mergeProjectFolderExtractions(parts: unknown[]): AnyRec {
  const usable = (parts || []).filter((p) => p && typeof p === 'object')
  if (!usable.length) {
    return {
      environments: [],
      auditor_notes: [],
      warnings: [],
      project_sheet_palette: [],
    }
  }
  return forceDeduplicateViewQuantities(mergeExtractions(usable))
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

/** Match estrito + família canônica + fuzzy mínimo (evita falso “coberto”). */
export function modulesMatchCoverage(a: string, b: string): boolean {
  const famA = moduleFamilyKey(a)
  const famB = moduleFamilyKey(b)
  if (famA && famB && famA === famB) return true
  const ak = normalizeExtractionKey(a)
  const bk = normalizeExtractionKey(b)
  if (!ak || !bk) return false
  if (ak === bk) return true
  if (ak.length >= 4 && bk.length >= 4 && (ak.includes(bk) || bk.includes(ak))) return true
  const tokensA = ak.split(' ').filter((t) => t.length >= 4)
  const tokensB = bk.split(' ').filter((t) => t.length >= 4)
  if (tokensA.length >= 1 && tokensA.every((t) => bk.includes(t)) && tokensA.some((t) => t.length >= 4)) {
    return tokensA.length >= 2 || famA === famB || ak === famB || bk === famA
  }
  if (tokensB.length >= 2 && tokensB.every((t) => ak.includes(t))) return true
  return false
}

/** Nota gravada em módulos criados pela injeção forçada do Self-Heal. */
export const FORCED_INJECT_NOTE = 'injeção forçada self-heal: cobertura inventário'

function guessMaterialFromModuleName(name: string): string {
  const m = String(name || '').match(/MDF\s+[^,;.()]+/i)
  if (m) {
    const raw = m[0].replace(/\s+/g, ' ').trim()
    return /\d+\s*mm/i.test(raw) ? raw : `${raw} 18mm`
  }
  return 'MDF 18mm'
}

function medianPositive(values: number[], fallback: number): number {
  const sorted = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (!sorted.length) return fallback
  return sorted[Math.floor(sorted.length / 2)]!
}

/**
 * Infere cotas a partir dos irmãos do ambiente (mediana) + tipología do nome.
 * Painel TV: profundidade típica de chapa (~18 mm).
 */
function inferInjectDims(env: AnyRec, moduleName: string): {
  width_mm: number
  height_mm: number
  depth_mm: number
} {
  const siblings = asArray(env.modules)
  const widths: number[] = []
  const heights: number[] = []
  const depths: number[] = []
  for (const mod of siblings) {
    const d = moduleDims(mod)
    if (d.w > 0) widths.push(d.w)
    if (d.h > 0) heights.push(d.h)
    if (d.d > 0) depths.push(d.d)
  }
  const fam = moduleFamilyKey(moduleName)
  if (/painel/.test(fam)) {
    return {
      width_mm: medianPositive(widths, 1800),
      height_mm: medianPositive(
        heights.filter((h) => h >= 1800),
        medianPositive(heights, 2400),
      ),
      depth_mm: 18,
    }
  }
  return {
    width_mm: medianPositive(widths, 800),
    height_mm: medianPositive(heights, 720),
    depth_mm: medianPositive(depths, 500),
  }
}

function buildInjectCaixaria(
  moduleName: string,
  dims: { width_mm: number; height_mm: number; depth_mm: number },
  material: string,
): AnyRec[] {
  const fam = moduleFamilyKey(moduleName)
  const mat = material.includes('mm') ? material : `${material} 18mm`
  if (/painel/.test(fam)) {
    const perimeterM =
      Math.round(((2 * (dims.width_mm + dims.height_mm)) / 1000) * 1000) / 1000
    return [
      {
        name: /ripad/.test(fam) ? 'Ripado' : 'Painel',
        function: 'painel',
        width_mm: dims.width_mm,
        height_mm: dims.height_mm,
        thickness_mm: 18,
        material_name: mat,
        quantity: 1,
        dimensions_estimated: true,
        edge_banding: {
          C1: true,
          C2: true,
          L1: true,
          L2: true,
          tape_name: 'Fita 22 mm',
          meters: perimeterM,
        },
      },
    ]
  }
  const w = dims.width_mm
  const h = dims.height_mm
  const d = dims.depth_mm
  const thickness = 15
  const bandFront = {
    C1: true,
    C2: false,
    L1: false,
    L2: false,
    tape_name: 'Fita 22 mm',
    meters: Math.round((w / 1000) * 1000) / 1000,
  }
  return [
    {
      name: 'Lateral esquerda',
      function: 'lateral',
      width_mm: d,
      height_mm: h,
      thickness_mm: thickness,
      material_name: mat.replace(/18mm/i, '15mm'),
      quantity: 1,
      dimensions_estimated: true,
      edge_banding: {
        ...bandFront,
        meters: Math.round((h / 1000) * 1000) / 1000,
      },
    },
    {
      name: 'Lateral direita',
      function: 'lateral',
      width_mm: d,
      height_mm: h,
      thickness_mm: thickness,
      material_name: mat.replace(/18mm/i, '15mm'),
      quantity: 1,
      dimensions_estimated: true,
      edge_banding: {
        ...bandFront,
        meters: Math.round((h / 1000) * 1000) / 1000,
      },
    },
    {
      name: 'Base',
      function: 'base',
      width_mm: w,
      height_mm: d,
      thickness_mm: thickness,
      material_name: mat.replace(/18mm/i, '15mm'),
      quantity: 1,
      dimensions_estimated: true,
      edge_banding: bandFront,
    },
    {
      name: 'Fundo',
      function: 'fundo',
      width_mm: w,
      height_mm: h,
      thickness_mm: 6,
      material_name: 'MDF 6mm',
      quantity: 1,
      dimensions_estimated: true,
      edge_banding: { C1: false, C2: false, L1: false, L2: false, meters: 0 },
    },
  ]
}

/** Achata inventário-âncora em itens de cobertura (para injeção). */
export function inventoryToCoverageItems(inventory: InventoryEnv[]): CoverageItem[] {
  const out: CoverageItem[] = []
  for (const env of inventory) {
    const envName = typeof env.environment === 'string' ? env.environment.trim() : ''
    if (!envName) continue
    for (const mod of env.modules || []) {
      const name = typeof mod === 'string' ? mod.trim() : ''
      if (!name) continue
      out.push({ environment: envName, module: name })
    }
  }
  return out
}

/**
 * Se a Edge devolveu environments vazio (ex.: página só render/ilustrativa)
 * mas o inventário tem móveis, injeta stubs estimados para não derrubar o lote.
 */
export function ensureExtractionHasEnvironments(
  extraction: unknown,
  inventory: InventoryEnv[],
): AnyRec {
  const root =
    extraction && typeof extraction === 'object'
      ? ({ ...(extraction as AnyRec) } as AnyRec)
      : ({ environments: [], auditor_notes: [], warnings: [] } as AnyRec)
  const envs = asArray(root.environments)
  if (envs.length > 0) return root
  const missing = inventoryToCoverageItems(inventory)
  if (!missing.length) {
    // Sem inventário e sem ambientes: stub mínimo para o schema (NEEDS_REVIEW depois).
    return {
      ...root,
      environments: [
        {
          name: 'Ambiente (lote parcial)',
          modules: [
            ensureModulePlaceholder({
              name: 'Módulo a confirmar',
              description: 'Lote sem móveis extraídos — revise as páginas selecionadas.',
              out_of_scope: false,
              auditor_notes: ['Stub: extrator devolveu environments vazio'],
              caixaria: [],
              frentes_portas: [],
              ferragens: [],
              fitas_borda_m: [],
            }),
          ],
        },
      ],
      warnings: [
        ...(Array.isArray(root.warnings) ? (root.warnings as string[]) : []),
        'Extrator não encontrou móveis nas páginas do lote — gerado stub para revisão manual.',
      ],
    }
  }
  const injected = injectMissingInventoryModules(root, missing)
  const warnings = Array.isArray(injected.warnings)
    ? [...(injected.warnings as string[])]
    : []
  warnings.push(
    'Páginas do lote sem BOM técnico completo (ex.: render/ilustração). Módulos injetados do inventário com cotas estimadas — confira na auditoria.',
  )
  return { ...injected, warnings: [...new Set(warnings)] }
}

/**
 * Injeção forçada determinística: garante 100% de cobertura do inventário
 * sem re-extrair o PDF. Preserva módulos já existentes.
 */
export function injectMissingInventoryModules(
  extraction: unknown,
  missing: CoverageItem[],
): AnyRec {
  const root =
    extraction && typeof extraction === 'object'
      ? ({ ...(extraction as AnyRec) } as AnyRec)
      : ({ environments: [], auditor_notes: [], warnings: [] } as AnyRec)

  const environments = asArray(root.environments).map((env) => ({
    ...env,
    modules: [...asArray(env.modules)],
  }))

  for (const item of missing) {
    let envIdx = environments.findIndex((env) => {
      const envName = typeof env.name === 'string' ? env.name : ''
      return (
        modulesMatchCoverage(envName, item.environment) ||
        normalizeExtractionKey(envName) === normalizeExtractionKey(item.environment)
      )
    })
    if (envIdx < 0) {
      environments.push({ name: item.environment, modules: [] })
      envIdx = environments.length - 1
    }
    const env = environments[envIdx]!
    const already = asArray(env.modules).some((mod) =>
      modulesMatchCoverage(typeof mod.name === 'string' ? mod.name : '', item.module),
    )
    if (already) continue

    const shortName = canonicalModuleName(item.module)
    const dims = inferInjectDims(env, item.module)
    const material = guessMaterialFromModuleName(item.module)
    const caixaria = buildInjectCaixaria(shortName, dims, material)
    let fitaMeters = 0
    for (const p of caixaria) {
      const eb =
        p.edge_banding && typeof p.edge_banding === 'object'
          ? (p.edge_banding as AnyRec)
          : null
      const m = Number(eb?.meters)
      if (Number.isFinite(m) && m > 0) fitaMeters += m * (Number(p.quantity) || 1)
    }

    const injected: AnyRec = {
      name: shortName,
      description: `Injetado para cobrir inventário: ${item.module}`,
      dimensions: dims,
      caixaria,
      frentes_portas: [],
      ferragens: [],
      fitas_borda_m:
        fitaMeters > 0
          ? [{ tape_name: 'Fita 22 mm', meters: Math.round(fitaMeters * 1000) / 1000 }]
          : [],
      auditor_notes: [FORCED_INJECT_NOTE],
      bounding_box: null,
    }

    env.modules = [...asArray(env.modules), ensureModulePlaceholder(injected)]
    environments[envIdx] = env
  }

  const prevNotes = Array.isArray(root.auditor_notes)
    ? root.auditor_notes.filter((n): n is string => typeof n === 'string')
    : []
  return {
    ...root,
    environments,
    auditor_notes: [...new Set([...prevNotes, FORCED_INJECT_NOTE])],
  }
}

/**
 * Amplia o inventário-âncora com módulos cobráveis já extraídos das pranchas.
 * Evita “cobertura 100%” falsa quando a capa listou só 3–4 móveis e o PDF tem dezenas.
 */
export function expandInventoryFromExtraction(
  inventory: InventoryEnv[],
  extraction: unknown,
): InventoryEnv[] {
  const fromExtraction: InventoryEnv[] = []
  if (extraction && typeof extraction === 'object') {
    for (const env of asArray((extraction as AnyRec).environments)) {
      const envName = typeof env.name === 'string' ? env.name.trim() : ''
      if (!envName) continue
      const modules: string[] = []
      for (const mod of asArray(env.modules)) {
        if (mod.out_of_scope === true) continue
        const modName = typeof mod.name === 'string' ? mod.name.trim() : ''
        if (!modName) continue
        modules.push(modName)
      }
      if (modules.length) {
        fromExtraction.push({ environment: envName, modules: [...new Set(modules)] })
      }
    }
  }
  return sanitizeInventory([...(inventory || []), ...fromExtraction])
}

/** Conta módulos cobráveis (não out_of_scope) na árvore. */
export function countBillableModules(extraction: unknown): number {
  if (!extraction || typeof extraction !== 'object') return 0
  let n = 0
  for (const env of asArray((extraction as AnyRec).environments)) {
    for (const mod of asArray(env.modules)) {
      if (mod.out_of_scope === true) continue
      n += 1
    }
  }
  return n
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
 * Tipologias de marcenaria (caixaria) — NUNCA podem ser out_of_scope.
 * Paridade Cortecloud #23125828 / Flaviane: todo MDF/MDP/madeira entra no orçamento.
 */
export const BOX_MODULE_RE =
  /ilha|balcao|bancada|armario|aereo|torre|cristaleira|gaveteiro|roupeiro|paneleiro|nicho|painel|mesa|prateleira|cozinhas|guarda.?roupa|cabeceira|criado|escrivaninha|home.?office|aparador|espelheira|porta/

/** Tipologias Zod de marcenaria (schemas.ts) — forçam in-scope. */
const MARCENARIA_TYPOLOGIES = new Set([
  'balcao',
  'aereo',
  'armario_correr',
  'armario_giro',
  'nicho',
  'painel',
  'gaveteiro',
])

export function isMarcenariaModule(mod: AnyRec): boolean {
  if (isStoreBoughtModule(mod)) return false
  const typology = typeof mod.typology === 'string' ? mod.typology : ''
  if (MARCENARIA_TYPOLOGIES.has(typology)) return true
  const name = normalizeExtractionKey(typeof mod.name === 'string' ? mod.name : '')
  return BOX_MODULE_RE.test(name)
}

/**
 * Marca `out_of_scope` só em pedra/alvenaria/decoração/loja sem MDF.
 * Marcenaria (tipologia/caixa) permanece SEMPRE no escopo — completa BOM mínimo se faltar.
 */
export function ensureModulePlaceholder(mod: AnyRec): AnyRec {
  if (isStoreBoughtModule(mod)) return { ...mod, out_of_scope: true }

  const mdfPieces = asArray(mod.caixaria).length + asArray(mod.frentes_portas).length
  if (isMarcenariaModule(mod)) {
    return enrichMinimalCaixariaClient({ ...mod, out_of_scope: false })
  }

  if (mdfPieces > 0) {
    return mod.out_of_scope === true ? { ...mod, out_of_scope: false } : mod
  }
  if (!isOutOfScopeModule(mod)) return mod
  return { ...mod, out_of_scope: true }
}

const BOX_TYPOLOGY_RE =
  /ilha|balcao|bancada|armario|aereo|torre|cristaleira|gaveteiro|roupeiro|nicho|guarda.?roupa/

/**
 * Completa laterais E+D / base / fundo 6 mm + C1 nas bordas frontais (espelho Edge).
 * Preserva peças já existentes; só acrescenta o que faltar.
 */
function enrichMinimalCaixariaClient(mod: AnyRec): AnyRec {
  const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
  const nameKey = normalizeExtractionKey(name)
  if (!BOX_MODULE_RE.test(nameKey)) return { ...mod, out_of_scope: false }

  const typology = typeof mod.typology === 'string' ? mod.typology : ''
  const needsBox =
    BOX_TYPOLOGY_RE.test(nameKey) ||
    /^(balcao|aereo|armario_|nicho|gaveteiro)/.test(typology)
  // Painel liso/ripado / porta avulsa / vista: não forçar caixa 4 peças
  if (!needsBox || /painel|porta\s+avulsa|vista\s+vertical|tamponamento/.test(nameKey)) {
    return { ...mod, out_of_scope: false }
  }

  const dims = mod.dimensions && typeof mod.dimensions === 'object' ? (mod.dimensions as AnyRec) : {}
  let caixaria = [...asArray(mod.caixaria)]
  const w = Number(dims.width_mm) > 0 ? Number(dims.width_mm) : 800
  const h = Number(dims.height_mm) > 0 ? Number(dims.height_mm) : 720
  const d = Number(dims.depth_mm) > 0 ? Number(dims.depth_mm) : 500
  const openFront = /ilha|bancada|mesa|prateleira/.test(nameKey)
  const mat = 'MDF Branco TX 15mm'
  const bandFront = (lenMm: number): AnyRec => ({
    C1: true,
    C2: false,
    L1: false,
    L2: false,
    tape_name: 'Fita 22 mm cor da frente',
    meters: Math.round((lenMm / 1000) * 1000) / 1000,
  })
  const bandNone: AnyRec = { C1: false, C2: false, L1: false, L2: false, meters: 0 }

  const hasFn = (fn: string) => caixaria.some((c) => String(c.function || '') === fn)
  const lateralCount = caixaria.filter((c) => String(c.function || '') === 'lateral').length

  if (lateralCount === 0) {
    caixaria.push(
      {
        name: 'Lateral esquerda',
        function: 'lateral',
        width_mm: d,
        height_mm: h,
        thickness_mm: 15,
        material_name: mat,
        quantity: 1,
        edge_banding: bandFront(h),
      },
      {
        name: 'Lateral direita',
        function: 'lateral',
        width_mm: d,
        height_mm: h,
        thickness_mm: 15,
        material_name: mat,
        quantity: 1,
        edge_banding: bandFront(h),
      },
    )
  } else if (lateralCount === 1) {
    caixaria.push({
      name: 'Lateral direita',
      function: 'lateral',
      width_mm: d,
      height_mm: h,
      thickness_mm: 15,
      material_name: mat,
      quantity: 1,
      edge_banding: bandFront(h),
    })
  }
  if (!hasFn('base')) {
    caixaria.push({
      name: 'Base',
      function: 'base',
      width_mm: w,
      height_mm: d,
      thickness_mm: 15,
      material_name: mat,
      quantity: 1,
      edge_banding: bandFront(w),
    })
  }
  if (!hasFn('fundo') && !openFront) {
    caixaria.push({
      name: 'Fundo',
      function: 'fundo',
      width_mm: w,
      height_mm: h,
      thickness_mm: 6,
      material_name: 'MDF Branco TX 6mm',
      quantity: 1,
      edge_banding: bandNone,
    })
  }

  // Tipologias caixa fechada (HelloMob / Cortecloud): tampo por cima quando faltar
  const needsTampo =
    !openFront &&
    (/armario|aereo|gaveteiro|roupeiro|guarda.?roupa|torre|cristaleira/.test(nameKey) ||
      /^(armario_|aereo|gaveteiro)/.test(typology))
  if (needsTampo && !hasFn('tampo') && !hasFn('travessa')) {
    caixaria.push({
      name: 'Tampo',
      function: 'tampo',
      width_mm: w,
      height_mm: d,
      thickness_mm: 15,
      material_name: mat,
      quantity: 1,
      edge_banding: bandFront(w),
    })
  }

  // Defaults seguros de fita: fundo → false; lateral/base sem edge → C1
  caixaria = caixaria.map((p) => {
    const fn = String(p.function || '')
    if (p.edge_banding && typeof p.edge_banding === 'object') return p
    if (fn === 'fundo') return { ...p, edge_banding: bandNone }
    if (fn === 'lateral' || fn === 'base' || fn === 'tampo') {
      const len = fn === 'lateral' ? Number(p.height_mm) || h : Number(p.width_mm) || w
      return { ...p, edge_banding: bandFront(len) }
    }
    return p
  })

  return {
    ...mod,
    out_of_scope: false,
    caixaria,
    dimensions: { width_mm: w, height_mm: h, depth_mm: d, ...(dims as object) },
  }
}
/** Só pedra/civil/decoração solta — NÃO inclui LED/espelho (ambíguos em marcenaria). */
const OUT_OF_SCOPE_HINTS = [
  'tapete',
  'quadro',
  'puff',
  'pendente',
  'arandela',
  'luminaria',
  'luminária',
  'westwing',
  'nordecor',
  'portofino',
  'pendurador',
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
  // Vidraçaria / serralheria / equipamentos (não entram no BOM MDF)
  'vidracaria',
  'vidraçaria',
  'blindex',
  'serralheria',
  'maca',
]

/** Decoração solta só-espelho/LED (sem tipologia de caixa). */
const AMBIGUOUS_DECOR_HINTS = ['led', 'espelho']

/** Móveis/decoração comprados prontos em loja — nunca são marcenaria, mesmo com "peças". */
const STORE_BRAND_HINTS = ['westwing', 'nordecor', 'portofino', 'tok stok', 'tokstok', 'mobly', 'etna', 'desk design', 'oppa']

export function isStoreBoughtModule(mod: AnyRec): boolean {
  const name = normalizeExtractionKey(typeof mod.name === 'string' ? mod.name : '')
  return STORE_BRAND_HINTS.some((h) => name.includes(normalizeExtractionKey(h)))
}

export function isOutOfScopeModule(mod: AnyRec): boolean {
  if (isMarcenariaModule(mod)) return false
  if (mod.out_of_scope === true) return true
  const name = normalizeExtractionKey(typeof mod.name === 'string' ? mod.name : '')
  if (OUT_OF_SCOPE_HINTS.some((h) => name.includes(normalizeExtractionKey(h)))) return true
  // LED/espelho sozinhos = decoração; com tipologia de caixa já retornou false acima
  if (AMBIGUOUS_DECOR_HINTS.some((h) => name.includes(normalizeExtractionKey(h)))) return true
  return false
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
