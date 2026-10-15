import {
  allocateSalePrice,
  calculateQuotePricing,
  environmentMaterialsCost,
  formatBRL,
  moduleMaterialsCost,
  type PricingParams,
  type PricingResult,
  DEFAULT_PRICING_PARAMS,
} from '@/lib/orcamentos-ia/pricing'
import type {
  QuoteAnalysisDetail,
  QuoteEnvironmentRow,
  QuoteModuleRow,
} from '@/lib/orcamentos-ia/quote-tree'

export interface QuotePageImage {
  index: number
  path: string
  url: string
}

export interface QuotePresentationBranding {
  companyName: string
  logoUrl?: string | null
  cnpj?: string | null
  razaoSocial?: string | null
}

export interface QuotePresentationModuleBlock {
  id: string
  name: string
  /** Resumo curto da descrição da IA (sem preço). */
  description: string | null
  dimensionsLabel: string | null
  /** Linhas de detalhe para a proposta (peças, ferragens, materiais). */
  detailLines: string[]
  materialsCost: number
  salePrice: number
  imageUrl: string | null
  pageNumber: number | null
  outOfScope: boolean
  marketPriceCount: number
  sheetPieceCount: number
  hardwareCount: number
}

export interface QuotePresentationEnvironmentBlock {
  id: string
  name: string
  materialsCost: number
  salePrice: number
  imageUrl: string | null
  modules: QuotePresentationModuleBlock[]
}

export interface QuotePresentationLayout {
  projectTitle: string
  generatedAtLabel: string
  branding: QuotePresentationBranding
  pricing: PricingResult
  environments: QuotePresentationEnvironmentBlock[]
  outOfScopeModules: QuotePresentationModuleBlock[]
  marketPriceFlags: number
}

function padPageIndex(n: number): string {
  return String(n).padStart(3, '0')
}

/** Resolve URL da página do móvel (path assinado ou índice em pageImages). */
export function resolveModuleImageUrl(
  mod: Pick<QuoteModuleRow, 'page_image_path' | 'page_number' | 'materials'>,
  pageImages: QuotePageImage[],
): string | null {
  const byPath = new Map(pageImages.map((p) => [p.path, p.url]))
  if (mod.page_image_path && byPath.has(mod.page_image_path)) {
    return byPath.get(mod.page_image_path) ?? null
  }
  const pageFromMat = mod.materials.find((m) => m.page_image_path)?.page_image_path
  if (pageFromMat && byPath.has(pageFromMat)) {
    return byPath.get(pageFromMat) ?? null
  }
  const pageNum =
    mod.page_number ??
    mod.materials.find((m) => m.bounding_box?.page != null)?.bounding_box?.page ??
    null
  if (pageNum != null && pageNum > 0) {
    const hit =
      pageImages.find((p) => p.index === pageNum) ||
      pageImages.find((p) => p.path.includes(`page-${padPageIndex(pageNum)}`))
    if (hit) return hit.url
  }
  return pageImages[0]?.url ?? null
}

export function formatModuleDimensions(
  dimensions: Record<string, unknown> | null | undefined,
): string | null {
  if (!dimensions || typeof dimensions !== 'object') return null
  const w = Number(dimensions.width_mm)
  const h = Number(dimensions.height_mm)
  const d = Number(dimensions.depth_mm)
  const parts: string[] = []
  if (Number.isFinite(w) && w > 0) parts.push(`${Math.round(w)}`)
  if (Number.isFinite(h) && h > 0) parts.push(`${Math.round(h)}`)
  if (Number.isFinite(d) && d > 0) parts.push(`${Math.round(d)}`)
  if (parts.length < 2) return null
  return `${parts.join(' × ')} mm`
}

function projectTitleFromTree(tree: QuoteAnalysisDetail): string {
  const path = tree.source_pdf_path
  if (!path) return 'Proposta de orçamento'
  const base = path.split('/').pop() || 'Proposta de orçamento'
  return decodeURIComponent(base.replace(/\+/g, ' '))
}

function countMarketFlags(mod: QuoteModuleRow): number {
  return mod.materials.filter((m) => m.using_market_price || !m.market_price_confirmed).length
}

