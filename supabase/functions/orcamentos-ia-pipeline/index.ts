import { createClient } from 'npm:@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'
import {
  ENGINEERING_MODULAR_AUDITOR,
  ENGINEERING_MODULAR_EXTRACTOR,
  scopedAuditorPromptAddendum,
} from '../_shared/engineering-modular-prompts.ts'
import {
  isClaudeModel,
  llmJson,
  resolveOrcamentosModels,
  type LlmJsonResult,
} from '../_shared/llm-json.ts'
import { rebalanceEnvironments as rebalanceEnvironmentsShared } from '../_shared/rebalance-environments.ts'

const BATCH_SIZE = 8
/** Anti-504 async: até 300 páginas (1 LLM / request). */
const MAX_PAGES = 300
/**
 * Barreira de checkpoint a cada N páginas (ainda 1 página/LLM).
 * Não precifica — só grava partial e mensagem de lote.
 */
const CHECKPOINT_EVERY_PAGES = 15

type AnyRec = Record<string, unknown>

type PipelinePhase =
  | 'full'
  | 'inventory'
  | 'extract'
  | 'audit'
  | 'heal_module'
  | 'start_async'
  | 'chain_tick'
  | 'extract_page'
  | 'audit_environment'

type ChainStep = 'inventory' | 'extract' | 'audit' | 'done'

interface InventoryEnv {
  environment: string
  modules: string[]
}

interface CoverageItemLite {
  environment: string
  module: string
}

interface PipelineBody {
  analysisId: string
  companyId: string
  mode?: 'max' | 'pro'
  /** Chave UI: claude-sonnet | claude-opus | gpt-4o */
  extraction_model?: string
  pagePaths?: string[]
  ragMemoriesPrompt?: string
  /**
   * Fases curtas evitam 504 do gateway (~150s).
   * - inventory / extract / heal_module / audit / full: legado síncrono
   * - start_async: responde <2s e dispara cadeia (waitUntil)
   * - chain_tick / extract_page / audit_environment: 1 unidade de trabalho por request
   */
  phase?: PipelinePhase
  inventory?: InventoryEnv[]
  extraction?: AnyRec
  currentExtraction?: AnyRec
  missingModules?: CoverageItemLite[]
  healFeedback?: string
  forcedInjectLock?: boolean
  /** Cadeia async: passo atual. */
  chainStep?: ChainStep
  /** Índice 0-based da página a extrair. */
  pageIndex?: number
  /** Índice 0-based do ambiente a auditar. */
  envIndex?: number
  /** Retomar sem zerar partial_extraction. */
  resumeFromPage?: number
}

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void }

const CHAIN_SECRET_HEADER = 'x-pipeline-chain-secret'

const FORCED_INJECT_NOTE = 'injeção forçada self-heal: cobertura inventário'

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

/** Espelho client schemas.ts — evita typology "divisoria" no partial_extraction. */
const MODULE_TYPOLOGIES = new Set([
  'balcao',
  'aereo',
  'armario_correr',
  'armario_giro',
  'nicho',
  'painel',
  'gaveteiro',
  'outro',
])

function normalizeModuleTypology(raw: unknown): string | undefined {
  if (raw == null || raw === '') return undefined
  const key = String(raw)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  if (!key) return undefined
  if (MODULE_TYPOLOGIES.has(key)) return key
  if (/divisoria|estante|coluna|prateleira/.test(key)) return 'nicho'
  if (/armario_correr|correr|sliding/.test(key)) return 'armario_correr'
  if (/guarda_?roup|roupeiro|closet|cristaleira|armario|torre|paneleiro/.test(key)) {
    return 'armario_giro'
  }
  if (/rack|painel|ripado|cabeceira|brise|tv/.test(key)) return 'painel'
  if (/bancada|ilha|balcao/.test(key)) return 'balcao'
  if (/aereo/.test(key)) return 'aereo'
  if (/gaveteiro|criado|mesa_?cabeceira|mesa_de_cabeceira/.test(key)) return 'gaveteiro'
  return 'outro'
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
        const pkey = `${label.toLowerCase()}|${th}|${role}`
        if (!paletteByKey.has(pkey)) {
          paletteByKey.set(pkey, { label, thickness_mm: th, role })
        }
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
    project_sheet_palette: [...paletteByKey.values()],
  }
}

