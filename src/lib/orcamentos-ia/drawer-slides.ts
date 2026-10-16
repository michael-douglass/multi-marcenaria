/**
 * E4 — Gavetas → corrediças (sempre por unidade/par, nunca pacote).
 * Se o módulo tem gaveta e a IA omitiu corrediça, injeta no BOM de ferragens.
 */
import { mapHardwareAlias } from '@/lib/orcamentos-ia/hardware-alias'
import type { QuoteExtraction } from '@/lib/orcamentos-ia/schemas'

export interface DrawerCountInput {
  name?: string | null
  typology?: string | null
  drawer_count?: number | null
  frentes_portas?: Array<{ kind?: string | null; name?: string | null; quantity?: number | null }>
  caixaria?: Array<{ function?: string | null; name?: string | null }>
}

const GAVETA_NAME_RE = /gaveteiro|gavetas?|balc[aã]o\s*(com\s*)?gavet|coluna\s*gavet/i
const SLIDE_NAME_RE = /corredic|telescop|\bslide\b|fecho\s*toque/i

function normalize(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

/** Conta gavetas no módulo (frentes + drawer_count + nome/tipologia). */
export function countModuleDrawers(mod: DrawerCountInput): number {
  const fromField = Number(mod.drawer_count)
  const fieldOk = Number.isFinite(fromField) && fromField > 0 ? Math.floor(fromField) : 0

  let fromFrentes = 0
  for (const f of mod.frentes_portas || []) {
    const kind = String(f.kind || '')
    const name = String(f.name || '')
    const qty = Math.max(1, Number(f.quantity) || 1)
    if (kind === 'frente_gaveta' || /gaveta/i.test(name)) {
      fromFrentes += qty
    }
  }

  let fromCaixaria = 0
  for (const p of mod.caixaria || []) {
    const blob = `${p.function || ''} ${p.name || ''}`
    if (/gaveta/i.test(blob) && /lateral|fundo|contra/i.test(blob)) {
      // kit: laterais vêm em pares — conta ~1 gaveta por “gaveta_fundo” ou nome caixa
      if (/fundo|caixa|corpo/i.test(blob)) fromCaixaria += 1
    }
  }

  const nameHint = GAVETA_NAME_RE.test(mod.name || '')
  const typologyHint =
    mod.typology === 'gaveteiro' ||
    (mod.typology === 'balcao' && /gavet/i.test(mod.name || ''))

  let n = Math.max(fieldOk, fromFrentes, fromCaixaria)

  // Nome/tipologia de gaveteiro sem frentes tipadas → default fabril 3
  if (n === 0 && (nameHint || typologyHint || mod.typology === 'gaveteiro')) {
    n = fieldOk > 0 ? fieldOk : 3
  }

  return n
}

export function moduleHasDrawerSlide(ferragens: Array<{ raw_name?: string | null }> | undefined): boolean {
  for (const f of ferragens || []) {
    const raw = String(f.raw_name || '')
    if (SLIDE_NAME_RE.test(normalize(raw))) return true
    const mapped = mapHardwareAlias(raw)
    if (mapped.key === 'corredica_oculta_45' || mapped.key === 'corredica_teles_25') return true
  }
  return false
}

/** Label canônico conforme preferência (default: oculta soft-close). */
export function drawerSlideCanonicalName(
  slideType?: 'telescopic' | 'telescopic_light' | 'hidden_soft_close' | 'touch' | string | null,
): string {
  if (slideType === 'telescopic' || slideType === 'telescopic_light') {
    return 'CORREDIÇA TELES 25'
  }
  if (slideType === 'touch') {
    return 'CORREDIÇA OCULTA 45'
  }
  return 'CORREDIÇA OCULTA 45'
}

/**
 * Garante 1 par de corrediças por gaveta em `ferragens`.
 * Não inventa gaveta onde não há sinal; só completa ferragem faltante.
 */
export function ensureDrawerSlidesInModule<T extends DrawerCountInput & {
  out_of_scope?: boolean | null
  ferragens?: Array<{
    raw_name: string
    category: 'ferragem' | 'puxador' | 'consumivel'
    unit_measure?: 'un' | 'barra' | 'm' | 'kg'
    exact_quantity: number
    full_units_quantity: number
    notes?: string
  }>
  drawer_count?: number | null
}>(
  mod: T,
  options?: { slideType?: string | null },
): T {
  if (mod.out_of_scope) return mod
  const drawers = countModuleDrawers(mod)
  if (drawers <= 0) return mod

  const ferragens = [...(mod.ferragens || [])]
  const slideName = drawerSlideCanonicalName(options?.slideType)
  const mapped = mapHardwareAlias(slideName)

  if (moduleHasDrawerSlide(ferragens)) {
    // Já existe — eleva quantidade se estiver abaixo do nº de gavetas
    let raised = false
    const next = ferragens.map((f) => {
      const raw = String(f.raw_name || '')
      const key = mapHardwareAlias(raw).key
      const isSlide =
        SLIDE_NAME_RE.test(normalize(raw)) ||
        key === 'corredica_oculta_45' ||
        key === 'corredica_teles_25'
      if (!isSlide) return f
      const qty = Number(f.exact_quantity) || 0
      if (qty >= drawers) return f
      raised = true
      return {
        ...f,
        exact_quantity: drawers,
        full_units_quantity: drawers,
        notes: [f.notes, `Ajustado: ${drawers} par(es) = ${drawers} gaveta(s)`]
          .filter(Boolean)
          .join('; '),
      }
    })
    return {
      ...mod,
      drawer_count: Math.max(Number(mod.drawer_count) || 0, drawers),
      ferragens: raised ? next : ferragens,
    }
  }

  ferragens.push({
    raw_name: mapped.canonicalName,
    category: 'ferragem',
    unit_measure: 'un',
    exact_quantity: drawers,
    full_units_quantity: drawers,
    notes: `Injetado E4: 1 par de corrediças por gaveta (${drawers}) — nunca pacote`,
  })

  return {
    ...mod,
    drawer_count: Math.max(Number(mod.drawer_count) || 0, drawers),
    ferragens,
  }
}

/** Aplica ensureDrawerSlides em toda a árvore de extração. */
export function ensureDrawerSlidesInExtraction(
  extraction: QuoteExtraction,
  options?: { slideType?: string | null },
): QuoteExtraction {
  return {
    ...extraction,
    environments: (extraction.environments || []).map((env) => ({
      ...env,
      modules: (env.modules || []).map((mod) => ensureDrawerSlidesInModule(mod, options)),
    })),
  }
}

/** Soma corrediças canônicas no consolidated / shopping (pares). */
export function sumCorredicaPairs(
  ferragens: Array<{ raw_name?: string; exact_quantity?: number; quantity?: number }>,
): number {
  let total = 0
  for (const f of ferragens) {
    const raw = String(f.raw_name || '')
    const key = mapHardwareAlias(raw).key
    const isSlide =
      SLIDE_NAME_RE.test(normalize(raw)) ||
      key === 'corredica_oculta_45' ||
      key === 'corredica_teles_25'
    if (!isSlide) continue
    total += Number(f.exact_quantity ?? f.quantity) || 0
  }
  return total
}
