import { createClient } from 'npm:@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'
import {
  ENGINEERING_MODULAR_AUDITOR,
  ENGINEERING_MODULAR_EXTRACTOR,
} from '../_shared/engineering-modular-prompts.ts'
import {
  isClaudeModel,
  llmJson,
  resolveOrcamentosModels,
  type LlmJsonResult,
} from '../_shared/llm-json.ts'

const BATCH_SIZE = 8
const MAX_PAGES = 40

type AnyRec = Record<string, unknown>

type PipelinePhase = 'full' | 'inventory' | 'extract' | 'audit'

interface InventoryEnv {
  environment: string
  modules: string[]
}

interface PipelineBody {
  analysisId: string
  companyId: string
  mode?: 'max' | 'pro'
  pagePaths: string[]
  ragMemoriesPrompt?: string
  /**
   * Fases curtas evitam 504 do gateway (~150s).
   * - inventory: capa → lista de ambientes/móveis
   * - extract: 1 lote de páginas (pagePaths já cortado pelo client)
   * - audit: até 3 passagens anti-alucinação (remover/renomear + completar BOM)
   * - full: comportamento legado (tudo numa chamada — só PDFs pequenos)
   */
  phase?: PipelinePhase
  inventory?: InventoryEnv[]
  extraction?: AnyRec
  /** Feedback do Self-Healing (módulos ausentes) — prefixado no prompt extract/audit. */
  healFeedback?: string
}

const MAX_AUDIT_PASSES = 3
const AUDIT_IMAGES_PER_PASS = 8
/** Claude max: menos imagens/passagens para caber no gateway (~150s). */
const MAX_AUDIT_PASSES_CLAUDE = 2
const AUDIT_IMAGES_PER_PASS_CLAUDE = 4
/** Inventário: amostra capa + meio + fim (não só as 3 primeiras páginas). */
const INVENTORY_MAX_IMAGES = 12
const BEDROOM_ONLY_RE = /guarda.?roupa|roupeiro|cabeceira|criado.?mudo/
const SOCIAL_ENV_RE = /gourmet|cozinha|lavabo|lavanderia|jantar|area\s*gourmet|espaco\s*gourmet/

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}


function asObjArray(value: unknown): AnyRec[] {
  if (!Array.isArray(value)) return []
  return value.filter((x) => x && typeof x === 'object') as AnyRec[]
}

/**
 * Mesma peça (mesmo módulo + mesmo nome) vista em dois lotes ou devolvida pelo Auditor
 * (que reenvia a árvore completa) é a MESMA peça — usa o maior valor, nunca a soma.
 */
function mergeNumeric(a: unknown, b: unknown): number {
  const va = Number.isFinite(Number(a)) ? Number(a) : 0
  const vb = Number.isFinite(Number(b)) ? Number(b) : 0
  return Math.max(va, vb)
}

/** Palavras de família/marca: não diferenciam fitas ("Fita de Borda Arauco Lino" = "Fita Lino"). */
const GENERIC_TAPE_WORDS = new Set(['fita', 'de', 'borda', 'arauco', 'duratex', 'guararapes', 'eucatex', 'berneck', 'mdf', 'pvc', 'mm'])

function tapeIdentityKey(name: string): string {
  const key = normalizeKey(name)
    .split(' ')
    .filter((t) => t && !GENERIC_TAPE_WORDS.has(t) && !/^\d+(mm)?$/.test(t))
    .join(' ')
  return key || normalizeKey(name)
}

function materialKey(item: AnyRec, kind: string): string {
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  // Peça = nome + material (Lateral ≠ Prateleira, mesmo com o mesmo MDF)
  if (kind === 'caixaria' || kind === 'frente') {
    return `${kind}|${normalizeKey(str(item.name))}|${normalizeKey(str(item.material_name))}`
  }
  if (kind === 'fita') return `fita|${tapeIdentityKey(str(item.tape_name))}`
  const name = str(item.raw_name) || str(item.name)
  const cat = str(item.category) || kind
  return `${kind}|${cat}|${normalizeKey(name)}`
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
    caixaria: mergeMaterialList(asObjArray(a.caixaria), asObjArray(b.caixaria), 'caixaria'),
    frentes_portas: mergeMaterialList(asObjArray(a.frentes_portas), asObjArray(b.frentes_portas), 'frente'),
    ferragens: mergeMaterialList(asObjArray(a.ferragens), asObjArray(b.ferragens), 'ferragem'),
    fitas_borda_m: mergeMaterialList(asObjArray(a.fitas_borda_m), asObjArray(b.fitas_borda_m), 'fita'),
  }
}

function mergeEnvironment(a: AnyRec, b: AnyRec): AnyRec {
  const modules = new Map<string, AnyRec>()
  for (const mod of [...asObjArray(a.modules), ...asObjArray(b.modules)]) {
    const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
    const key = normalizeKey(name)
    const prev = modules.get(key)
    modules.set(key, prev ? mergeModule(prev, mod) : { ...mod })
  }
  return {
    ...a,
    name: (typeof a.name === 'string' && a.name) || b.name,
    modules: [...modules.values()],
  }
}

/**
 * Lotes/Auditor às vezes nomeiam o mesmo ambiente de formas diferentes
 * ("Quarto" vs "Quarto Suíte Camila e Otávio"): une quando as palavras de um contêm as do outro.
 */
function sameEnvironmentKey(existingKeys: string[], key: string): string {
  if (existingKeys.includes(key)) return key
  const tokens = (k: string) => k.split(' ').filter((t) => t.length >= 3)
  const mine = tokens(key)
  if (!mine.length) return key
  for (const other of existingKeys) {
    const theirs = tokens(other)
    if (!theirs.length) continue
    const [small, big] = mine.length <= theirs.length ? [mine, theirs] : [theirs, mine]
    if (small.every((t) => big.includes(t))) return other
  }
  return key
}

function mergeExtractions(parts: unknown[]): AnyRec {
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
    for (const env of asObjArray(root.environments)) {
      const name = typeof env.name === 'string' ? env.name : 'Ambiente'
      const key = sameEnvironmentKey([...environments.keys()], normalizeKey(name))
      const prev = environments.get(key)
      if (!prev) {
        environments.set(key, { ...env })
        continue
      }
      // Mantém o nome mais completo ("Quarto Suíte Camila" > "Quarto")
      const merged = mergeEnvironment(prev, env)
      const prevName = typeof prev.name === 'string' ? prev.name : ''
      merged.name = name.length > prevName.length ? name : prevName
      environments.set(key, merged)
    }
  }

  return {
    environments: [...environments.values()],
    auditor_notes: [...new Set(auditorNotes)],
    warnings: [...new Set(warnings)],
  }
}