/** Pedra/civil/decoração solta — fora do escopo. LED/espelho ambíguos tratados após check de caixa. */
const OUT_OF_SCOPE_HINTS = [
  'tapete',
  'quadro',
  'puff',
  'pendente',
  'arandela',
  'luminaria',
  'westwing',
  'nordecor',
  'pendurador',
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
const AMBIGUOUS_DECOR_HINTS = ['led', 'espelho']

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

/** Tipologias que exigem caixa fatiada (paridade Cortecloud / Flaviane #23125828). */
const BOX_MODULE_RE =
  /ilha|balcao|bancada|armario|aereo|torre|cristaleira|gaveteiro|roupeiro|paneleiro|nicho|painel|mesa|prateleira|cozinhas|guarda.?roupa|cabeceira|criado|escrivaninha|home.?office|aparador|espelheira|porta/

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
  // Caixa interna sempre Branco TX — não herdar cor da frente
  const mat = 'MDF Branco TX 15mm'
  const thickness = 15
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
    tape_name: 'Fita 22 mm cor da frente',
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
      material_name: 'MDF Branco TX 6mm',
      quantity: 1,
      edge_banding: bandNone,
      dimensions_estimated: true,
    })
  }
  // Ilha/bancada aberta OU tipologias caixa fechada (HelloMob) — tampo quando faltar
  const needsTampo =
    openFront ||
    /armario|aereo|gaveteiro|roupeiro|guarda.?roupa|torre|cristaleira/.test(nameKey)
  if (!hasFn('tampo') && !hasFn('sarrafo') && !hasFn('travessa') && needsTampo) {
    push({
      name: 'Tampo',
      function: 'tampo',
      width_mm: w,
      height_mm: d,
      thickness_mm: thickness,
      material_name: mat,
      quantity: 1,
      edge_banding: openFront
        ? {
            C1: true,
            C2: true,
            L1: true,
            L2: true,
            tape_name: 'Fita 22 mm',
            meters: Math.round(((2 * (w + d)) / 1000) * 1000) / 1000,
          }
        : { ...bandFront, meters: Math.round((w / 1000) * 1000) / 1000 },
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

function moduleHasForcedInjectNote(mod: AnyRec): boolean {
  const notes = Array.isArray(mod.auditor_notes) ? mod.auditor_notes : []
  return notes.some(
    (n) => typeof n === 'string' && n.toLowerCase().includes('injeção forçada self-heal'),
  )
}

/** Garante que módulos injetados na árvore anterior não sumam após o auditor. */
function preserveForcedInjectModules(before: AnyRec, after: AnyRec): AnyRec {
  const afterEnvs = asObjArray(after.environments).map((env) => ({
    ...env,
    modules: [...asObjArray(env.modules)],
  }))
  for (const envBefore of asObjArray(before.environments)) {
    const envName = typeof envBefore.name === 'string' ? envBefore.name : 'Ambiente'
    const envKey = normalizeKey(envName)
    let envAfter = afterEnvs.find((e) => normalizeKey(String(e.name || '')) === envKey)
    if (!envAfter) {
      envAfter = { name: envName, modules: [] }
      afterEnvs.push(envAfter)
    }
    for (const modBefore of asObjArray(envBefore.modules)) {
      if (!moduleHasForcedInjectNote(modBefore)) continue
      const modName = typeof modBefore.name === 'string' ? modBefore.name : 'Modulo'
      const exists = asObjArray(envAfter.modules).some(
        (m) => normalizeKey(String(m.name || '')) === normalizeKey(modName),
      )
      if (!exists) {
        envAfter.modules = [...asObjArray(envAfter.modules), modBefore]
      }
    }
  }
  return { ...after, environments: afterEnvs }
}

function ensurePlaceholders(extraction: AnyRec): AnyRec {
  const environments = asObjArray(extraction.environments).map((env) => {
    const modules = asObjArray(env.modules).map((mod) => {
      const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const nameKey = normalizeKey(name)
      const typology = normalizeModuleTypology(mod.typology)
      const withTypology: AnyRec = typology
        ? { ...mod, typology }
        : mod.typology != null && mod.typology !== ''
          ? { ...mod, typology: 'outro' }
          : { ...mod }
      const isBox = BOX_MODULE_RE.test(nameKey)
      const hardOos = OUT_OF_SCOPE_HINTS.some((h) => nameKey.includes(normalizeKey(h)))
      const ambigDecor = AMBIGUOUS_DECOR_HINTS.some((h) => nameKey.includes(normalizeKey(h)))
      let caixaria = cleanCaixariaEdgeBanding(asObjArray(withTypology.caixaria))
      if (STORE_BRAND_HINTS.some((h) => nameKey.includes(h))) {
        return { ...withTypology, name, out_of_scope: true, caixaria: [], frentes_portas: [], ferragens: [], fitas_borda_m: [] }
      }
      const mdfPieces = caixaria.length + asObjArray(withTypology.frentes_portas).length
      // Tipologia de marcenaria: NUNCA out_of_scope (trava anti-descarte Flaviane)
      if (isBox) {
        return enrichMinimalCaixaria({ ...withTypology, name, caixaria, out_of_scope: undefined })
      }
      // Com chapa MDF (ex.: bancada sob granito) continua no escopo
      if (mdfPieces > 0) {
        return enrichMinimalCaixaria({ ...withTypology, caixaria, out_of_scope: undefined })
      }
      if (hardOos || (ambigDecor && !isBox) || withTypology.out_of_scope === true) {
        // Fora de escopo: listado à parte no cliente, sem insumos nem custo
        return { ...withTypology, name, out_of_scope: true, caixaria: [], frentes_portas: [], ferragens: [], fitas_borda_m: [] }
      }
      const total = asObjArray(withTypology.ferragens).length + asObjArray(withTypology.fitas_borda_m).length
      if (total > 0) return enrichMinimalCaixaria({ ...withTypology, caixaria, out_of_scope: undefined })
      // Marcenaria sem peças: NÃO inventar placeholder — deixa o auditor completar
      return { ...withTypology, caixaria: [], frentes_portas: [], ferragens: [], fitas_borda_m: [] }
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

/** Amplia inventário-âncora com módulos cobráveis já extraídos (evita cobertura falsa). */
function expandInventoryFromExtraction(
  inventory: InventoryEnv[],
  extraction: AnyRec | unknown,
): InventoryEnv[] {
  const fromExtraction: InventoryEnv[] = []
  const root =
    extraction && typeof extraction === 'object' ? (extraction as AnyRec) : null
  for (const env of asObjArray(root?.environments)) {
    const envName = typeof env.name === 'string' ? env.name.trim() : ''
    if (!envName) continue
    const modules: string[] = []
    for (const mod of asObjArray(env.modules)) {
      if (mod.out_of_scope === true) continue
      const modName = typeof mod.name === 'string' ? mod.name.trim() : ''
      if (modName) modules.push(modName)
    }
    if (modules.length) {
      fromExtraction.push({ environment: envName, modules: [...new Set(modules)] })
    }
  }
  return sanitizeInventory([...(inventory || []), ...fromExtraction])
}

/**
 * Quando a página é só render/ilustração, o modelo devolve environments [].
 * Injeta móveis do inventário com cotas estimadas para o lote não falhar no client.
 */
function injectInventoryAsEstimatedModules(
  extraction: AnyRec,
  inventory: InventoryEnv[],
  pageHint?: number | null,
): AnyRec {
  const environments: AnyRec[] = []
  for (const inv of inventory) {
    const envName = typeof inv.environment === 'string' ? inv.environment.trim() : ''
    if (!envName) continue
    const modules: AnyRec[] = []
    for (const modNameRaw of inv.modules || []) {
      const modName = typeof modNameRaw === 'string' ? modNameRaw.trim() : ''
      if (!modName) continue
      const stub = enrichMinimalCaixaria({
        name: modName,
        description: `Estimado a partir do inventário (página sem cotas técnicas).`,
        dimensions: { width_mm: 800, height_mm: 720, depth_mm: 560 },
        dimensions_estimated: true,
        caixaria: [],
        frentes_portas: [],
        ferragens: [],
        fitas_borda_m: [],
        auditor_notes: [
          'Injetado: extrator devolveu environments vazio em página ilustrativa/render.',
        ],
        bounding_box:
          typeof pageHint === 'number' && pageHint >= 1
            ? { page: pageHint, x: 0.05, y: 0.05, width: 0.9, height: 0.9 }
            : null,
      })
      modules.push(stub)
    }
    if (modules.length) environments.push({ name: envName, modules })
  }
  if (!environments.length) return extraction
  const warnings = Array.isArray(extraction.warnings)
    ? [...(extraction.warnings as unknown[])]
    : []
  warnings.push(
    'Módulos injetados do inventário com cotas estimadas (página sem desenho executivo). Confira na auditoria.',
  )
  const notes = Array.isArray(extraction.auditor_notes)
    ? [...(extraction.auditor_notes as unknown[])]
    : []
  notes.push('Injeção de inventário após environments vazio (anti-FAILED Too small).')
  return {
    ...extraction,
    environments,
    warnings: [...new Set(warnings.map(String))],
    auditor_notes: [...new Set(notes.map(String))],
  }
}

/** Preferir árvore mais rica na auditoria incremental (não apagar módulos com BOM). */
function mergeEnvPreferRicher(prevEnv: AnyRec, nextEnv: AnyRec): AnyRec {
  const prevMods = asObjArray(prevEnv.modules)
  const nextMods = asObjArray(nextEnv.modules)
  if (!prevMods.length) return { ...prevEnv, ...nextEnv, modules: nextMods }
  if (!nextMods.length) return prevEnv

  const pieceScore = (mod: AnyRec) => {
    const cx = asObjArray(mod.caixaria).length
    const fr = asObjArray(mod.frentes_portas).length
    const gv = asObjArray(mod.gavetas).length
    return cx + fr + gv + (mod.out_of_scope === true ? 0 : 1)
  }

  const byKey = new Map<string, AnyRec>()
  for (const mod of prevMods) {
    const name = typeof mod.name === 'string' ? normalizeKey(mod.name) : ''
    if (name) byKey.set(name, mod)
  }
  for (const mod of nextMods) {
    const name = typeof mod.name === 'string' ? normalizeKey(mod.name) : ''
    if (!name) continue
    const prev = byKey.get(name)
    if (!prev || pieceScore(mod) >= pieceScore(prev)) byKey.set(name, mod)
  }
  // Mantém módulos do prev que o auditor omitiu (só se tiverem peças ou não forem OOS)
  for (const mod of prevMods) {
    const name = typeof mod.name === 'string' ? normalizeKey(mod.name) : ''
    if (!name || byKey.has(name)) continue
    if (mod.out_of_scope === true && pieceScore(mod) === 0) continue
    byKey.set(name, mod)
  }

  return {
    ...prevEnv,
    ...nextEnv,
    name: typeof nextEnv.name === 'string' && nextEnv.name.trim() ? nextEnv.name : prevEnv.name,
    modules: [...byKey.values()],
  }
}

/** Lock dormitório + Lavabo/Gourmet — ver `_shared/rebalance-environments.ts`. */
function rebalanceEnvironments(extraction: AnyRec, inventory?: InventoryEnv[]): AnyRec {
  return rebalanceEnvironmentsShared(extraction, inventory) as AnyRec
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
    project_sheet_palette: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'thickness_mm', 'role'],
        properties: {
          label: { type: 'string' },
          thickness_mm: { type: 'number', enum: [6, 15, 18] },
          role: { type: 'string', enum: ['box_white', 'back_white', 'front_color'] },
        },
      },
    },
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
        (stage === 'auditing' || stage === 'self_heal'
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
    const phase: PipelinePhase = body.phase || 'full'
    const isAsyncPhase =
      phase === 'start_async' ||
      phase === 'chain_tick' ||
      phase === 'extract_page' ||
      phase === 'audit_environment'

    if (!body?.analysisId || !body?.companyId) {
      return jsonResponse({ ok: false, error: 'analysisId e companyId são obrigatórios.' }, 400)
    }
    if (!isAsyncPhase && !body?.pagePaths?.length) {
      return jsonResponse({ ok: false, error: 'analysisId, companyId e pagePaths são obrigatórios.' }, 400)
    }
    if (phase === 'start_async' && !body?.pagePaths?.length) {
      return jsonResponse({ ok: false, error: 'start_async exige pagePaths.' }, 400)
    }

    const chainSecretExpected =
      Deno.env.get('ORCAMENTOS_IA_CHAIN_SECRET')?.trim() || serviceKey.trim()
    const chainSecretGot = req.headers.get(CHAIN_SECRET_HEADER)?.trim() || ''
    const isChainCall = Boolean(chainSecretGot && chainSecretGot === chainSecretExpected)
    if (
      (phase === 'chain_tick' || phase === 'extract_page' || phase === 'audit_environment') &&
      !isChainCall &&
      !isServiceRole
    ) {
      return jsonResponse({ ok: false, error: 'Cadeia async requer secret ou service_role.' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const mode = body.mode === 'pro' ? 'pro' : 'max'
    let extractionModelKey =
      typeof body.extraction_model === 'string' ? body.extraction_model.trim() : ''
    if (!extractionModelKey) {
      const { data: analysisRow } = await admin
        .from('quote_analyses')
        .select('extraction_model')
        .eq('id', body.analysisId)
        .maybeSingle()
      if (typeof analysisRow?.extraction_model === 'string') {
        extractionModelKey = analysisRow.extraction_model.trim()
      }
    }
    const models = resolveOrcamentosModels({
      mode,
      hasAnthropic: Boolean(anthropicKey),
      extractionModel: extractionModelKey || 'claude-sonnet',
    })
    const EXTRACTOR_MODEL = models.extractor
    const PARSER_MODEL = models.parser
    const AUDITOR_MODEL = models.auditor
    const extractionKey = models.extractionKey
    const ragBlock = body.ragMemoriesPrompt?.trim()
      ? `\n\n${body.ragMemoriesPrompt.trim()}`
      : ''

    const readTotals = async (): Promise<Record<string, unknown>> => {
      const { data } = await admin
        .from('quote_analyses')
        .select('totals')
        .eq('id', body.analysisId)
        .maybeSingle()
      return data?.totals && typeof data.totals === 'object'
        ? (data.totals as Record<string, unknown>)
        : {}
    }

    const patchTotals = async (patch: Record<string, unknown>, status?: string) => {
      const prev = await readTotals()
      // Usuário pediu interrupção: não deixar ticks antigos “ressuscitar” a cadeia.
      if (prev.async_chain_status === 'cancelled') {
        return prev
      }
      const next = { ...prev, ...patch, pipeline_updated_at: new Date().toISOString() }
      const upd: Record<string, unknown> = {
        totals: next,
        updated_at: new Date().toISOString(),
      }
      if (status) upd.status = status
      await admin.from('quote_analyses').update(upd).eq('id', body.analysisId)
      return next
    }

    const isCancelled = async (): Promise<boolean> => {
      const { data } = await admin
        .from('quote_analyses')
        .select('status, error_message, totals')
        .eq('id', body.analysisId)
        .maybeSingle()
      const tot =
        data?.totals && typeof data.totals === 'object'
          ? (data.totals as Record<string, unknown>)
          : {}
      if (tot.async_chain_status === 'cancelled') return true
      const err = String(data?.error_message || '')
      return /interrompid/i.test(err)
    }

    const countModules = (extraction: AnyRec): number => {
      let n = 0
      for (const env of asObjArray(extraction.environments)) {
        n += asObjArray(env.modules).length
      }
      return n
    }

    const enqueueChain = (payload: Record<string, unknown>) => {
      const selfUrl = `${supabaseUrl}/functions/v1/orcamentos-ia-pipeline`
      const tickBody = JSON.stringify({
        analysisId: body.analysisId,
        companyId: body.companyId,
        mode,
        extraction_model: extractionKey,
        ragMemoriesPrompt: body.ragMemoriesPrompt,
        ...payload,
      })
      const maxAttempts = 3
      const run = (async () => {
        let lastStatus = 0
        let lastText = ''
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            const res = await fetch(selfUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                [CHAIN_SECRET_HEADER]: chainSecretExpected,
              },
              body: tickBody,
            })
            if (res.ok) return
            lastStatus = res.status
            lastText = await res.text().catch(() => '')
            console.error('[chain] next tick failed', res.status, lastText.slice(0, 400), `attempt=${attempt}`)
            // 5xx / 546 (worker limit): retry — PDF grande costuma oscilar.
            if (res.status < 500 || attempt >= maxAttempts) break
            await new Promise((r) => setTimeout(r, 1500 * attempt))
          } catch (err) {
            console.error('[chain] enqueue error', err, `attempt=${attempt}`)
            lastStatus = 0
            lastText = err instanceof Error ? err.message : String(err)
            if (attempt >= maxAttempts) break
            await new Promise((r) => setTimeout(r, 1500 * attempt))
          }
        }
        await patchTotals(
          {
            pipeline_stage: 'failed',
            pipeline_detail: lastStatus
              ? `Cadeia interrompida (HTTP ${lastStatus}). Clique em Retomar.`
              : 'Cadeia interrompida (rede). Clique em Retomar.',
            async_chain_status: 'failed',
          },
          'FAILED',
        )
      })()
      try {
        EdgeRuntime.waitUntil(run)
      } catch {
        // Ambientes sem waitUntil: dispara sem aguardar (best-effort)
        void run
      }
    }

    /** Claude escolhido pelo usuário: sem fallback gpt-4o. Parser OpenAI não usa este ramo. */
    const callLlm = (params: {
      model: string
      system: string
      userContent: unknown[]
      schemaName: string
      schema: Record<string, unknown>
      maxTokens?: number
      effort?: 'low' | 'medium' | 'high' | 'max'
    }) => {
      const allowOpenAiFallback = !isClaudeModel(params.model)
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
    let systemAuditor = promptPack.auditor
    console.log(
      `[orcamentos-ia-pipeline] mode=${mode} extraction=${extractionKey} phase=${phase} extractor=${EXTRACTOR_MODEL} parser=${PARSER_MODEL} auditor=${AUDITOR_MODEL} anthropic=${Boolean(anthropicKey)} openai=${Boolean(openAiKey)} claudeFallbackBlocked=${isClaudeModel(EXTRACTOR_MODEL)}`,
    )

    let paths = (Array.isArray(body.pagePaths) ? body.pagePaths : []).slice(0, MAX_PAGES)
    if (isAsyncPhase && paths.length === 0) {
      const tot = await readTotals()
      const stored = Array.isArray(tot.page_paths)
        ? (tot.page_paths as unknown[]).filter((p): p is string => typeof p === 'string')
        : []
      paths = stored.slice(0, MAX_PAGES)
    }

    // Escopo estrito: se o lote tem page_ranges/selected_pages, só esses paths vão à LLM.
    const totForRanges = await readTotals()
    const rawRanges = totForRanges.page_ranges ?? totForRanges.selected_pages
    const selectedPagesForAudit = Array.isArray(rawRanges)
      ? [
          ...new Set(
            rawRanges.filter(
              (p): p is number => typeof p === 'number' && Number.isInteger(p) && p > 0,
            ),
          ),
        ].sort((a, b) => a - b)
      : []
    if (selectedPagesForAudit.length) {
      const wanted = new Set(selectedPagesForAudit)
      const pageNum = (path: string): number | null => {
        const m = path.match(/page-(\d+)\.(?:png|jpe?g|webp)$/i)
        if (!m) return null
        const n = Number(m[1])
        return Number.isFinite(n) && n >= 1 ? n : null
      }
      const filtered = paths.filter((p) => {
        const n = pageNum(p)
        return n != null && wanted.has(n)
      })
      if (!filtered.length) {
        return jsonResponse(
          {
            ok: false,
            error: `page_paths vazios após filtro page_ranges (${selectedPagesForAudit.join(', ')}). Abortado (fail-closed).`,
          },
          400,
        )
      }
      paths = filtered.slice(0, MAX_PAGES)
    }
    systemAuditor += scopedAuditorPromptAddendum(
      selectedPagesForAudit,
      typeof totForRanges.pages_total === 'number'
        ? Number(totForRanges.pages_total)
        : paths.length,
    )
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

    // ═══ ASYNC ANTI-504: start_async → chain_tick (1 LLM / request) ═══
    if (phase === 'start_async') {
      const resumeFrom =
        typeof body.resumeFromPage === 'number' && body.resumeFromPage >= 0
          ? Math.floor(body.resumeFromPage)
          : 0
      const prev = await readTotals()
      // Idempotente: se a cadeia já terminou OU ainda corre, não reinicia em paralelo.
      if (
        resumeFrom <= 0 &&
        (prev.async_chain_status === 'ready_for_pricing' ||
          prev.async_chain_status === 'running') &&
        prev.partial_extraction &&
        typeof prev.partial_extraction === 'object' &&
        (countModules(prev.partial_extraction as AnyRec) > 0 ||
          prev.async_chain_status === 'running')
      ) {
        return jsonResponse({
          ok: true,
          phase,
          status: prev.async_chain_status === 'ready_for_pricing' ? 'READY' : 'EXTRACTING',
          analysisId: body.analysisId,
          async_chain_status: prev.async_chain_status,
          skipped_restart: true,
        })
      }
      const keepPartial =
        resumeFrom > 0 && prev.partial_extraction && typeof prev.partial_extraction === 'object'
      const partial = keepPartial
        ? (prev.partial_extraction as AnyRec)
        : { environments: [], auditor_notes: [], warnings: [] }
      const inventoryKeep =
        resumeFrom > 0 && Array.isArray(prev.inventory)
          ? (prev.inventory as InventoryEnv[])
          : []
      const auditedKeep =
        resumeFrom > 0 && Array.isArray(prev.audited_environments)
          ? (prev.audited_environments as string[])
          : []

      await patchTotals(
        {
          page_paths: paths,
          total_pages: paths.length,
          current_page: resumeFrom,
          modules_found_count: countModules(partial),
          partial_extraction: partial,
          inventory: inventoryKeep,
          audited_environments: auditedKeep,
          async_chain_status: 'running',
          pipeline_stage: resumeFrom > 0 ? 'extracting_batch' : 'reading_inventory',
          pipeline_detail:
            resumeFrom > 0
              ? `Retomando na página ${resumeFrom + 1} de ${paths.length}…`
              : `Iniciando leitura assíncrona de ${paths.length} página(s)…`,
          rag_memories_prompt: body.ragMemoriesPrompt || prev.rag_memories_prompt || null,
        },
        resumeFrom > 0 ? 'EXTRACTING_MODULES' : 'READING_LAYOUT',
      )

      const nextStep: ChainStep = resumeFrom > 0 && inventoryKeep.length > 0 ? 'extract' : 'inventory'
      enqueueChain({
        phase: 'chain_tick',
        chainStep: nextStep,
        pageIndex: resumeFrom,
        envIndex: 0,
        pagePaths: paths,
      })

      return jsonResponse({
        ok: true,
        phase,
        status: 'EXTRACTING',
        analysisId: body.analysisId,
        total_pages: paths.length,
        resumeFromPage: resumeFrom,
      })
    }

    if (phase === 'chain_tick' || phase === 'extract_page' || phase === 'audit_environment') {
      if (!paths.length) {
        return jsonResponse({ ok: false, error: 'page_paths ausentes no checkpoint.' }, 400)
      }

      const totals = await readTotals()
      if (
        totals.async_chain_status === 'cancelled' ||
        (await isCancelled())
      ) {
        return jsonResponse({
          ok: true,
          phase: 'chain_tick',
          cancelled: true,
          async_chain_status: 'cancelled',
        })
      }
      const ragFromTotals =
        typeof totals.rag_memories_prompt === 'string' ? totals.rag_memories_prompt.trim() : ''
      const ragEffective = ragBlock || (ragFromTotals ? `\n\n${ragFromTotals}` : '')
      let chainStep: ChainStep =
        body.chainStep ||
        (phase === 'extract_page' ? 'extract' : phase === 'audit_environment' ? 'audit' : 'inventory')
      let pageIndex =
        typeof body.pageIndex === 'number' && body.pageIndex >= 0
          ? Math.floor(body.pageIndex)
          : Number(totals.current_page) || 0
      let envIndex =
        typeof body.envIndex === 'number' && body.envIndex >= 0
          ? Math.floor(body.envIndex)
          : 0

      try {
        // —— INVENTORY (1x) ——
        if (chainStep === 'inventory') {
          const inventoryPages = pickInventoryContents(signedContents)
          const coverImages = await imagesOnly(inventoryPages)
          await setStage(
            admin,
            body.analysisId,
            'READING_LAYOUT',
            'reading_inventory',
            `Inventário async: capa + chave (${coverImages.length}/${paths.length})…`,
            'vision',
          )
          const inventoryCall = await callLlm({
            model: PARSER_MODEL,
            system: SYSTEM_INVENTORY,
            userContent: [
              {
                type: 'text',
                text: `Estas são ${coverImages.length} páginas representativas de um PDF com ${paths.length} páginas.
Liste ambientes SEPARADOS e só módulos de marcenaria realmente visíveis.
Em PDF grande (≥20 págs.), espere vários ambientes (cozinha/gourmet, lavabo, lavanderia, home office, área de serviço, quarto…) — não resuma em 2–3 itens.`,
              },
              ...coverImages,
            ],
            schemaName: 'quote_inventory',
            schema: INVENTORY_SCHEMA,
            maxTokens: 4000,
          })
          let inventory = sanitizeInventory(
            Array.isArray(inventoryCall.json.inventory)
              ? (inventoryCall.json.inventory as InventoryEnv[])
              : [],
          )
          // 2ª passada (detalhamentos) — mesma lógica do phase inventory síncrono
          if (paths.length >= 8) {
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

Olhe estas pranchas de DETALHAMENTO. Se houver ambientes/módulos faltando (ex.: Lavabo, home office, área de serviço, porta, armário, mesa), devolva o inventário COMPLETO atualizado.
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
              if (detailInv.length > 0) {
                inventory = sanitizeInventory([...inventory, ...detailInv])
              }
            } catch (detailErr) {
              console.warn('[chain] inventory detail pass failed:', detailErr)
            }
          }
          await patchTotals(
            {
              inventory,
              current_page: 0,
              pipeline_stage: 'extracting_batch',
              pipeline_detail: `Lendo página 1 de ${paths.length}… Módulos encontrados: 0`,
              async_chain_status: 'running',
            },
            'EXTRACTING_MODULES',
          )
          enqueueChain({
            phase: 'chain_tick',
            chainStep: 'extract',
            pageIndex: 0,
            pagePaths: paths,
          })
          return jsonResponse({ ok: true, phase: 'chain_tick', chainStep: 'inventory', inventory })
        }

        // —— EXTRACT 1 PAGE ——
        if (chainStep === 'extract') {
          if (pageIndex >= paths.length) {
            enqueueChain({
              phase: 'chain_tick',
              chainStep: 'audit',
              envIndex: 0,
              pagePaths: paths,
            })
            return jsonResponse({ ok: true, phase: 'chain_tick', chainStep: 'extract', skipped: true })
          }

          const inventory = sanitizeInventory(
            Array.isArray(totals.inventory) ? (totals.inventory as InventoryEnv[]) : [],
          )
          const inventoryText = formatInventoryText(inventory)
          const path = paths[pageIndex]
          const pageContents = signedContents.filter((c) => c.path === path)
          const pageNum = pageIndex + 1
          // Nº absoluto no PDF (page-004 → 4), não o índice 1..N do lote.
          const absPage = pdfPageFromPath(path) ?? pageNum
          const absPages = paths
            .map((p) => pdfPageFromPath(p))
            .filter((n): n is number => n != null)
          const absLabel =
            absPages.length === paths.length && absPages.length > 0
              ? absPages.length <= 6
                ? absPages.join(', ')
                : `${absPages[0]}–${absPages[absPages.length - 1]}`
              : `${pageNum}`
          const lotSizeUi = CHECKPOINT_EVERY_PAGES
          const totalLotsUi = Math.max(1, Math.ceil(paths.length / lotSizeUi))
          const currentLotUi = Math.min(totalLotsUi, Math.floor(pageIndex / lotSizeUi) + 1)
          await setStage(
            admin,
            body.analysisId,
            'EXTRACTING_MODULES',
            'extracting_batch',
            `Lote ${currentLotUi}/${totalLotsUi} (PDF págs. ${absLabel}): lendo página ${absPage} (${pageNum}/${paths.length} deste lote)…`,
            'vision',
          )

          const prevPartial =
            totals.partial_extraction && typeof totals.partial_extraction === 'object'
              ? (totals.partial_extraction as AnyRec)
              : { environments: [], auditor_notes: [], warnings: [] }

          let merged = prevPartial
          let modulesFound = countModules(merged)
          let skippedPage = false
          try {
            const batchCall = await callLlm({
              model: EXTRACTOR_MODEL,
              system: systemExtractor + ragEffective,
              userContent: [
                {
                  type: 'text',
                  text: `PÁGINA ÚNICA ${pageNum}/${paths.length} do PDF.
INVENTÁRIO ESPERADO:
${inventoryText}

Extraia APENAS o que estiver VISÍVEL nesta página.
bounding_box.page = índice PDF desta imagem.
Não invente móveis de outras páginas.

REGRA ANTI-VAZIO: se a página for render/foto/ilustração SEM cotas, AINDA ASSIM liste os móveis VISÍVEIS
(ou os do inventário que aparecem nesta imagem) com dimensions_estimated=true e cotas tipológicas.
PROIBIDO devolver environments: [] quando há mobiliário visível ou inventário correspondente nesta página.`,
                },
                ...(await labeledImagesForVision(
                  pageContents.length ? pageContents : [{ ...signedContents[0], path }],
                )),
              ],
              schemaName: 'quote_extraction_batch',
              schema: EXTRACTOR_SCHEMA,
              maxTokens: 8000,
            })
            let pageExtraction = rebalanceEnvironments(
              ensurePlaceholders(mergeExtractions([batchCall.json])),
              inventory,
            )
            // Página só ilustrativa: modelo às vezes devolve []. Injeta inventário como stub.
            if (
              asObjArray(pageExtraction.environments).length === 0 &&
              inventory.length > 0
            ) {
              pageExtraction = injectInventoryAsEstimatedModules(pageExtraction, inventory, absPage)
            }
            merged = rebalanceEnvironments(
              ensurePlaceholders(mergeExtractions([prevPartial, pageExtraction])),
              inventory,
            )
            modulesFound = countModules(merged)
          } catch (pageErr) {
            const pageMsg = pageErr instanceof Error ? pageErr.message : String(pageErr)
            // Página densa / JSON/schema quebrado: não mata PDF — pula e segue.
            if (
              /JSON|não é JSON|Expected ','|fallback gpt-4o bloqueado|schema|typology|Zod|Invalid option|fora do schema/i.test(
                pageMsg,
              )
            ) {
              console.error('[chain_tick] skip page after JSON/schema failure', pageNum, pageMsg.slice(0, 200))
              skippedPage = true
              const warnings = Array.isArray(prevPartial.warnings)
                ? [...(prevPartial.warnings as unknown[])]
                : []
              warnings.push(
                `Página ${pageNum}: leitura ignorada (resposta da IA inválida). Clique em Retomar se faltar móvel.`,
              )
              merged = { ...prevPartial, warnings }
              modulesFound = countModules(merged)
            } else {
              throw pageErr
            }
          }

          const nextPage = pageIndex + 1
          const lotSize = CHECKPOINT_EVERY_PAGES
          const totalLots = Math.max(1, Math.ceil(paths.length / lotSize))
          const finishedLot =
            nextPage < paths.length && nextPage > 0 && nextPage % lotSize === 0
          const lotJustDone = finishedLot ? nextPage / lotSize : 0
          let pipelineDetail: string
          if (skippedPage) {
            pipelineDetail = `Página ${pageNum} ignorada (JSON inválido). Seguindo ${nextPage + 1}/${paths.length}…`
          } else if (nextPage >= paths.length) {
            pipelineDetail = `Extração concluída (${modulesFound} módulos). Iniciando auditoria por ambiente…`
          } else if (finishedLot) {
            pipelineDetail = `Lote ${lotJustDone}/${totalLots} concluído — páginas ${nextPage - lotSize + 1}–${nextPage} salvas (checkpoint). Seguindo lote ${lotJustDone + 1}…`
          } else {
            const currentLot = Math.floor(pageIndex / lotSize) + 1
            const lotStart = (currentLot - 1) * lotSize + 1
            const lotEnd = Math.min(paths.length, currentLot * lotSize)
            pipelineDetail = `Lote ${currentLot}/${totalLots} (págs. ${lotStart}–${lotEnd}): lendo página ${nextPage + 1} de ${paths.length}… Módulos: ${modulesFound}`
          }

          await patchTotals(
            {
              partial_extraction: merged,
              current_page: nextPage,
              total_pages: paths.length,
              modules_found_count: modulesFound,
              inventory,
              checkpoint_every_pages: lotSize,
              extraction_lot:
                nextPage >= paths.length
                  ? totalLots
                  : Math.min(totalLots, Math.floor(pageIndex / lotSize) + 1),
              pipeline_stage: nextPage >= paths.length ? 'auditing' : 'extracting_batch',
              pipeline_detail: pipelineDetail,
              async_chain_status: 'running',
            },
            nextPage >= paths.length ? 'AUDITING_REVISION' : 'EXTRACTING_MODULES',
          )

          if (nextPage < paths.length) {
            enqueueChain({
              phase: 'chain_tick',
              chainStep: 'extract',
              pageIndex: nextPage,
              pagePaths: paths,
            })
          } else {
            enqueueChain({
              phase: 'chain_tick',
              chainStep: 'audit',
              envIndex: 0,
              pagePaths: paths,
            })
          }

          return jsonResponse({
            ok: true,
            phase: 'chain_tick',
            chainStep: 'extract',
            pageIndex,
            modulesFound,
            skippedPage,
            pagesLeft: Math.max(0, paths.length - nextPage),
          })
        }

        // —— AUDIT 1 ENVIRONMENT ——
        if (chainStep === 'audit') {
          const inventory = sanitizeInventory(
            Array.isArray(totals.inventory) ? (totals.inventory as InventoryEnv[]) : [],
          )
          let extraction =
            totals.partial_extraction && typeof totals.partial_extraction === 'object'
              ? ensurePlaceholders(totals.partial_extraction as AnyRec)
              : { environments: [], auditor_notes: [], warnings: [] }
          const envs = asObjArray(extraction.environments)
          const audited = Array.isArray(totals.audited_environments)
            ? (totals.audited_environments as string[]).filter((x) => typeof x === 'string')
            : []

          // Avança envIndex até achar ambiente ainda não auditado
          while (envIndex < envs.length) {
            const name = typeof envs[envIndex].name === 'string' ? String(envs[envIndex].name) : ''
            if (name && !audited.includes(name)) break
            envIndex += 1
          }

          if (envIndex >= envs.length) {
            // Revalida: ambientes novos (merge) ainda sem auditoria → continua, não marca ready cedo
            const unauditedIdx = envs.findIndex((e) => {
              const name = typeof e.name === 'string' ? String(e.name) : ''
              return Boolean(name) && !audited.includes(name)
            })
            if (unauditedIdx >= 0) {
              enqueueChain({
                phase: 'chain_tick',
                chainStep: 'audit',
                envIndex: unauditedIdx,
                pagePaths: paths,
              })
              return jsonResponse({
                ok: true,
                phase: 'chain_tick',
                chainStep: 'audit',
                resumed_unaudited: true,
                envIndex: unauditedIdx,
              })
            }
            // Cadeia concluída → client cotará
            // Amplia inventário com o que foi extraído (capa curta não pode “fechar” cobertura).
            let finalExtraction = extraction
            if (asObjArray(finalExtraction.environments).length === 0 && inventory.length > 0) {
              finalExtraction = injectInventoryAsEstimatedModules(
                finalExtraction,
                inventory,
                pdfPageFromPath(paths[0] || '') || 1,
              )
            }
            const fullInventory = expandInventoryFromExtraction(inventory, finalExtraction)
            await patchTotals(
              {
                partial_extraction: finalExtraction,
                inventory: fullInventory,
                coverage: buildCoverage(fullInventory, finalExtraction),
                async_chain_status: 'ready_for_pricing',
                pipeline_stage: 'pricing_pending',
                pipeline_detail:
                  'Extração e auditoria prontas — montando lista de materiais do projeto…',
                modules_found_count: countModules(finalExtraction),
                current_page: paths.length,
                total_pages: paths.length,
              },
              'AUDITING_REVISION',
            )
            return jsonResponse({
              ok: true,
              phase: 'chain_tick',
              chainStep: 'done',
              async_chain_status: 'ready_for_pricing',
            })
          }

          const env = envs[envIndex]
          const envName = typeof env.name === 'string' ? String(env.name) : `Ambiente ${envIndex + 1}`
          const envOnly: AnyRec = {
            environments: [env],
            auditor_notes: Array.isArray(extraction.auditor_notes) ? extraction.auditor_notes : [],
            warnings: Array.isArray(extraction.warnings) ? extraction.warnings : [],
          }

          // Páginas citadas nos bounding boxes deste ambiente (cap 6)
          const pageSet = new Set<number>()
          for (const mod of asObjArray(env.modules)) {
            const bb = mod.bounding_box
            if (bb && typeof bb === 'object' && typeof (bb as AnyRec).page === 'number') {
              pageSet.add(Number((bb as AnyRec).page))
            }
          }
          const wantedPages = [...pageSet].filter((n) => n >= 1).slice(0, 6)
          let windowContents = signedContents.filter((c) => {
            const n = pdfPageFromPath(c.path)
            return n != null && wantedPages.includes(n)
          })
          if (!windowContents.length) {
            windowContents = pickAuditContents(signedContents, envOnly, 1, 4)
          }
          windowContents = windowContents.slice(0, 6)

          await setStage(
            admin,
            body.analysisId,
            'AUDITING_REVISION',
            'auditing',
            `Auditoria incremental: ${envName} (${envIndex + 1}/${envs.length})…`,
            'audit',
          )

          const inventoryText = formatInventoryText(inventory)
          try {
            const auditCall = await callLlm({
              model: AUDITOR_MODEL,
              system: systemAuditor,
              userContent: [
                {
                  type: 'text',
                  text: `AUDITORIA INCREMENTAL — ambiente "${envName}" apenas.
Devolva a árvore CORRIGIDA só deste ambiente (environments com 1 item).
Não apague módulos evidentes nas imagens. Complete BOM se faltar.
${selectedPagesForAudit.length ? `selected_pages=[${selectedPagesForAudit.join(', ')}]` : ''}

INVENTÁRIO:
${inventoryText}

ÁRVORE DO AMBIENTE:
${JSON.stringify(envOnly).slice(0, 40000)}`,
                },
                ...(await labeledImagesForVision(windowContents)),
              ],
              schemaName: 'quote_extraction_audited_env',
              schema: EXTRACTOR_SCHEMA,
              maxTokens: 10000,
            })

            const auditedEnv = ensurePlaceholders(auditCall.json)
            // Substitui só o ambiente auditado — preferindo módulos com mais peças (anti-apagão)
            const auditedEnvsList = asObjArray(auditedEnv.environments)
            if (auditedEnvsList.length) {
              const replacement = mergeEnvPreferRicher(envs[envIndex] || {}, auditedEnvsList[0])
              const nextEnvs = envs.map((e, i) => (i === envIndex ? replacement : e))
              extraction = ensurePlaceholders({
                ...extraction,
                environments: nextEnvs,
              })
            }
          } catch (auditEnvErr) {
            const msg = auditEnvErr instanceof Error ? auditEnvErr.message : String(auditEnvErr)
            console.warn(`[chain] audit_environment ${envName}:`, msg)
            const warnings = Array.isArray(extraction.warnings)
              ? [...(extraction.warnings as string[])]
              : []
            warnings.push(`Auditoria de "${envName}" incompleta: ${msg.slice(0, 120)}`)
            extraction = { ...extraction, warnings: [...new Set(warnings)] }
          }

          const auditedNext = [...audited, envName]
          await patchTotals(
            {
              partial_extraction: extraction,
              audited_environments: auditedNext,
              modules_found_count: countModules(extraction),
              pipeline_stage: 'auditing',
              pipeline_detail: `Ambiente auditado: ${envName}. Próximos…`,
              async_chain_status: 'running',
            },
            'AUDITING_REVISION',
          )

          enqueueChain({
            phase: 'chain_tick',
            chainStep: 'audit',
            envIndex: envIndex + 1,
            pagePaths: paths,
          })

          return jsonResponse({
            ok: true,
            phase: 'chain_tick',
            chainStep: 'audit',
            environment: envName,
            envIndex,
          })
        }

        return jsonResponse({ ok: false, error: `chainStep inválido: ${chainStep}` }, 400)
      } catch (chainErr) {
        const msg = chainErr instanceof Error ? chainErr.message : String(chainErr)
        console.error('[chain_tick] failed:', msg)
        await patchTotals(
          {
            pipeline_stage: 'failed',
            pipeline_detail: `Falha na página/ambiente: ${msg.slice(0, 180)}. Clique em Retomar.`,
            async_chain_status: 'failed',
            current_page: pageIndex,
          },
          'FAILED',
        )
        return jsonResponse({ ok: false, error: msg }, 500)
      }
    }

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
      // Self-heal nunca deve piscar EXTRACTING_MODULES na UI
      await setStage(
        admin,
        body.analysisId,
        healFeedback ? 'AUDITING_REVISION' : 'EXTRACTING_MODULES',
        healFeedback ? 'self_heal' : 'extracting_batch',
        healFeedback
          ? `Auto-correção: encaixe cirúrgico (${signedContents.length} página(s))…`
          : `Caçando chapas MDF, puxadores e dobradiças neste lote (${signedContents.length} página(s))…`,
        healFeedback ? 'audit' : 'vision',
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

    if (phase === 'heal_module') {
      const inventory = sanitizeInventory(Array.isArray(body.inventory) ? body.inventory : [])
      const inventoryText = formatInventoryText(inventory)
      const healFeedback =
        typeof body.healFeedback === 'string' && body.healFeedback.trim()
          ? body.healFeedback.trim()
          : ''
      const missingModules = Array.isArray(body.missingModules)
        ? body.missingModules.filter(
            (m): m is CoverageItemLite =>
              !!m &&
              typeof m === 'object' &&
              typeof (m as CoverageItemLite).environment === 'string' &&
              typeof (m as CoverageItemLite).module === 'string',
          )
        : []
      const currentExtraction =
        (body.currentExtraction && typeof body.currentExtraction === 'object'
          ? body.currentExtraction
          : null) ||
        (body.extraction && typeof body.extraction === 'object' ? body.extraction : null) ||
        { environments: [], auditor_notes: [], warnings: [] }

      const missingText = missingModules.length
        ? missingModules.map((m) => `- ${m.environment} → ${m.module}`).join('\n')
        : '(ver healFeedback)'

      await setStage(
        admin,
        body.analysisId,
        'AUDITING_REVISION',
        'self_heal',
        `Auto-correção: encaixe cirúrgico — ${
          missingModules
            .slice(0, 2)
            .map((m) => m.module)
            .join(', ') || 'módulo faltante'
        }…`,
        'audit',
      )

      const imageBudget =
        mode === 'max' && isClaudeModel(EXTRACTOR_MODEL) ? AUDIT_IMAGES_PER_PASS_CLAUDE : 8
      const windowContents = pickAuditContents(signedContents, currentExtraction, 1, imageBudget)

      const healSystem =
        systemExtractor +
        ragBlock +
        `\n\nMODO CURA CIRÚRGICA (Targeted Self-Heal):
- Devolva APENAS os módulos da lista obrigatória (ausentes do inventário).
- NÃO reescreva nem devolva de novo os módulos já presentes na árvore atual.
- Estrutura: environments com só os módulos novos, caixaria/frentes, cotas mm e bounding_box.
- Nome canônico curto (ex.: "Painel TV").`

      const batchCall = await callLlm({
        model: EXTRACTOR_MODEL,
        system: healSystem,
        userContent: [
          {
            type: 'text',
            text: `${healFeedback ? `${healFeedback}\n\n` : ''}CURA CIRÚRGICA — extraia SOMENTE estes módulos faltantes:
${missingText}

INVENTÁRIO DO PROJETO (âncora):
${inventoryText}

ÁRVORE ATUAL (referência — NÃO devolva estes módulos de novo):
${JSON.stringify(currentExtraction).slice(0, 30000)}

Cada imagem vem com "PDF página N" — use esse N em bounding_box.page.
Resposta: JSON quote_extraction só com os módulos novos.`,
          },
          ...(await labeledImagesForVision(windowContents)),
        ],
        schemaName: 'quote_extraction_heal',
        schema: EXTRACTOR_SCHEMA,
        maxTokens: 8000,
      })
      await recordPromptTraces(admin, body.analysisId, [
        {
          agent_key: 'extractor_heal',
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
        pagesProcessed: windowContents.length,
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
      const forcedInjectLock = body.forcedInjectLock === true
      const auditStage = healFeedback || forcedInjectLock ? 'self_heal' : 'auditing'
      let extraction = ensurePlaceholders(
        body.extraction && typeof body.extraction === 'object'
          ? body.extraction
          : { environments: [], auditor_notes: [], warnings: [] },
      )
      const extractionBeforeAudit = extraction

      const auditPasses =
        mode === 'max' && isClaudeModel(AUDITOR_MODEL) ? MAX_AUDIT_PASSES_CLAUDE : MAX_AUDIT_PASSES
      let imageBudget =
        mode === 'max' && isClaudeModel(AUDITOR_MODEL)
          ? AUDIT_IMAGES_PER_PASS_CLAUDE
          : AUDIT_IMAGES_PER_PASS
      // Com lock de injeção: 1 passagem basta (não arriscar remoção em loops longos)
      const effectivePasses = forcedInjectLock ? 1 : auditPasses
      let passesRun = 0
      let lastScore = -1
      let lastAuditMeta: LlmJsonResult | null = null

      for (let pass = 1; pass <= effectivePasses; pass++) {
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
          auditStage,
          forcedInjectLock || healFeedback
            ? `Auto-correção: auditoria preservando injeção (passagem ${pass}/${effectivePasses})…`
            : `Auditoria passagem ${pass}/${effectivePasses}: score ${score} (BOM ${gaps.length}, faltando ${coverageBefore.missing.length}, extras ${coverageBefore.extras.length}, tipologia ${typology.length})…`,
          'audit',
        )

        const windowContents = pickAuditContents(signedContents, extraction, pass, imageBudget)

        const injectRules =
          forcedInjectLock || healFeedback
            ? `\n\n═══ REGRA OBRIGATÓRIA DE INJEÇÃO ═══
- Módulos com auditor_notes contendo "${FORCED_INJECT_NOTE}" NÃO podem ser removidos.
- Se o inventário ainda listar faltantes após a cura cirúrgica, INJETE-OS na árvore com dimensões e materiais padrão do ambiente (caixaria mínima).
- Cobertura 100% do inventário é obrigatória antes de encerrar.
- Não invente extras fora do inventário; complete BOM dos existentes.`
            : ''

        try {
          const auditCall = await callLlm({
            model: AUDITOR_MODEL,
            system: systemAuditor + injectRules,
            userContent: [
              {
                type: 'text',
                text: `${healFeedback ? `${healFeedback}\n\n` : ''}PASSAGEM ${pass}/${effectivePasses} — verifique as imagens e devolva a árvore CORRIGIDA.
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
${injectRules}

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
          if (forcedInjectLock) {
            extraction = preserveForcedInjectModules(extractionBeforeAudit, extraction)
          }
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

      if (forcedInjectLock) {
        extraction = preserveForcedInjectModules(extractionBeforeAudit, extraction)
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
      'AUDITING_REVISION',
      'pricing_pending',
      'Extração pronta — montando lista de materiais do projeto (preços só no fim)…',
      'info',
    )
    await admin
      .from('quote_analyses')
      .update({
        status: 'AUDITING_REVISION',
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