function summarizeModuleDetails(mod: QuoteModuleRow): {
  description: string | null
  detailLines: string[]
  sheetPieceCount: number
  hardwareCount: number
} {
  const mats = mod.materials || []
  const sheetCats = new Set(['chapa', 'fita_borda'])
  const hwCats = new Set(['ferragem', 'puxador', 'consumivel'])
  let sheetPieceCount = 0
  let hardwareCount = 0
  const names: string[] = []
  for (const m of mats) {
    const cat = String(m.category || '').toLowerCase()
    const qty = Math.max(0, Number(m.full_units_quantity) || Number(m.exact_quantity) || 0)
    if (sheetCats.has(cat) || cat === 'chapa') sheetPieceCount += qty || 1
    if (hwCats.has(cat)) hardwareCount += qty || 1
    const label = String(m.raw_name || '').trim()
    if (label && names.length < 4 && !names.some((n) => n.toLowerCase() === label.toLowerCase())) {
      names.push(label)
    }
  }
  const detailLines: string[] = []
  if (sheetPieceCount > 0) detailLines.push(`${Math.round(sheetPieceCount)} peça(s) de chapa/fita`)
  if (hardwareCount > 0) detailLines.push(`${Math.round(hardwareCount)} ferragem(ns)/acessório(s)`)
  if (names.length) detailLines.push(names.join(' · '))
  const description =
    typeof mod.description === 'string' && mod.description.trim()
      ? mod.description.trim().slice(0, 160)
      : null
  return { description, detailLines, sheetPieceCount, hardwareCount }
}

function buildModuleBlock(
  mod: QuoteModuleRow,
  pageImages: QuotePageImage[],
  totalSale: number,
  totalCost: number,
  sheetLossPct: number,
): QuotePresentationModuleBlock {
  const cost = moduleMaterialsCost(mod, sheetLossPct)
  const details = summarizeModuleDetails(mod)
  return {
    id: mod.id,
    name: mod.name,
    description: details.description,
    dimensionsLabel: formatModuleDimensions(mod.dimensions),
    detailLines: details.detailLines,
    materialsCost: cost,
    salePrice: mod.out_of_scope ? 0 : allocateSalePrice(totalSale, cost, totalCost),
    imageUrl: resolveModuleImageUrl(mod, pageImages),
    pageNumber: mod.page_number,
    outOfScope: mod.out_of_scope,
    marketPriceCount: countMarketFlags(mod),
    sheetPieceCount: details.sheetPieceCount,
    hardwareCount: details.hardwareCount,
  }
}

function pickEnvironmentImage(
  modules: QuotePresentationModuleBlock[],
): string | null {
  return modules.find((m) => m.imageUrl)?.imageUrl ?? null
}

export function buildQuotePresentationLayout(input: {
  tree: QuoteAnalysisDetail
  pricingParams?: PricingParams
  pageImages?: QuotePageImage[]
  branding: QuotePresentationBranding
  generatedAt?: Date
}): QuotePresentationLayout {
  const params = input.pricingParams ?? DEFAULT_PRICING_PARAMS
  const pageImages = input.pageImages ?? []
  const pricing = calculateQuotePricing(input.tree, params)
  const sheetLoss = params.sheetLossPct ?? DEFAULT_PRICING_PARAMS.sheetLossPct ?? 15
  const generatedAt = input.generatedAt ?? new Date()

  const environments: QuotePresentationEnvironmentBlock[] = []
  const outOfScopeModules: QuotePresentationModuleBlock[] = []

  for (const env of input.tree.environments as QuoteEnvironmentRow[]) {
    const scoped = env.modules.filter((m) => !m.out_of_scope)
    const oos = env.modules.filter((m) => m.out_of_scope)

    for (const mod of oos) {
      outOfScopeModules.push(
        buildModuleBlock(mod, pageImages, pricing.salePrice, pricing.materialsCost, sheetLoss),
      )
    }

    if (!scoped.length) continue

    const modules = scoped.map((mod) =>
      buildModuleBlock(mod, pageImages, pricing.salePrice, pricing.materialsCost, sheetLoss),
    )
    const envCost = environmentMaterialsCost({ modules: scoped }, sheetLoss)
    environments.push({
      id: env.id,
      name: env.name,
      materialsCost: envCost,
      salePrice: allocateSalePrice(pricing.salePrice, envCost, pricing.materialsCost),
      imageUrl: pickEnvironmentImage(modules),
      modules,
    })
  }

  const marketPriceFlags = environments.reduce(
    (acc, env) => acc + env.modules.reduce((a, m) => a + m.marketPriceCount, 0),
    0,
  )

  return {
    projectTitle: projectTitleFromTree(input.tree),
    generatedAtLabel: generatedAt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    branding: input.branding,
    pricing,
    environments,
    outOfScopeModules,
    marketPriceFlags,
  }
}