/** Decoração, iluminação, marmoraria e obra civil — fora do escopo de marcenaria. */
const OUT_OF_SCOPE_HINTS = [
  'tapete',
  'quadro',
  'puff',
  'pendente',
  'arandela',
  'led',
  'luminaria',
  'westwing',
  'nordecor',
  'pendurador',
  'espelho',
  'almofada',
  'cortina',
  'vaso',
  'planta',
  'decoracao',
  'decoração',
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

/** Móveis/decoração comprados prontos em loja — fora do escopo mesmo com "peças". */
const STORE_BRAND_HINTS = ['westwing', 'nordecor', 'portofino', 'tok stok', 'tokstok', 'mobly', 'etna', 'desk design', 'oppa']

/** IA manda edge_banding: null — Zod/client rejeitam; remove a chave. */
function cleanCaixariaEdgeBanding(pieces: AnyRec[]): AnyRec[] {
  return pieces.map((piece) => {
    if (!('edge_banding' in piece)) return piece
    if (piece.edge_banding == null || typeof piece.edge_banding !== 'object') {
      const { edge_banding: _drop, ...rest } = piece
      return rest
    }
    const band = { ...(piece.edge_banding as AnyRec) }
    const meters = Number(band.meters)
    band.meters = Number.isFinite(meters) && meters >= 0 ? meters : 0
    for (const side of ['C1', 'C2', 'L1', 'L2']) {
      if (band[side] == null) band[side] = false
    }
    if (band.tape_name == null) delete band.tape_name
    return { ...piece, edge_banding: band }
  })
}

/** Tipologias que exigem caixa fatiada (paridade Cortecloud). */
const BOX_MODULE_RE =
  /ilha|balcao|bancada|armario|torre|cristaleira|gaveteiro|aereo|roupeiro|paneleiro|cozinhas/

/**
 * Se a IA devolver caixa com 1 peça, completa laterais/base/fundo/tampo a partir das cotas do módulo.
 * Determinístico — não inventa móveis novos, só completa BOM mínimo.
 */
function enrichMinimalCaixaria(mod: AnyRec): AnyRec {
  if (mod.out_of_scope === true) return mod
  const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
  const nameKey = normalizeKey(name)
  if (!BOX_MODULE_RE.test(nameKey)) return mod

  const dims = mod.dimensions && typeof mod.dimensions === 'object' ? (mod.dimensions as AnyRec) : {}
  let caixaria = cleanCaixariaEdgeBanding(asObjArray(mod.caixaria))
  const first = caixaria[0] || {}
  const mat =
    (typeof first.material_name === 'string' && first.material_name) ||
    'MDF 15mm'
  const thickness = Number(first.thickness_mm) > 0 ? Number(first.thickness_mm) : 15
  const w = Number(dims.width_mm) > 0 ? Number(dims.width_mm) : Number(first.width_mm) > 0 ? Number(first.width_mm) : 800
  const h = Number(dims.height_mm) > 0 ? Number(dims.height_mm) : Number(first.height_mm) > 0 ? Number(first.height_mm) : 720
  const d = Number(dims.depth_mm) > 0 ? Number(dims.depth_mm) : 500
  const openFront = /ilha|bancada/.test(nameKey)

  const hasFn = (fn: string) => caixaria.some((c) => String(c.function || '') === fn)
  const bandFront = {
    C1: true,
    C2: false,
    L1: false,
    L2: false,
    tape_name: 'Fita 22 mm',
    meters: Math.round((w / 1000) * 1000) / 1000,
  }
  const bandNone = { C1: false, C2: false, L1: false, L2: false, meters: 0 }

  const push = (piece: AnyRec) => {
    caixaria = [...caixaria, piece]
  }

  if (!hasFn('lateral')) {
    push({
      name: 'Lateral esquerda',
      function: 'lateral',
      width_mm: d,
      height_mm: h,
      thickness_mm: thickness,
      material_name: mat,
      quantity: 1,
      edge_banding: { ...bandFront, meters: Math.round((h / 1000) * 1000) / 1000 },
      dimensions_estimated: true,
    })
    push({
      name: 'Lateral direita',
      function: 'lateral',
      width_mm: d,
      height_mm: h,
      thickness_mm: thickness,
      material_name: mat,
      quantity: 1,
      edge_banding: { ...bandFront, meters: Math.round((h / 1000) * 1000) / 1000 },
      dimensions_estimated: true,
    })
  }
  if (!hasFn('base')) {
    push({
      name: 'Base',
      function: 'base',
      width_mm: w,
      height_mm: d,
      thickness_mm: thickness,
      material_name: mat,
      quantity: 1,
      edge_banding: bandFront,
      dimensions_estimated: true,
    })
  }
  if (!hasFn('fundo') && !openFront) {
    push({
      name: 'Fundo',
      function: 'fundo',
      width_mm: w,
      height_mm: h,
      thickness_mm: 6,
      material_name: mat.includes('MDF') ? mat.replace(/15|18/, '6') : 'MDF 6mm',
      quantity: 1,
      edge_banding: bandNone,
      dimensions_estimated: true,
    })
  }
  if (!hasFn('tampo') && !hasFn('sarrafo') && openFront) {
    push({
      name: 'Tampo',
      function: 'tampo',
      width_mm: w,
      height_mm: d,
      thickness_mm: thickness,
      material_name: mat,
      quantity: 1,
      edge_banding: {
        C1: true,
        C2: true,
        L1: true,
        L2: true,
        tape_name: 'Fita 22 mm',
        meters: Math.round(((2 * (w + d)) / 1000) * 1000) / 1000,
      },
      dimensions_estimated: true,
    })
  }

  caixaria = cleanCaixariaEdgeBanding(caixaria)

  let fitas = asObjArray(mod.fitas_borda_m)
  if (fitas.length === 0) {
    let meters = 0
    for (const p of caixaria) {
      const eb = p.edge_banding && typeof p.edge_banding === 'object' ? (p.edge_banding as AnyRec) : null
      const m = Number(eb?.meters)
      if (Number.isFinite(m) && m > 0) meters += m * (Number(p.quantity) || 1)
    }
    if (meters > 0) {
      fitas = [{ tape_name: 'Fita 22 mm', meters: Math.round(meters * 1000) / 1000 }]
    }
  }

  return {
    ...mod,
    name,
    caixaria,
    fitas_borda_m: fitas,
    dimensions: {
      width_mm: w,
      height_mm: h,
      depth_mm: d,
      ...(typeof dims === 'object' ? dims : {}),
    },
  }
}

function ensurePlaceholders(extraction: AnyRec): AnyRec {
  const environments = asObjArray(extraction.environments).map((env) => {
    const modules = asObjArray(env.modules).map((mod) => {
      const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const nameKey = normalizeKey(name)
      const hinted = mod.out_of_scope === true || OUT_OF_SCOPE_HINTS.some((h) => nameKey.includes(normalizeKey(h)))
      let caixaria = cleanCaixariaEdgeBanding(asObjArray(mod.caixaria))
      if (STORE_BRAND_HINTS.some((h) => nameKey.includes(h))) {
        return { ...mod, name, out_of_scope: true, caixaria: [], frentes_portas: [], ferragens: [], fitas_borda_m: [] }
      }
      const mdfPieces = caixaria.length + asObjArray(mod.frentes_portas).length
      // Com chapa MDF (ex.: bancada sob granito) continua no escopo
      if (mdfPieces > 0) {
        return enrichMinimalCaixaria({ ...mod, caixaria, out_of_scope: undefined })
      }
      if (hinted) {
        // Fora de escopo: listado à parte no cliente, sem insumos nem custo
        return { ...mod, name, out_of_scope: true, caixaria: [], frentes_portas: [], ferragens: [], fitas_borda_m: [] }
      }
      const total = asObjArray(mod.ferragens).length + asObjArray(mod.fitas_borda_m).length
      if (total > 0) return enrichMinimalCaixaria({ ...mod, caixaria, out_of_scope: undefined })
      // Caixa tipada sem peças: completa mínimo determinístico
      if (BOX_MODULE_RE.test(nameKey)) {
        return enrichMinimalCaixaria({ ...mod, name, caixaria: [], out_of_scope: undefined })
      }
      // Marcenaria sem peças: NÃO inventar placeholder — deixa o auditor completar
      return { ...mod, caixaria: [], frentes_portas: [], ferragens: [], fitas_borda_m: [] }
    })
    return { ...env, modules }
  })
  return { ...extraction, environments }
}

function isPlaceholderBbox(bbox: unknown): boolean {
  if (!bbox || typeof bbox !== 'object') return true
  const b = bbox as Record<string, unknown>
  const near = (a: unknown, n: number) => Math.abs(Number(a) - n) < 0.02
  return near(b.x, 0) && near(b.y, 0) && near(b.width, 0.5) && near(b.height, 0.5)
}

function findBomGaps(extraction: AnyRec): Array<{ environment: string; module: string; reason: string }> {
  const gaps: Array<{ environment: string; module: string; reason: string }> = []
  for (const env of asObjArray(extraction.environments)) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    for (const mod of asObjArray(env.modules)) {
      if (mod.out_of_scope === true) continue
      const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const nameKey = normalizeKey(modName)
      const mdfPieces = asObjArray(mod.caixaria).length + asObjArray(mod.frentes_portas).length
      if (mdfPieces === 0 && OUT_OF_SCOPE_HINTS.some((h) => nameKey.includes(normalizeKey(h)))) {
        continue
      }
      const caixaria = asObjArray(mod.caixaria)
      const frentes = asObjArray(mod.frentes_portas)
      const ferragens = asObjArray(mod.ferragens)
      const hasChapa = caixaria.length + frentes.length > 0
      const hasPlaceholder = ferragens.some((f) =>
        /a confirmar|placeholder/i.test(String(f.raw_name || '')),
      )
      if (!hasChapa) {
        gaps.push({
          environment: envName,
          module: modName,
          reason: 'Sem caixaria/frente (chapa MDF) — cotar chapas e ferragens',
        })
      } else if (hasPlaceholder) {
        gaps.push({
          environment: envName,
          module: modName,
          reason: 'Remover placeholder e detalhar ferragens/puxadores',
        })
      }
      const bbox = mod.bounding_box
      const page =
        bbox && typeof bbox === 'object'
          ? Number((bbox as Record<string, unknown>).page)
          : Number(mod.page_number)
      if (!Number.isFinite(page) || page < 1) {
        gaps.push({
          environment: envName,
          module: modName,
          reason: 'Sem bounding_box.page (marcação de página no PDF)',
        })
      } else if (isPlaceholderBbox(bbox)) {
        gaps.push({
          environment: envName,
          module: modName,
          reason: 'Marcação genérica/placeholder — ajustar caixa na página correta do PDF',
        })
      }
    }
  }
  return gaps
}

/** Match de módulos: igualdade normalizada; fuzzy só se o nome curto tiver ≥6 chars. */
function modulesMatch(a: string, b: string): boolean {
  const ak = normalizeKey(a)
  const bk = normalizeKey(b)
  if (!ak || !bk) return false
  if (ak === bk) return true
  if (ak.length >= 6 && bk.length >= 6 && (ak.includes(bk) || bk.includes(ak))) return true
  const tokensA = ak.split(' ').filter((t) => t.length >= 5)
  const tokensB = bk.split(' ').filter((t) => t.length >= 5)
  if (tokensA.length >= 2 && tokensA.every((t) => bk.includes(t))) return true
  if (tokensB.length >= 2 && tokensB.every((t) => ak.includes(t))) return true
  return false
}

function buildCoverage(inventory: Array<{ environment: string; modules: string[] }>, extraction: AnyRec) {
  const expected: Array<{ environment: string; module: string }> = []
  for (const env of inventory) {
    for (const mod of env.modules) expected.push({ environment: env.environment, module: mod })
  }
  const extracted: Array<{ environment: string; module: string }> = []
  for (const env of asObjArray(extraction.environments)) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    for (const mod of asObjArray(env.modules)) {
      if (mod.out_of_scope === true) continue
      extracted.push({
        environment: envName,
        module: typeof mod.name === 'string' ? mod.name : 'Modulo',
      })
    }
  }
  const missing = expected.filter(
    (item) =>
      !extracted.some(
        (ex) =>
          modulesMatch(item.module, ex.module) &&
          (modulesMatch(item.environment, ex.environment) ||
            normalizeKey(item.environment) === normalizeKey(ex.environment)),
      ),
  )
  const extras = extracted.filter(
    (item) =>
      !expected.some(
        (ex) =>
          modulesMatch(item.module, ex.module) &&
          (modulesMatch(item.environment, ex.environment) ||
            normalizeKey(item.environment) === normalizeKey(ex.environment) ||
            expected.length === 0),
      ),
  )
  // Sem inventário: extras só se inventário vazio (não punir extração livre)
  const extrasFinal = expected.length === 0 ? [] : extras
  return {
    expected,
    extracted,
    missing,
    extras: extrasFinal,
    coveredCount: expected.length - missing.length,
    expectedCount: expected.length,
  }
}

function moduleDims(mod: AnyRec): { h: number; d: number; w: number } {
  const dims = mod.dimensions && typeof mod.dimensions === 'object' ? (mod.dimensions as AnyRec) : null
  return {
    h: Number(dims?.height_mm) || 0,
    d: Number(dims?.depth_mm) || 0,
    w: Number(dims?.width_mm) || 0,
  }
}

function isDiningTableHint(nameKey: string, descKey: string, h: number, d: number, w: number): boolean {
  const blob = `${nameKey} ${descKey}`
  if (/jantar|belize|organico|escrivaninha|tampo organico|mesa de jantar/.test(blob)) return true
  // Mesa de jantar típica: ~750 mm de altura e profundidade larga (não bancada 600–700)
  if (h >= 700 && h <= 820 && (d >= 900 || w >= 2400)) return true
  return false
}

/** Só renomeia mesa→bancada com evidência de balcão — NÃO só porque o ambiente é gourmet. */
function shouldRenameMesaToBancada(
  nameKey: string,
  descKey: string,
  h: number,
  d: number,
): boolean {
  if (!/\bmesa\b/.test(nameKey)) return false
  if (/cabeceira|centro|jantar|belize|organico|escrivaninha/.test(nameKey)) return false
  if (isDiningTableHint(nameKey, descKey, h, d, 0)) return false
  const bancadaDims = h >= 850 && h <= 980 && d >= 500 && d <= 750
  const counterHint = /cooktop|pia|churras|bancada|ilha|balcao|fogao|forno/.test(`${nameKey} ${descKey}`)
  return bancadaDims || counterHint
}

function fixWrongBancadaLabel(modName: string, descKey: string, h: number, d: number, w: number): string | null {
  const nameKey = normalizeKey(modName)
  if (!/bancada/.test(nameKey)) return null
  if (/lavabo|pia|cooktop|ilha|churras|balcao/.test(`${nameKey} ${descKey}`)) return null
  if (isDiningTableHint(nameKey, descKey, h, d, w) || /mesa|jantar|belize|organico/.test(descKey)) {
    return modName.replace(/bancada/gi, 'Mesa')
  }
  return null
}

/** Amostra páginas do início, meio e fim para o inventário de ambientes. */
function pickInventoryContents<T>(signedContents: T[], maxImages = INVENTORY_MAX_IMAGES): T[] {
  const n = signedContents.length
  if (n <= maxImages) return signedContents
  const idxs = new Set<number>([0])
  if (n > 1) idxs.add(1)
  idxs.add(n - 1)
  if (n > 2) idxs.add(n - 2)
  const midSlots = Math.max(0, maxImages - idxs.size)
  for (let i = 1; i <= midSlots; i++) {
    idxs.add(Math.min(n - 1, Math.max(0, Math.round((i * (n - 1)) / (midSlots + 1)))))
  }
  return [...idxs].sort((a, b) => a - b).map((i) => signedContents[i])
}