/** Cópia profunda do layout para edição pré-impressão. */
export function clonePresentationLayout(
  layout: QuotePresentationLayout,
): QuotePresentationLayout {
  return JSON.parse(JSON.stringify(layout)) as QuotePresentationLayout
}

/**
 * Recalcula totais de ambiente e capa a partir dos móveis
 * (após o usuário editar valores individuais).
 */
export function recomputePresentationTotals(
  layout: QuotePresentationLayout,
): QuotePresentationLayout {
  const environments = layout.environments.map((env) => {
    const materialsCost = round2(env.modules.reduce((a, m) => a + (Number(m.materialsCost) || 0), 0))
    const salePrice = round2(env.modules.reduce((a, m) => a + (Number(m.salePrice) || 0), 0))
    return { ...env, materialsCost, salePrice }
  })
  const materialsCost = round2(environments.reduce((a, e) => a + e.materialsCost, 0))
  const salePrice = round2(environments.reduce((a, e) => a + e.salePrice, 0))
  return {
    ...layout,
    environments,
    pricing: {
      ...layout.pricing,
      materialsCost,
      salePrice,
    },
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Cálculo interno (não vai para o PDF): mão de obra + lucro % sobre (materiais + mão de obra). */
export function computeLaborProfitExtra(
  materialsCost: number,
  laborCost: number,
  profitPercent: number,
): {
  labor: number
  profitPercent: number
  profitValue: number
  totalExtra: number
  costBase: number
} {
  const labor = Math.max(0, Number(laborCost) || 0)
  const pct = Math.min(95, Math.max(0, Number(profitPercent) || 0))
  const mats = Math.max(0, Number(materialsCost) || 0)
  const costBase = round2(mats + labor)
  const profitValue = round2(costBase * (pct / 100))
  const totalExtra = round2(labor + profitValue)
  return { labor, profitPercent: pct, profitValue, totalExtra, costBase }
}

/**
 * Distribui a soma (mão de obra + lucro) nos preços de venda dos móveis,
 * proporcional ao custo de materiais de cada um.
 * `saleBaseline` = preços de venda de partida (evita dobrar ao redistribuir).
 * `current` = layout atual (fotos / materiais editados são preservados).
 */
export function distributeExtraOntoSalePrices(
  saleBaseline: QuotePresentationLayout,
  totalExtra: number,
  current?: QuotePresentationLayout,
): QuotePresentationLayout {
  const source = current ?? saleBaseline
  const extra = Math.max(0, Number(totalExtra) || 0)
  const baselineSaleByMod = new Map<string, number>()
  for (const env of saleBaseline.environments) {
    for (const mod of env.modules) {
      baselineSaleByMod.set(mod.id, Number(mod.salePrice) || 0)
    }
  }

  const totalMat = Math.max(
    0,
    source.environments.reduce(
      (a, env) => a + env.modules.reduce((b, m) => b + (Number(m.materialsCost) || 0), 0),
      0,
    ),
  )
  const moduleCount = source.environments.reduce((a, env) => a + env.modules.length, 0)

  let allocated = 0
  let seen = 0

  const environments = source.environments.map((env) => {
    const modules = env.modules.map((mod) => {
      seen += 1
      const mat = Math.max(0, Number(mod.materialsCost) || 0)
      let share = 0
      if (extra <= 0) share = 0
      else if (totalMat > 0) share = (extra * mat) / totalMat
      else if (moduleCount > 0) share = extra / moduleCount

      // Último móvel absorve centavos de arredondamento
      if (seen === moduleCount) {
        share = round2(extra - allocated)
      } else {
        share = round2(share)
        allocated = round2(allocated + share)
      }

      const baseSale = baselineSaleByMod.get(mod.id) ?? (Number(mod.salePrice) || 0)
      return {
        ...mod,
        salePrice: round2(baseSale + share),
      }
    })
    return { ...env, modules }
  })

  return recomputePresentationTotals({ ...source, environments })
}

export { formatBRL }