/** Remove alucinações de quarto em ambientes sociais e itens genéricos. */
function sanitizeInventory(inventory: InventoryEnv[]): InventoryEnv[] {
  // Une ambientes com o mesmo nome (ex.: dois "Espaço Gourmet")
  const byKey = new Map<string, InventoryEnv>()
  for (const env of inventory || []) {
    const envKey = normalizeKey(env.environment || '')
    if (!envKey) continue
    const modules = (env.modules || [])
      .map((m) => String(m || '').trim())
      .filter(Boolean)
      .filter((m) => {
        const modKey = normalizeKey(m)
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

  // Capa "Espaço Gourmet" + "Cozinha" do mesmo open-space → um só ambiente
  const gourmet = cleaned.find((e) => /gourmet/.test(normalizeKey(e.environment)))
  const cozinha = cleaned.find((e) => /^cozinha$|cozinha gourmet/.test(normalizeKey(e.environment)))
  if (gourmet && cozinha && normalizeKey(gourmet.environment) !== normalizeKey(cozinha.environment)) {
    const mergedMods = [...new Set([...(gourmet.modules || []), ...(cozinha.modules || [])])]
    cleaned = cleaned
      .filter((e) => normalizeKey(e.environment) !== normalizeKey(cozinha.environment))
      .map((e) =>
        normalizeKey(e.environment) === normalizeKey(gourmet.environment)
          ? { ...e, modules: mergedMods }
          : e,
      )
  }
  return cleaned
}

/**
 * Separa Lavabo real; funde Cozinha+Gourmet; ignora Lavanderia fantasma do ASSUNTO.
 */
function rebalanceEnvironments(extraction: AnyRec): AnyRec {
  const notes: string[] = Array.isArray(extraction.auditor_notes)
    ? [...(extraction.auditor_notes as string[])]
    : []
  const buckets = new Map<string, { name: string; modules: AnyRec[] }>()

  const put = (envName: string, mod: AnyRec) => {
    const key = normalizeKey(envName)
    const prev = buckets.get(key)
    const modKey = normalizeKey(typeof mod.name === 'string' ? mod.name : 'Modulo')
    if (!prev) {
      buckets.set(key, { name: envName, modules: [mod] })
      return
    }
    const existing = prev.modules.findIndex(
      (m) => normalizeKey(typeof m.name === 'string' ? m.name : '') === modKey,
    )
    if (existing >= 0) prev.modules[existing] = mergeModule(prev.modules[existing], mod)
    else prev.modules.push(mod)
    if (envName.length > prev.name.length) prev.name = envName
  }

  const hasGourmetLabel = asObjArray(extraction.environments).some((e) =>
    /gourmet/.test(normalizeKey(typeof e.name === 'string' ? e.name : '')),
  )
  const defaultSocial = hasGourmetLabel ? 'Espaço Gourmet' : 'Cozinha'

  for (const env of asObjArray(extraction.environments)) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    const envKey = normalizeKey(envName)
    for (const mod of asObjArray(env.modules)) {
      let modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const descKey = normalizeKey(typeof mod.description === 'string' ? mod.description : '')
      let nameKey = normalizeKey(modName)
      const blob = `${nameKey} ${descKey}`
      const { h, d, w } = moduleDims(mod)

      const fixed = fixWrongBancadaLabel(modName, descKey, h, d, w)
      if (fixed) {
        notes.push(`Renomeado "${modName}" → "${fixed}" (mesa de jantar, não bancada).`)
        modName = fixed
        nameKey = normalizeKey(modName)
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
        if (!/lavabo/.test(nameKey)) {
          modName = /bancada/.test(nameKey) ? 'Bancada Lavabo' : `${modName} Lavabo`
          nameKey = normalizeKey(modName)
        }
      } else if (isLavanderia && !isKitchenFurniture) target = 'Lavanderia'
      else if (
        !isKitchenFurniture &&
        !/mesa|jantar|painel|armario|armário|ripado|cristaleira|ilha|bancada|torre/.test(blob) &&
        !/cozinha|gourmet|lavabo|lavanderia/.test(envKey)
      ) {
        target = envName // quarto/outro ambiente real
      }

      if (target !== envName && /lavabo|lavanderia|cozinha/.test(envKey)) {
        notes.push(`Movido "${modName}" de "${envName}" → "${target}".`)
      }

      put(target, { ...mod, name: modName })
    }
  }

  return {
    ...extraction,
    environments: [...buckets.values()].filter((e) => e.modules.length > 0),
    auditor_notes: [...new Set(notes)],
  }
}

function findTypologySuspects(
  extraction: AnyRec,
): Array<{ environment: string; module: string; reason: string }> {
  const suspects: Array<{ environment: string; module: string; reason: string }> = []
  for (const env of asObjArray(extraction.environments)) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    for (const mod of asObjArray(env.modules)) {
      if (mod.out_of_scope === true) continue
      const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const nameKey = normalizeKey(modName)
      const descKey = normalizeKey(typeof mod.description === 'string' ? mod.description : '')
      const { h, d } = moduleDims(mod)
      if (shouldRenameMesaToBancada(nameKey, descKey, h, d)) {
        suspects.push({
          environment: envName,
          module: modName,
          reason: 'Possível bancada/ilha rotulada como mesa — renomear se o desenho confirmar',
        })
      }
      if (/bancada/.test(nameKey) && isDiningTableHint(nameKey, descKey, h, d, moduleDims(mod).w)) {
        suspects.push({
          environment: envName,
          module: modName,
          reason: 'Possível mesa de jantar rotulada como bancada — renomear se o desenho confirmar',
        })
      }
      const mdf =
        asObjArray(mod.caixaria).length + asObjArray(mod.frentes_portas).length
      const page =
        Number(mod.page_number) ||
        Number((mod.bounding_box as AnyRec | undefined)?.page) ||
        0
      if (mdf === 0 && !page && /guarda.?roupa|roupeiro|painel tv|cabeceira/.test(nameKey)) {
        suspects.push({
          environment: envName,
          module: modName,
          reason: 'Sem chapa MDF nem página — possível alucinação; remover se não houver evidência',
        })
      }
    }
  }
  return suspects
}

function hallucinationScore(
  gaps: Array<{ environment: string; module: string; reason: string }>,
  coverage: ReturnType<typeof buildCoverage>,
  typology: Array<{ environment: string; module: string; reason: string }>,
): number {
  // missing (móvel do inventário sem cotação) pesa mais — auditor não pode deixar passar
  return (
    gaps.length +
    coverage.missing.length * 2 +
    coverage.extras.length +
    typology.length
  )
}

/** Janela deslizante de páginas centrada em módulos suspeitos / faltantes. */
function pickAuditContents<T extends { path?: string; image_url: string }>(
  signedContents: T[],
  extraction: AnyRec,
  passIndex: number,
  maxImages: number,
): T[] {
  if (signedContents.length <= maxImages) return signedContents
  const pages = new Set<number>()
  for (const env of asObjArray(extraction.environments)) {
    for (const mod of asObjArray(env.modules)) {
      const p =
        Number(mod.page_number) ||
        Number((mod.bounding_box as AnyRec | undefined)?.page) ||
        0
      if (p >= 1) pages.add(p)
    }
  }
  const pageList = [...pages].sort((a, b) => a - b)
  const center =
    pageList.length > 0
      ? pageList[Math.min(passIndex - 1, pageList.length - 1)]
      : Math.min(signedContents.length, 1 + (passIndex - 1) * maxImages)
  const start = Math.max(0, Math.min(signedContents.length - maxImages, center - Math.floor(maxImages / 2) - 1))
  // Alterna janela nas passagens 2–3
  const shift = ((passIndex - 1) * Math.floor(maxImages / 2)) % Math.max(1, signedContents.length - maxImages + 1)
  const from = Math.min(signedContents.length - maxImages, Math.max(0, start + (passIndex > 1 ? shift : 0)))
  return signedContents.slice(from, from + maxImages)
}

/**
 * A árvore do auditor manda (pode remover módulos). Enriquece com materiais
 * da árvore anterior quando o nome do módulo bate.
 */
function applyAuditorTree(previous: AnyRec, audited: AnyRec): AnyRec {
  const prevIndex = new Map<string, AnyRec>()
  for (const env of asObjArray(previous.environments)) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    for (const mod of asObjArray(env.modules)) {
      const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      prevIndex.set(`${normalizeKey(envName)}::${normalizeKey(modName)}`, mod)
    }
  }

  const environments = asObjArray(audited.environments).map((env) => {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    const modules = asObjArray(env.modules).map((mod) => {
      const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const key = `${normalizeKey(envName)}::${normalizeKey(modName)}`
      let prev = prevIndex.get(key)
      if (!prev) {
        for (const [k, v] of prevIndex) {
          const [, pm] = k.split('::')
          if (modulesMatch(modName, pm || '')) {
            prev = v
            break
          }
        }
      }
      if (!prev) return mod
      return mergeModule(prev, mod)
    })
    return { ...env, modules }
  })

  const auditorNotes = [
    ...(Array.isArray(previous.auditor_notes) ? previous.auditor_notes : []),
    ...(Array.isArray(audited.auditor_notes) ? audited.auditor_notes : []),
  ].filter((n): n is string => typeof n === 'string' && n.trim().length > 0)

  const warnings = [
    ...(Array.isArray(previous.warnings) ? previous.warnings : []),
    ...(Array.isArray(audited.warnings) ? audited.warnings : []),
  ].filter((w): w is string => typeof w === 'string' && w.trim().length > 0)

  return {
    ...audited,
    environments,
    auditor_notes: [...new Set(auditorNotes)],
    warnings: [...new Set(warnings)],
  }
}

/** Rede de segurança: bancada↔mesa (só com evidência) e módulos sem evidência. */
function applyHeuristicPrune(extraction: AnyRec): AnyRec {
  const notes: string[] = Array.isArray(extraction.auditor_notes)
    ? [...(extraction.auditor_notes as string[])]
    : []
  const warnings: string[] = Array.isArray(extraction.warnings)
    ? [...(extraction.warnings as string[])]
    : []

  const environments = asObjArray(extraction.environments)
    .map((env) => {
      const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
      const modules = asObjArray(env.modules)
        .map((mod) => {
          if (mod.out_of_scope === true) return mod
          const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
          const nameKey = normalizeKey(modName)
          const descKey = normalizeKey(typeof mod.description === 'string' ? mod.description : '')
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
          const nameKey = normalizeKey(modName)
          const mdf =
            asObjArray(mod.caixaria).length + asObjArray(mod.frentes_portas).length
          const page =
            Number(mod.page_number) ||
            Number((mod.bounding_box as AnyRec | undefined)?.page) ||
            0
          const ferragens = asObjArray(mod.ferragens).length
          if (
            mdf === 0 &&
            ferragens === 0 &&
            !page &&
            /guarda.?roupa|roupeiro|cabeceira/.test(nameKey)
          ) {
            notes.push(`Removido "${modName}": sem evidência de página/peças (alucinação).`)
            return false
          }
          return true
        })
      return { ...env, modules }
    })
    .filter((env) => asObjArray(env.modules).length > 0)

  return rebalanceEnvironments({
    ...extraction,
    environments,
    auditor_notes: [...new Set(notes)],
    warnings: [...new Set(warnings)],
  })
}

const EXTRACTOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['environments', 'auditor_notes', 'warnings'],
  properties: {
    environments: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'modules'],
        properties: {
          name: { type: 'string' },
          modules: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'caixaria', 'frentes_portas', 'ferragens', 'fitas_borda_m'],
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                out_of_scope: { type: 'boolean' },
                dimensions: {
                  type: 'object',
                  properties: {
                    width_mm: { type: 'number' },
                    height_mm: { type: 'number' },
                    depth_mm: { type: 'number' },
                  },
                },
                bounding_box: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer' },
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                  },
                },
                caixaria: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['name', 'function', 'width_mm', 'height_mm', 'material_name', 'quantity'],
                    properties: {
                      name: { type: 'string' },
                      function: {
                        type: 'string',
                        enum: [
                          'base',
                          'lateral',
                          'divisoria',
                          'prateleira',
                          'fundo',
                          'sarrafo',
                          'tampo',
                          'outro',
                        ],
                      },
                      width_mm: { type: 'number' },
                      height_mm: { type: 'number' },
                      thickness_mm: { type: 'number' },
                      material_name: { type: 'string' },
                      quantity: { type: 'number' },
                      edge_banding: {
                        type: 'object',
                        properties: {
                          C1: { type: 'boolean' },
                          C2: { type: 'boolean' },
                          L1: { type: 'boolean' },
                          L2: { type: 'boolean' },
                          tape_name: { type: 'string' },
                          meters: { type: 'number' },
                        },
                      },
                      bounding_box: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          width: { type: 'number' },
                          height: { type: 'number' },
                        },
                      },
                    },
                  },
                },
                frentes_portas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['name', 'kind', 'width_mm', 'height_mm', 'material_name', 'quantity'],
                    properties: {
                      name: { type: 'string' },
                      kind: {
                        type: 'string',
                        enum: [
                          'porta_giro',
                          'porta_correr',
                          'frente_gaveta',
                          'frente_falsa',
                          'basculante',
                          'tamponamento',
                        ],
                      },
                      width_mm: { type: 'number' },
                      height_mm: { type: 'number' },
                      thickness_mm: { type: 'number' },
                      material_name: { type: 'string' },
                      quantity: { type: 'number' },
                      bounding_box: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          width: { type: 'number' },
                          height: { type: 'number' },
                        },
                      },
                    },
                  },
                },
                ferragens: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['raw_name', 'category', 'unit_measure', 'exact_quantity', 'full_units_quantity'],
                    properties: {
                      raw_name: { type: 'string' },
                      category: { type: 'string', enum: ['ferragem', 'puxador', 'consumivel'] },
                      unit_measure: { type: 'string', enum: ['un', 'barra', 'm', 'kg'] },
                      exact_quantity: { type: 'number' },
                      full_units_quantity: { type: 'integer' },
                      notes: { type: 'string' },
                      bounding_box: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          width: { type: 'number' },
                          height: { type: 'number' },
                        },
                      },
                    },
                  },
                },
                fitas_borda_m: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['tape_name', 'meters'],
                    properties: {
                      tape_name: { type: 'string' },
                      meters: { type: 'number' },
                      bounding_box: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          width: { type: 'number' },
                          height: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    auditor_notes: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
}

const INVENTORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['inventory'],
  properties: {
    inventory: {
      type: 'array',
      items: {
        type: 'object',
        required: ['environment', 'modules'],
        properties: {
          environment: { type: 'string' },
          modules: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

/** Fallback canônico (Engenharia Modular). Override ativo em ai_prompt_overrides prevalece. */
const SYSTEM_EXTRACTOR = ENGINEERING_MODULAR_EXTRACTOR
const SYSTEM_AUDITOR = ENGINEERING_MODULAR_AUDITOR

type PromptAgentKey = 'extractor' | 'auditor'

async function loadActivePromptOverrides(
  admin: ReturnType<typeof createClient>,
  companyId: string,
): Promise<{ extractor: string; auditor: string; sources: Record<PromptAgentKey, 'override' | 'canonical'> }> {
  const sources: Record<PromptAgentKey, 'override' | 'canonical'> = {
    extractor: 'canonical',
    auditor: 'canonical',
  }
  let extractor = SYSTEM_EXTRACTOR
  let auditor = SYSTEM_AUDITOR
  try {
    const { data, error } = await admin
      .from('ai_prompt_overrides')
      .select('agent_key, system_prompt, active')
      .eq('company_id', companyId)
      .eq('active', true)
      .in('agent_key', ['extractor', 'auditor'])
    if (error) {
      console.warn('[orcamentos-ia-pipeline] ai_prompt_overrides:', error.message)
      return { extractor, auditor, sources }
    }
    for (const row of data || []) {
      const key = row.agent_key as PromptAgentKey
      const text = typeof row.system_prompt === 'string' ? row.system_prompt.trim() : ''
      if (!text) continue
      if (key === 'extractor') {
        extractor = text
        sources.extractor = 'override'
      } else if (key === 'auditor') {
        auditor = text
        sources.auditor = 'override'
      }
    }
  } catch (err) {
    console.warn('[orcamentos-ia-pipeline] loadActivePromptOverrides failed:', err)
  }
  return { extractor, auditor, sources }
}

async function recordPromptTraces(
  admin: ReturnType<typeof createClient>,
  analysisId: string,
  traces: Array<{
    agent_key: PromptAgentKey
    source: 'override' | 'canonical'
    system_preview: string
    at: string
    model?: string
    schema_name?: string
    /** Preview da resposta JSON (sem imagens) — fecha auditoria de payloads. */
    response_preview?: string
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
    } | null
  }>,
) {
  if (!traces.length) return
  const { data } = await admin
    .from('quote_analyses')
    .select('totals')
    .eq('id', analysisId)
    .maybeSingle()
  const prev =
    data?.totals && typeof data.totals === 'object'
      ? (data.totals as Record<string, unknown>)
      : {}
  const prevTraces = Array.isArray(prev.prompt_traces) ? prev.prompt_traces : []
  await admin
    .from('quote_analyses')
    .update({
      totals: {
        ...prev,
        prompt_traces: [...prevTraces, ...traces].slice(-20),
        pipeline_updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', analysisId)
}

const SYSTEM_INVENTORY = `Você monta o ÍNDICE de ambientes e módulos de marcenaria do projeto. Só nomes, sem peças.

REGRAS:
1) Separe AMBIENTES reais pelo desenho e pelo CONTEÚDO/título da prancha (Espaço Gourmet, Cozinha, Lavabo, Lavanderia, Quarto…).
2) NÃO junte tudo num único ambiente só porque a capa tem um nome (ex.: capa "Espaço Gourmet" + prancha "BANCADA LAVABO" → dois ambientes).
3) ASSUNTO genérico ("Marmoraria Cozinha e Lavanderia") NÃO define o ambiente de cada prancha.
4) Liste SÓ móveis de marcenaria visíveis (bancada MDF, ilha, armário, torre, cristaleira, painel, ripado, mesa de jantar…).
5) NÃO invente guarda-roupa, cabeceira, criado-mudo ou quarto se não houver planta/detalhe desses ambientes.
6) Mesa de jantar / mesa orgânica ≠ bancada. Ilha/bancada com cooktop/pia ≠ mesa.
7) Pedra, eletro, cadeira/banqueta de loja, decoração → omita do inventário.
8) Lavanderia SÓ se houver desenho de lavanderia (tanque/máquina). A palavra "Lavanderia" no ASSUNTO da prancha NÃO basta.
9) Não duplique Cozinha e Espaço Gourmet para o mesmo open-space — use o nome da capa.
10) Inclua cristaleira, torre geladeira, painel TV, armários e ripados quando desenhados.
Responda só no JSON schema.`

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}


async function setStage(
  admin: ReturnType<typeof createClient>,
  analysisId: string,
  status: string,
  stage: string,
  detail?: string,
  kind?: string,
) {
  const { data } = await admin
    .from('quote_analyses')
    .select('totals')
    .eq('id', analysisId)
    .maybeSingle()
  const prev =
    data?.totals && typeof data.totals === 'object'
      ? (data.totals as Record<string, unknown>)
      : {}

  const THOUGHT_CAP = 40
  const rawLog = Array.isArray(prev.thought_log) ? prev.thought_log : []
  const prevLog = rawLog.filter(
    (x) => x && typeof x === 'object' && typeof (x as { message?: unknown }).message === 'string',
  ) as Array<{ at: string; stage: string; kind: string; message: string }>

  let thought_log = prevLog
  const message = (detail || '').trim()
  if (message) {
    const last = prevLog[prevLog.length - 1]
    if (!(last && last.message === message && last.stage === stage)) {
      const entryKind =
        kind ||
        (stage === 'auditing'
          ? 'audit'
          : stage === 'fetching_prices' || stage === 'persisting'
            ? 'price'
            : stage === 'completed'
              ? 'done'
              : stage === 'failed'
                ? 'warn'
                : 'vision')
      thought_log = [
        ...prevLog,
        {
          at: new Date().toISOString(),
          stage,
          kind: entryKind,
          message,
        },
      ].slice(-THOUGHT_CAP)
    }
  }

  await admin
    .from('quote_analyses')
    .update({
      status,
      totals: {
        ...prev,
        pipeline_stage: stage,
        pipeline_detail: detail ?? null,
        thought_log,
        pipeline_updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', analysisId)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ ok: false, error: 'Não autenticado.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openAiKey = Deno.env.get('OPENAI_API_KEY')?.trim() || null
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim() || null
    if (!openAiKey) {
      return jsonResponse(
        { ok: false, error: 'OPENAI_API_KEY não configurada na Edge Function.' },
        500,
      )
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    let isServiceRole = false
    try {
      const payloadPart = token.split('.')[1]
      if (payloadPart) {
        const json = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')))
        isServiceRole = json?.role === 'service_role'
      }
    } catch {
      isServiceRole = false
    }
    if (!isServiceRole && serviceKey && token === serviceKey.trim()) {
      isServiceRole = true
    }

    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userData, error: userError } = await userClient.auth.getUser()
      if (userError || !userData.user) {
        return jsonResponse({ ok: false, error: 'Sessão inválida.' }, 401)
      }
    }

    const body = (await req.json()) as PipelineBody
    if (!body?.analysisId || !body?.companyId || !body?.pagePaths?.length) {
      return jsonResponse({ ok: false, error: 'analysisId, companyId e pagePaths são obrigatórios.' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const mode = body.mode === 'pro' ? 'pro' : 'max'
    const models = resolveOrcamentosModels({
      mode,
      hasAnthropic: Boolean(anthropicKey),
    })
    const EXTRACTOR_MODEL = models.extractor
    const PARSER_MODEL = models.parser
    const AUDITOR_MODEL = models.auditor
    const phase: PipelinePhase = body.phase || 'full'
    const ragBlock = body.ragMemoriesPrompt?.trim()
      ? `\n\n${body.ragMemoriesPrompt.trim()}`
      : ''

    /** Max + Claude: sem fallback gpt-4o. Parser OpenAI não usa este ramo. */
    const callLlm = (params: {
      model: string
      system: string
      userContent: unknown[]
      schemaName: string
      schema: Record<string, unknown>
      maxTokens?: number
      effort?: 'low' | 'medium' | 'high' | 'max'
    }) => {
      const allowOpenAiFallback = !(mode === 'max' && isClaudeModel(params.model))
      const effort =
        params.effort ??
        (isClaudeModel(params.model)
          ? params.schemaName.includes('audit')
            ? 'medium'
            : 'low'
          : undefined)
      return llmJson({
        openAiKey,
        anthropicKey,
        model: params.model,
        system: params.system,
        userContent: params.userContent,
        schemaName: params.schemaName,
        schema: params.schema,
        maxTokens: params.maxTokens,
        allowOpenAiFallback,
        effort,
      })
    }

    const promptPack = await loadActivePromptOverrides(admin, body.companyId)
    const systemExtractor = promptPack.extractor
    const systemAuditor = promptPack.auditor
    console.log(
      `[orcamentos-ia-pipeline] mode=${mode} phase=${phase} extractor=${EXTRACTOR_MODEL} parser=${PARSER_MODEL} auditor=${AUDITOR_MODEL} anthropic=${Boolean(anthropicKey)} openai=${Boolean(openAiKey)} claudeFallbackBlocked=${mode === 'max'}`,
    )

    const paths = body.pagePaths.slice(0, MAX_PAGES)
    type VisionImage = { type: 'image_url'; image_url: { url: string }; path: string }
    const imageCache = new Map<string, VisionImage>()

    /**
     * Baixa a imagem do Storage e embute em data-URL (base64).
     * Evita o erro OpenAI/Anthropic "Unable to download content from the provided URL"
     * com signed URLs do Supabase (timeout / rede da provedora de IA).
     */
    const loadImageAsDataUrl = async (path: string): Promise<VisionImage> => {
      const hit = imageCache.get(path)
      if (hit) return hit
      const { data: blob, error: dlError } = await admin.storage.from('orcamentos-ia').download(path)
      if (dlError || !blob) {
        throw new Error(`Não foi possível baixar ${path}: ${dlError?.message || 'arquivo vazio'}`)
      }
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      const chunkSize = 0x8000
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
      }
      const b64 = btoa(binary)
      const lower = path.toLowerCase()
      const mime = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg'
      const item: VisionImage = {
        type: 'image_url',
        image_url: { url: `data:${mime};base64,${b64}` },
        path,
      }
      imageCache.set(path, item)
      return item
    }

    const loadImages = async (subset: string[]): Promise<VisionImage[]> => {
      const out: VisionImage[] = []
      for (const path of subset) out.push(await loadImageAsDataUrl(path))
      return out
    }

    /** Metadados leves (só path) — a imagem base64 é carregada sob demanda. */
    const signedContents: VisionImage[] = paths.map((path) => ({
      type: 'image_url',
      image_url: { url: '' },
      path,
    }))

    /** Nº da página no PDF (page-006.jpg → 6). Diferente do "PRANCHA Nº" impresso. */
    const pdfPageFromPath = (path: string): number | null => {
      const m = path.match(/page-(\d+)\.(?:png|jpe?g|webp)$/i)
      if (!m) return null
      const n = Number(m[1])
      return Number.isFinite(n) && n >= 1 ? n : null
    }

    /**
     * Alterna texto "PDF página N" + imagem — o modelo deve usar N no bounding_box.page,
     * não o carimbo "PRANCHA Nº" (capa desloca a numeração).
     * Carrega base64 sob demanda (só as páginas deste lote).
     */
    const labeledImagesForVision = async (
      contents: Array<{ type: 'image_url'; image_url: { url: string }; path: string }>,
    ): Promise<unknown[]> => {
      const out: unknown[] = []
      for (const c of contents) {
        const loaded = await loadImageAsDataUrl(c.path)
        const n = pdfPageFromPath(c.path)
        out.push({
          type: 'text',
          text: n
            ? `=== PDF página ${n} (arquivo page-${String(n).padStart(3, '0')}) ===\nUse bounding_box.page = ${n}. NÃO use o "PRANCHA Nº" impresso se for diferente (há capa/índice antes das pranchas).`
            : `=== Imagem: ${c.path} ===\nUse o número da página do arquivo no bounding_box.page.`,
        })
        out.push({ type: 'image_url', image_url: loaded.image_url })
      }
      return out
    }

    const imagesOnly = async (
      contents: Array<{ path: string }>,
    ): Promise<Array<{ type: 'image_url'; image_url: { url: string } }>> => {
      const loaded = await loadImages(contents.map((c) => c.path))
      return loaded.map((c) => ({ type: 'image_url' as const, image_url: c.image_url }))
    }

    const formatInventoryText = (inventory: InventoryEnv[]) =>
      inventory.length
        ? inventory.map((e) => `- ${e.environment}: ${(e.modules || []).join(', ')}`).join('\n')
        : '(inventário vazio — extraia o máximo possível das pranchas)'

    if (phase === 'inventory') {
      const inventoryPages = pickInventoryContents(signedContents)
      const coverImages = await imagesOnly(inventoryPages)
      await setStage(
        admin,
        body.analysisId,
        'READING_LAYOUT',
        'reading_inventory',
        `Lendo capa + pranchas-chave (${coverImages.length}/${signedContents.length}): separando ambientes e móveis…`,
        'vision',
      )
      const inventoryCall = await callLlm({
        model: PARSER_MODEL,
        system: SYSTEM_INVENTORY,
        userContent: [
          {
            type: 'text',
            text: `Estas são ${coverImages.length} páginas representativas (capa, plantas e detalhamentos) de um PDF com ${signedContents.length} páginas.
Liste ambientes SEPARADOS e só módulos de marcenaria realmente visíveis.
OBRIGATÓRIO: se houver prancha com título/CONTEÚDO "LAVABO" ou "BANCADA LAVABO", crie ambiente "Lavabo" separado (não misture com Gourmet/Cozinha).
Priorize CONTEÚDO da prancha, não o ASSUNTO genérico. Não invente móveis de quarto nem Lavanderia sem desenho de tanque/máquina.`,
          },
          ...coverImages,
        ],
        schemaName: 'quote_inventory',
        schema: INVENTORY_SCHEMA,
        maxTokens: 4000,
      })
      let inventory = sanitizeInventory(
        Array.isArray(inventoryCall.json.inventory) ? (inventoryCall.json.inventory as InventoryEnv[]) : [],
      )

      // 2ª passada só nas pranchas da 2ª metade (detalhamentos) — capa sozinha esconde Lavabo
      if (signedContents.length >= 8) {
        const detailSlice = signedContents.slice(Math.floor(signedContents.length / 2))
        const detailImages = await imagesOnly(pickInventoryContents(detailSlice, 6))
        try {
          const detailCall = await callLlm({
            model: PARSER_MODEL,
            system: SYSTEM_INVENTORY,
            userContent: [
              {
                type: 'text',
                text: `Inventário atual:
${formatInventoryText(inventory)}

Olhe estas pranchas de DETALHAMENTO. Se houver ambientes/módulos faltando (ex.: Lavabo, cristaleira, painel TV, armário), devolva o inventário COMPLETO atualizado.
Não apague ambientes já listados sem motivo. Não invente Lavanderia sem tanque/máquina.`,
              },
              ...detailImages,
            ],
            schemaName: 'quote_inventory',
            schema: INVENTORY_SCHEMA,
            maxTokens: 4000,
          })
          const detailInv = Array.isArray(detailCall.json.inventory)
            ? (detailCall.json.inventory as InventoryEnv[])
            : []
          // MESCLA com a 1ª passada — a 2ª sozinha às vezes esquece Lavabo/Gourmet
          if (detailInv.length > 0) {
            inventory = sanitizeInventory([...inventory, ...detailInv])
          }
        } catch (detailErr) {
          console.warn('[orcamentos-ia-pipeline] inventory detail pass failed:', detailErr)
        }
      }

      return jsonResponse({ ok: true, phase, inventory, pagesProcessed: signedContents.length })
    }

    if (phase === 'extract') {
      const inventory = sanitizeInventory(Array.isArray(body.inventory) ? body.inventory : [])
      const inventoryText = formatInventoryText(inventory)
      const healFeedback =
        typeof body.healFeedback === 'string' && body.healFeedback.trim()
          ? body.healFeedback.trim()
          : ''
      const pageHints = signedContents
        .map((c) => pdfPageFromPath(c.path))
        .filter((n): n is number => n != null)
      await setStage(
        admin,
        body.analysisId,
        'EXTRACTING_MODULES',
        healFeedback ? 'self_heal' : 'extracting_batch',
        healFeedback
          ? `Auto-correção: reexaminando lote (${signedContents.length} página(s))…`
          : `Caçando chapas MDF, puxadores e dobradiças neste lote (${signedContents.length} página(s))…`,
        'vision',
      )
      const extractorSystem = systemExtractor + ragBlock
      const batchCall = await callLlm({
        model: EXTRACTOR_MODEL,
        system: extractorSystem,
        userContent: [
          {
            type: 'text',
            text: `${healFeedback ? `${healFeedback}\n\n` : ''}Lote com ${signedContents.length} página(s) do PDF${
              pageHints.length ? ` (índices: ${pageHints.join(', ')})` : ''
            }.
INVENTÁRIO ESPERADO DO PROJETO (âncora; se conflitar com a imagem, prefira a imagem):
${inventoryText}

Extraia módulos/insumos VISÍVEIS neste lote.
Cada imagem vem precedida de "PDF página N" — bounding_box.page DEVE ser esse N (página do arquivo), NÃO o "PRANCHA Nº" do carimbo.
O inventário é âncora PARCIAL: se a prancha for "DETALHAMENTO BANCADA LAVABO", crie ambiente Lavabo mesmo que não esteja no inventário.
Use ambiente correto (Lavabo ≠ Cozinha ≠ Espaço Gourmet). Inclua cristaleira/painel/armário se desenhados.
Não invente guarda-roupa/cabeceira. Mesa de jantar ≠ bancada.`,
          },
          ...(await labeledImagesForVision(signedContents)),
        ],
        schemaName: 'quote_extraction_batch',
        schema: EXTRACTOR_SCHEMA,
        maxTokens: 12000,
      })
      await recordPromptTraces(admin, body.analysisId, [
        {
          agent_key: 'extractor',
          source: promptPack.sources.extractor,
          system_preview: batchCall.system_preview,
          model: batchCall.model,
          schema_name: batchCall.schema_name,
          response_preview: batchCall.response_preview,
          usage: batchCall.usage,
          at: new Date().toISOString(),
        },
      ])
      const extraction = rebalanceEnvironments(
        ensurePlaceholders(mergeExtractions([batchCall.json])),
      )
      return jsonResponse({
        ok: true,
        phase,
        inventory,
        extraction,
        pagesProcessed: signedContents.length,
        prompt_source: promptPack.sources,
      })
    }

    if (phase === 'audit') {
      const inventory = sanitizeInventory(Array.isArray(body.inventory) ? body.inventory : [])
      const inventoryText = formatInventoryText(inventory)
      const healFeedback =
        typeof body.healFeedback === 'string' && body.healFeedback.trim()
          ? body.healFeedback.trim()
          : ''
      let extraction = ensurePlaceholders(
        body.extraction && typeof body.extraction === 'object'
          ? body.extraction
          : { environments: [], auditor_notes: [], warnings: [] },
      )

      const auditPasses =
        mode === 'max' && isClaudeModel(AUDITOR_MODEL) ? MAX_AUDIT_PASSES_CLAUDE : MAX_AUDIT_PASSES
      let imageBudget =
        mode === 'max' && isClaudeModel(AUDITOR_MODEL)
          ? AUDIT_IMAGES_PER_PASS_CLAUDE
          : AUDIT_IMAGES_PER_PASS
      let passesRun = 0
      let lastScore = -1
      let lastAuditMeta: LlmJsonResult | null = null

      for (let pass = 1; pass <= auditPasses; pass++) {
        const gaps = findBomGaps(extraction)
        const coverageBefore = buildCoverage(inventory, extraction)
        const typology = findTypologySuspects(extraction)
        const score = hallucinationScore(gaps, coverageBefore, typology)
        lastScore = score

        // Sempre 1ª passagem (mesmo score 0) — valida tipologias/extras; depois só se score > 0
        if (pass > 1 && score === 0) break

        await setStage(
          admin,
          body.analysisId,
          'AUDITING_REVISION',
          'auditing',
          `Auditoria passagem ${pass}/${auditPasses}: score ${score} (BOM ${gaps.length}, faltando ${coverageBefore.missing.length}, extras ${coverageBefore.extras.length}, tipologia ${typology.length})…`,
          'audit',
        )

        const windowContents = pickAuditContents(signedContents, extraction, pass, imageBudget)

        try {
          const auditCall = await callLlm({
            model: AUDITOR_MODEL,
            system: systemAuditor,
            userContent: [
              {
                type: 'text',
                text: `${healFeedback ? `${healFeedback}\n\n` : ''}PASSAGEM ${pass}/${auditPasses} — verifique as imagens e devolva a árvore CORRIGIDA.
Cada imagem vem com "PDF página N" — corrija bounding_box.page para esse N (não o PRANCHA Nº impresso).

INVENTÁRIO (âncora; se inventário tiver erro, prefira as imagens):
${inventoryText}

FALHAS DE BOM:
${gaps.length ? gaps.map((g) => `- ${g.environment} → ${g.module}: ${g.reason}`).join('\n') : '(nenhuma)'}

MÓDULOS DO INVENTÁRIO FALTANDO NA EXTRAÇÃO:
${
  coverageBefore.missing.length
    ? coverageBefore.missing.map((m) => `- ${m.environment} → ${m.module}`).join('\n')
    : '(nenhum)'
}

MÓDULOS A MAIS (possível alucinação — remover se não houver evidência nas imagens):
${
  coverageBefore.extras.length
    ? coverageBefore.extras.map((m) => `- ${m.environment} → ${m.module}`).join('\n')
    : '(nenhum)'
}

TIPOLOGIAS SUSPEITAS (renomear se necessário):
${
  typology.length
    ? typology.map((t) => `- ${t.environment} → ${t.module}: ${t.reason}`).join('\n')
    : '(nenhuma)'
}

ÁRVORE ATUAL (pode remover/renomear módulos; complete BOM só do que existir):
${JSON.stringify(extraction).slice(0, 50000)}`,
              },
              ...(await labeledImagesForVision(windowContents)),
            ],
            schemaName: 'quote_extraction_audited',
            schema: EXTRACTOR_SCHEMA,
            maxTokens: 16000,
          })
          lastAuditMeta = auditCall
          extraction = ensurePlaceholders(
            applyAuditorTree(extraction, ensurePlaceholders(auditCall.json)),
          )
          passesRun = pass
        } catch (passErr) {
          const msg = passErr instanceof Error ? passErr.message : String(passErr)
          console.warn(`[orcamentos-ia-pipeline] audit pass ${pass} falhou:`, msg)
          imageBudget = Math.max(4, imageBudget - 2)
          const warnings = Array.isArray(extraction.warnings)
            ? [...(extraction.warnings as string[])]
            : []
          warnings.push(`Auditoria passagem ${pass} incompleta: ${msg.slice(0, 160)}`)
          extraction = { ...extraction, warnings: [...new Set(warnings)] }
          // tenta próxima passagem com menos imagens
        }
      }

      extraction = applyHeuristicPrune(extraction)
      const coverage = buildCoverage(inventory, extraction)
      const bomGaps = findBomGaps(extraction)
      if (bomGaps.length) {
        const warnings = Array.isArray(extraction.warnings)
          ? [...(extraction.warnings as string[])]
          : []
        for (const g of bomGaps) {
          warnings.push(`BOM incompleto: ${g.environment} → ${g.module} (${g.reason})`)
        }
        extraction = { ...extraction, warnings: [...new Set(warnings)] }
      }

      if (passesRun > 0) {
        await recordPromptTraces(admin, body.analysisId, [
          {
            agent_key: 'auditor',
            source: promptPack.sources.auditor,
            system_preview: lastAuditMeta?.system_preview ?? systemAuditor.slice(0, 240),
            model: lastAuditMeta?.model ?? AUDITOR_MODEL,
            schema_name: lastAuditMeta?.schema_name,
            response_preview: lastAuditMeta?.response_preview,
            usage: lastAuditMeta?.usage ?? null,
            at: new Date().toISOString(),
          },
        ])
      }

      const auditNeedsRerun = lastScore > 0 || coverage.missing.length > 0 || bomGaps.length > 0
      // Marca na análise se ainda precisa de outra passagem (UI "Reauditar")
      try {
        const { data: cur } = await admin
          .from('quote_analyses')
          .select('totals')
          .eq('id', body.analysisId)
          .maybeSingle()
        const prev =
          cur?.totals && typeof cur.totals === 'object'
            ? (cur.totals as Record<string, unknown>)
            : {}
        await admin
          .from('quote_analyses')
          .update({
            totals: {
              ...prev,
              audit_needs_rerun: auditNeedsRerun,
              hallucination_score: lastScore,
              coverage,
              inventory,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.analysisId)
      } catch (e) {
        console.warn('[orcamentos-ia-pipeline] audit_needs_rerun persist:', e)
      }

      return jsonResponse({
        ok: true,
        phase,
        inventory,
        extraction,
        coverage,
        bomGaps,
        mode,
        auditPasses: passesRun,
        hallucinationScore: lastScore,
        auditNeedsRerun,
        pagesProcessed: signedContents.length,
        prompt_source: promptPack.sources,
      })
    }

    // full legado — inventário + lotes + 1 auditoria leve
    const inventoryPages = pickInventoryContents(signedContents)
    const coverImages = await imagesOnly(inventoryPages)

    await setStage(
      admin,
      body.analysisId,
      'READING_LAYOUT',
      'reading_inventory',
      `Lendo capa + pranchas-chave (${coverImages.length}/${signedContents.length}): separando ambientes…`,
      'vision',
    )

    const inventoryCall = await callLlm({
      model: PARSER_MODEL,
      system: SYSTEM_INVENTORY,
      userContent: [
        {
          type: 'text',
          text: `Estas são ${coverImages.length} páginas representativas de um PDF com ${signedContents.length} páginas.
Liste ambientes SEPARADOS e só módulos reais. Priorize CONTEÚDO/título da prancha. Não invente móveis de quarto.`,
        },
        ...coverImages,
      ],
      schemaName: 'quote_inventory',
      schema: INVENTORY_SCHEMA,
      maxTokens: 4000,
    })

    const inventory = sanitizeInventory(
      Array.isArray(inventoryCall.json.inventory) ? (inventoryCall.json.inventory as InventoryEnv[]) : [],
    )
    const inventoryText = formatInventoryText(inventory)

    const batches = chunk(signedContents, BATCH_SIZE)
    const batchResults: unknown[] = []
    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi]
      const pageNums = batch.map((c) => pdfPageFromPath(c.path)).filter((n): n is number => n != null)
      const pageFrom = pageNums[0] ?? bi * BATCH_SIZE + 1
      const pageTo = pageNums[pageNums.length - 1] ?? bi * BATCH_SIZE + batch.length
      await setStage(
        admin,
        body.analysisId,
        'EXTRACTING_MODULES',
        'extracting_batch',
        `Lote ${bi + 1}/${batches.length}: caçando chapas MDF, puxadores e dobradiças nas páginas ${pageFrom}–${pageTo}…`,
        'vision',
      )
      const batchCall = await callLlm({
        model: EXTRACTOR_MODEL,
        system: systemExtractor + ragBlock,
        userContent: [
          {
            type: 'text',
            text: `Lote ${bi + 1}/${batches.length} (PDF páginas ${pageFrom}–${pageTo} de ${signedContents.length}).
INVENTÁRIO ESPERADO DO PROJETO:
${inventoryText}

Extraia módulos/insumos VISÍVEIS neste lote. bounding_box.page = "PDF página N" de cada imagem (não o PRANCHA Nº). Ambiente correto (Lavabo ≠ Cozinha). Não invente guarda-roupa/cabeceira. Mesa ≠ bancada.`,
          },
          ...(await labeledImagesForVision(batch)),
        ],
        schemaName: 'quote_extraction_batch',
        schema: EXTRACTOR_SCHEMA,
        maxTokens: 12000,
      })
      batchResults.push(batchCall.json)
    }

    await recordPromptTraces(admin, body.analysisId, [
      {
        agent_key: 'extractor',
        source: promptPack.sources.extractor,
        system_preview: (systemExtractor + ragBlock).slice(0, 240),
        model: EXTRACTOR_MODEL,
        response_preview:
          typeof batchResults[batchResults.length - 1] === 'object'
            ? JSON.stringify(batchResults[batchResults.length - 1]).slice(0, 4000)
            : '',
        at: new Date().toISOString(),
      },
    ])

    let extraction = rebalanceEnvironments(ensurePlaceholders(mergeExtractions(batchResults)))
    if (mode === 'max') {
      const auditPasses = isClaudeModel(AUDITOR_MODEL) ? MAX_AUDIT_PASSES_CLAUDE : MAX_AUDIT_PASSES
      let imageBudget = isClaudeModel(AUDITOR_MODEL)
        ? AUDIT_IMAGES_PER_PASS_CLAUDE
        : AUDIT_IMAGES_PER_PASS
      let lastAuditMeta: LlmJsonResult | null = null
      for (let pass = 1; pass <= auditPasses; pass++) {
        const gaps = findBomGaps(extraction)
        const coverageBefore = buildCoverage(inventory, extraction)
        const typology = findTypologySuspects(extraction)
        const score = hallucinationScore(gaps, coverageBefore, typology)
        if (pass > 1 && score === 0) break
        await setStage(
          admin,
          body.analysisId,
          'AUDITING_REVISION',
          'auditing',
          `Auditoria passagem ${pass}/${auditPasses}: score ${score}…`,
          'audit',
        )
        const auditWindow = pickAuditContents(signedContents, extraction, pass, imageBudget)
        try {
          const auditCall = await callLlm({
            model: AUDITOR_MODEL,
            system: systemAuditor,
            userContent: [
              {
                type: 'text',
                text: `PASSAGEM ${pass}/${auditPasses}. Verifique imagens; remova alucinações; renomeie tipologias; complete BOM só do que existir.
bounding_box.page = N do rótulo "PDF página N" (não o PRANCHA Nº impresso).

INVENTÁRIO:
${inventoryText}

BOM gaps: ${gaps.length}; faltando: ${coverageBefore.missing.length}; extras: ${coverageBefore.extras.length}; tipologia: ${typology.length}

ÁRVORE:
${JSON.stringify(extraction).slice(0, 50000)}`,
              },
              ...(await labeledImagesForVision(auditWindow)),
            ],
            schemaName: 'quote_extraction_audited',
            schema: EXTRACTOR_SCHEMA,
            maxTokens: 12000,
          })
          lastAuditMeta = auditCall
          extraction = ensurePlaceholders(
            applyAuditorTree(extraction, ensurePlaceholders(auditCall.json)),
          )
        } catch (passErr) {
          console.warn('[orcamentos-ia-pipeline] full audit pass failed:', passErr)
          imageBudget = Math.max(4, imageBudget - 2)
        }
      }
      extraction = applyHeuristicPrune(extraction)
      await recordPromptTraces(admin, body.analysisId, [
        {
          agent_key: 'auditor',
          source: promptPack.sources.auditor,
          system_preview: lastAuditMeta?.system_preview ?? systemAuditor.slice(0, 240),
          model: lastAuditMeta?.model ?? AUDITOR_MODEL,
          schema_name: lastAuditMeta?.schema_name,
          response_preview: lastAuditMeta?.response_preview,
          usage: lastAuditMeta?.usage ?? null,
          at: new Date().toISOString(),
        },
      ])
    }

    const coverage = buildCoverage(inventory, extraction)
    const bomGaps = findBomGaps(extraction)
    if (bomGaps.length) {
      const warnings = Array.isArray(extraction.warnings)
        ? [...(extraction.warnings as string[])]
        : []
      for (const g of bomGaps) {
        warnings.push(`BOM incompleto: ${g.environment} → ${g.module} (${g.reason})`)
      }
      extraction = { ...extraction, warnings: [...new Set(warnings)] }
    }

    await setStage(
      admin,
      body.analysisId,
      'FETCHING_MARKET_PRICES',
      'fetching_prices',
      'Extração pronta. Agora cruzo cada item com estoque e preços de mercado…',
      'price',
    )
    await admin
      .from('quote_analyses')
      .update({
        status: 'FETCHING_MARKET_PRICES',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.analysisId)

    return jsonResponse({
      ok: true,
      phase: 'full',
      extraction,
      inventory,
      coverage,
      bomGaps,
      mode,
      pagesProcessed: signedContents.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido no pipeline'
    console.error('[orcamentos-ia-pipeline]', message)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})

