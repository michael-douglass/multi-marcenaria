import { supabase } from '@/lib/supabase'
import type { MaterialCategory } from '@/lib/orcamentos-ia/schemas'
import type { QuoteAnalysisDetail, QuoteMaterialRow } from '@/lib/orcamentos-ia/quote-tree'

export const CONTINGENCY_PRICE_WARNING =
  'Preço estimado via tabela padrão de contingência'

export interface ResolvedMaterialPrice {
  unitPrice: number
  unit: string
  usingMarketPrice: boolean
  inventoryItemId: string | null
  matchedName: string
  source: 'inventory' | 'market' | 'contingency'
  /** Aviso exibido na UI quando o preço não veio do estoque cadastrado. */
  warning: string | null
}

/** Tabela de contingência — NUNCA devolver R$ 0 quando não houver match. */
export const CONTINGENCY_PRICES = {
  chapa_mdf_6mm: { unitPrice: 140, unit: 'chapa', label: 'Chapa MDF 6mm (Fundos)' },
  chapa_mdf_15mm_branco: { unitPrice: 220, unit: 'chapa', label: 'Chapa MDF 15mm Branco/Unicolor' },
  chapa_mdf_15mm_amadeirado: {
    unitPrice: 320,
    unit: 'chapa',
    label: 'Chapa MDF 15mm Amadeirado/Especial',
  },
  chapa_mdf_18mm: { unitPrice: 380, unit: 'chapa', label: 'Chapa MDF 18mm' },
  pedra_quartzo: { unitPrice: 950, unit: 'm2', label: 'Quartzo / Silestone (m²)' },
  pedra_granito: { unitPrice: 450, unit: 'm2', label: 'Granito / Mármore (m²)' },
  fita_borda_m: { unitPrice: 2.5, unit: 'm', label: 'Fita de Borda (metro)' },
  dobradica: { unitPrice: 15, unit: 'un', label: 'Dobradiça Soft Close' },
  corredica: { unitPrice: 45, unit: 'par', label: 'Corrediça Telescópica/Oculta (par)' },
  puxador_barra_3m: { unitPrice: 85, unit: 'barra', label: 'Puxador Perfil (barra 3m)' },
  tampinha: { unitPrice: 1.5, unit: 'un', label: 'Tampinha lateral puxador' },
  cola: { unitPrice: 35, unit: 'un', label: 'Cola / adesivo' },
  parafuso: { unitPrice: 0.35, unit: 'un', label: 'Parafuso / prego (un)' },
  minifix: { unitPrice: 1.2, unit: 'un', label: 'Minifix / conectores' },
  ferragem_generica: { unitPrice: 8, unit: 'un', label: 'Ferragem / acessório genérico' },
  servico_generico: { unitPrice: 80, unit: 'un', label: 'Serviço / mão de obra genérico' },
  outro: { unitPrice: 25, unit: 'un', label: 'Insumo genérico (contingência)' },
} as const

/** Normaliza nome do PDF: acentos, códigos CHAPA-…, ruído. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\bchapa[-_]?\w*\b/g, ' ')
    .replace(/\b(cod|sku|ref)[-.]?\w*\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tokens úteis para fuzzy (remove palavras muito curtas e genéricas). */
function significantTokens(value: string): string[] {
  const stop = new Set(['de', 'da', 'do', 'com', 'para', 'em', 'mm', 'cm', 'un', 'und'])
  return normalizeName(value)
    .split(' ')
    .filter((t) => t.length >= 2 && !stop.has(t))
}

/**
 * Score fuzzy 0–100:
 * - match exato / inclusão
 * - tokens compartilhados (ex.: "MDF Louro Freijó 15mm" ↔ "MDF 15mm")
 * - bônus por espessura (15, 18, 6) e família (branco, freijo, etc.)
 */
function scoreMatch(candidate: string, query: string): number {
  const a = normalizeName(candidate)
  const b = normalizeName(query)
  if (!a || !b) return 0
  if (a === b) return 100
  if (a.includes(b) || b.includes(a)) return 88

  const tokensA = new Set(significantTokens(candidate))
  const tokensB = significantTokens(query)
  if (!tokensB.length) return 0

  const hits = tokensB.filter((t) => {
    if (tokensA.has(t)) return true
    for (const ta of tokensA) {
      if (ta.includes(t) || t.includes(ta)) return true
    }
    return false
  }).length

  let score = Math.round((hits / tokensB.length) * 70)

  const thickA = a.match(/\b(6|15|18|25)\b/)
  const thickB = b.match(/\b(6|15|18|25)\b/)
  if (thickA && thickB && thickA[1] === thickB[1]) score += 12

  const families = ['branco', 'tx', 'freijo', 'toronto', 'corten', 'carvalho', 'amadeirado', 'mdf']
  for (const f of families) {
    if (a.includes(f) && b.includes(f)) score += 6
  }

  return Math.min(100, score)
}

function pickInventoryUnitPrice(row: {
  unit?: string | null
  unit_price?: number | null
  price_per_m2?: number | null
  price_per_sheet?: number | null
  category?: string | null
}): number {
  const unit = (row.unit || '').toLowerCase()
  const category = (row.category || '').toLowerCase()
  if (category === 'chapa' || unit === 'chapa') {
    return (
      Number(row.price_per_sheet) ||
      Number(row.unit_price) ||
      Number(row.price_per_m2) ||
      0
    )
  }
  if (category === 'fita_borda' || unit === 'm') {
    return Number(row.unit_price) || Number(row.price_per_m2) || 0
  }
  return Number(row.unit_price) || Number(row.price_per_sheet) || Number(row.price_per_m2) || 0
}

function inferContingency(
  rawName: string,
  preferredCategory?: MaterialCategory | string,
): { unitPrice: number; unit: string; matchedName: string } {
  const n = normalizeName(rawName)
  const cat = (preferredCategory || '').toLowerCase()

  if (n.includes('tampinha') || n.includes('tampa lateral')) {
    const c = CONTINGENCY_PRICES.tampinha
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  if (
    n.includes('quartzo') ||
    n.includes('silestone') ||
    n.includes('dekton') ||
    n.includes('compac')
  ) {
    const c = CONTINGENCY_PRICES.pedra_quartzo
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  if (
    n.includes('granito') ||
    n.includes('marmore') ||
    n.includes('porcelanato') ||
    n.includes('pedra')
  ) {
    const c = CONTINGENCY_PRICES.pedra_granito
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  if (n.includes('cola') || n.includes('adesivo') || n.includes('pva') || n.includes('contato')) {
    const c = CONTINGENCY_PRICES.cola
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  if (
    n.includes('parafuso') ||
    n.includes('prego') ||
    n.includes('confirmat') ||
    n.includes('europarafuso')
  ) {
    const c = CONTINGENCY_PRICES.parafuso
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  if (
    n.includes('minifix') ||
    n.includes('vb35') ||
    n.includes('cavilha') ||
    n.includes('excentrico') ||
    n.includes('conector')
  ) {
    const c = CONTINGENCY_PRICES.minifix
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  if (cat === 'fita_borda' || n.includes('fita') || n.includes('borda')) {
    const c = CONTINGENCY_PRICES.fita_borda_m
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  if (
    cat === 'puxador' ||
    n.includes('puxador') ||
    n.includes('perfil') ||
    (n.includes('barra') && n.includes('3'))
  ) {
    const c = CONTINGENCY_PRICES.puxador_barra_3m
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  if (n.includes('dobradica') || n.includes('soft close') || n.includes('amortecedor')) {
    const c = CONTINGENCY_PRICES.dobradica
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  if (n.includes('corredica') || n.includes('telescop') || n.includes('oculta')) {
    const c = CONTINGENCY_PRICES.corredica
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  const isChapa =
    cat === 'chapa' ||
    n.includes('mdf') ||
    n.includes('chapa') ||
    n.includes('compesado') ||
    n.includes('compensado') ||
    n.includes('osb')
  if (isChapa) {
    if (/\b6\b/.test(n) || n.includes('fundo')) {
      const c = CONTINGENCY_PRICES.chapa_mdf_6mm
      return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
    }
    if (/\b18\b/.test(n) || /\b25\b/.test(n)) {
      const c = CONTINGENCY_PRICES.chapa_mdf_18mm
      return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
    }
    const amadeirado =
      n.includes('freijo') ||
      n.includes('toronto') ||
      n.includes('carvalho') ||
      n.includes('madeira') ||
      n.includes('amadeir') ||
      n.includes('corten') ||
      n.includes('nogueira')
    const c = amadeirado
      ? CONTINGENCY_PRICES.chapa_mdf_15mm_amadeirado
      : CONTINGENCY_PRICES.chapa_mdf_15mm_branco
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  if (cat === 'ferragem' || cat === 'consumivel') {
    const c = CONTINGENCY_PRICES.ferragem_generica
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  if (cat === 'servico' || cat === 'mao_obra') {
    const c = CONTINGENCY_PRICES.servico_generico
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
  }

  const c = CONTINGENCY_PRICES.outro
  return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label }
}

function contingencyResult(
  rawName: string,
  preferredCategory?: MaterialCategory | string,
): ResolvedMaterialPrice {
  const c = inferContingency(rawName, preferredCategory)
  return {
    unitPrice: c.unitPrice,
    unit: c.unit,
    usingMarketPrice: true,
    inventoryItemId: null,
    matchedName: c.matchedName,
    source: 'contingency',
    warning: CONTINGENCY_PRICE_WARNING,
  }
}

type InventoryRow = {
  id: string
  name: string
  category: string
  unit: string
  unit_price: number | null
  price_per_m2: number | null
  price_per_sheet: number | null
  company_id: string | null
  active: boolean
}

type MarketRow = {
  id: string
  category: string
  item_pattern: string
  unit: string
  estimated_market_price: number
}

async function fetchInventoryCandidates(
  companyId: string,
  preferredCategory?: MaterialCategory | string,
): Promise<InventoryRow[]> {
  let query = supabase
    .from('inventory_items')
    .select(
      'id, name, category, unit, unit_price, price_per_m2, price_per_sheet, company_id, active',
    )
    .eq('active', true)
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .limit(200)

  if (preferredCategory) {
    query = query.eq('category', preferredCategory)
  }

  const { data, error } = await query
  if (error) {
    console.warn('[resolveMaterialPrice] inventory_items:', error.message)
    return []
  }
  return (data ?? []) as InventoryRow[]
}

async function fetchMarketCandidates(
  preferredCategory?: MaterialCategory | string,
): Promise<MarketRow[]> {
  let query = supabase
    .from('market_reference_prices')
    .select('id, category, item_pattern, unit, estimated_market_price')
    .limit(200)

  if (preferredCategory) {
    query = query.eq('category', preferredCategory)
  }

  const { data, error } = await query
  if (error) {
    console.warn('[resolveMaterialPrice] market_reference_prices:', error.message)
    return []
  }
  return (data ?? []) as MarketRow[]
}

function bestScored<T>(
  rows: T[],
  query: string,
  getName: (row: T) => string,
  minScore: number,
): { score: number; row: T } | null {
  let best: { score: number; row: T } | null = null
  for (const row of rows) {
    const score = scoreMatch(getName(row), query)
    if (score < minScore) continue
    if (!best || score > best.score) best = { score, row }
  }
  return best
}

async function fetchAliasMatch(
  companyId: string,
  rawName: string,
): Promise<InventoryRow | null> {
  const normalized = normalizeName(rawName)
  if (!normalized || !companyId) return null

  const { data: aliasRows, error: aliasError } = await supabase
    .from('inventory_aliases')
    .select('inventory_item_id, alias_normalized')
    .eq('company_id', companyId)
    .limit(300)

  if (aliasError) {
    console.warn('[resolveMaterialPrice] inventory_aliases:', aliasError.message)
    return null
  }

  const aliases = (aliasRows ?? []) as Array<{
    inventory_item_id: string
    alias_normalized: string
  }>
  if (!aliases.length) return null

  let best: { score: number; itemId: string } | null = null
  for (const a of aliases) {
    const score = scoreMatch(a.alias_normalized, normalized)
    if (score < 55) continue
    if (!best || score > best.score) best = { score, itemId: a.inventory_item_id }
  }
  if (!best) return null

  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .select(
      'id, name, category, unit, unit_price, price_per_m2, price_per_sheet, company_id, active',
    )
    .eq('id', best.itemId)
    .maybeSingle()

  if (itemError || !item || item.active === false) return null
  return item as InventoryRow
}

/**
 * Resolve preço do insumo (NUNCA retorna 0):
 * 1) apelido De-Para (`inventory_aliases`) → item do estoque
 * 2) fuzzy em `inventory_items` (empresa + global)
 * 3) fuzzy em `market_reference_prices`
 * 4) contingência por família/categoria → using_market_price = true
 */
export async function resolveMaterialPrice(
  companyId: string,
  rawMaterialName: string,
  preferredCategory?: MaterialCategory | string,
): Promise<ResolvedMaterialPrice> {
  const name = rawMaterialName.trim()
  if (!name) {
    return contingencyResult('Insumo sem nome', preferredCategory || 'outro')
  }

  // 1) Apelido De-Para
  const aliasItem = await fetchAliasMatch(companyId, name)
  if (aliasItem) {
    const unitPrice = pickInventoryUnitPrice(aliasItem)
    if (unitPrice > 0) {
      return {
        unitPrice,
        unit: aliasItem.unit || 'un',
        usingMarketPrice: false,
        inventoryItemId: aliasItem.id,
        matchedName: aliasItem.name,
        source: 'inventory',
        warning: null,
      }
    }
  }

  // 2) Estoque — com categoria preferida; se fraco, tenta sem filtro
  let inventoryRows = await fetchInventoryCandidates(companyId, preferredCategory)
  let bestInv = bestScored(inventoryRows, name, (r) => r.name, 28)
  if (!bestInv && preferredCategory) {
    inventoryRows = await fetchInventoryCandidates(companyId)
    bestInv = bestScored(inventoryRows, name, (r) => r.name, 28)
  }

  if (bestInv) {
    const unitPrice = pickInventoryUnitPrice(bestInv.row)
    if (unitPrice > 0) {
      return {
        unitPrice,
        unit: bestInv.row.unit || 'un',
        usingMarketPrice: false,
        inventoryItemId: bestInv.row.id,
        matchedName: bestInv.row.name,
        source: 'inventory',
        warning: null,
      }
    }
  }

  // 3) Mercado
  let marketRows = await fetchMarketCandidates(preferredCategory)
  let bestMarket = bestScored(marketRows, name, (r) => r.item_pattern, 28)
  if (!bestMarket && preferredCategory) {
    marketRows = await fetchMarketCandidates()
    bestMarket = bestScored(marketRows, name, (r) => r.item_pattern, 28)
  }

  if (bestMarket) {
    const unitPrice = Number(bestMarket.row.estimated_market_price) || 0
    if (unitPrice > 0) {
      return {
        unitPrice,
        unit: bestMarket.row.unit || 'un',
        usingMarketPrice: true,
        inventoryItemId: null,
        matchedName: bestMarket.row.item_pattern,
        source: 'market',
        warning: 'Preço de referência de mercado — confirme ou informe o custo real.',
      }
    }
  }

  // 4) Contingência obrigatória (preços diferenciados por família)
  return contingencyResult(name, preferredCategory)
}

/**
 * Reaplica `resolveMaterialPrice` em materiais com preço ≤ 0
 * (orçamentos COMPLETED antigos / reabertura).
 */
export async function repriceZeroMaterials(params: {
  companyId: string
  materials: QuoteMaterialRow[]
}): Promise<{ updated: number; materials: QuoteMaterialRow[]; error?: string }> {
  const zeros = params.materials.filter((m) => !(Number(m.unit_price) > 0))
  if (!zeros.length) {
    return { updated: 0, materials: params.materials }
  }

  const next = params.materials.map((m) => ({ ...m }))
  let updated = 0

  for (const mat of zeros) {
    const priceName = mat.raw_name.includes('—')
      ? mat.raw_name.split('—').pop()?.trim() || mat.raw_name
      : mat.raw_name
    const price = await resolveMaterialPrice(params.companyId, priceName, mat.category)
    const notesExtra =
      price.source === 'contingency'
        ? CONTINGENCY_PRICE_WARNING
        : price.warning
    const notes = [mat.notes, notesExtra].filter(Boolean).join(' · ')

    const { error } = await supabase
      .from('quote_materials')
      .update({
        unit_price: price.unitPrice,
        unit_measure: mat.unit_measure || price.unit,
        system_material_id: price.inventoryItemId,
        using_market_price: price.usingMarketPrice,
        market_price_confirmed: false,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mat.id)

    if (error) {
      return { updated, materials: next, error: error.message }
    }

    const idx = next.findIndex((m) => m.id === mat.id)
    if (idx >= 0) {
      next[idx] = {
        ...next[idx],
        unit_price: price.unitPrice,
        unit_measure: mat.unit_measure || price.unit,
        system_material_id: price.inventoryItemId,
        using_market_price: price.usingMarketPrice,
        market_price_confirmed: false,
        notes,
      }
    }
    updated += 1
  }

  return { updated, materials: next }
}

/** Barras de 3 m: arredonda metros lineares para cima em barras inteiras. */
export function barsOf3mFromMeters(meters: number): number {
  if (meters <= 0) return 0
  return Math.ceil(meters / 3)
}

/** Tampinhas laterais: 2 por barra de puxador perfil (padrão Planilha 4.0). */
export function endCapsForHandleBars(bars: number): number {
  return Math.max(0, bars) * 2
}

// ---------------------------------------------------------------------------
// Fase 6 — Motor MPC (3 modalidades) + Lista de Compras
// ---------------------------------------------------------------------------

export type PricingModality = 'mpc_margin' | 'material_multiplier' | 'per_sqm'

export const PRICING_MODALITY_LABEL: Record<PricingModality, string> = {
  mpc_margin: 'Margem MPC %',
  material_multiplier: 'Material × N',
  per_sqm: 'R$/m²',
}

/** Chapa padrão Planilha 4.0: 2,75 m × 1,85 m. */
export const STANDARD_SHEET_WIDTH_M = 2.75
export const STANDARD_SHEET_HEIGHT_M = 1.85
export const STANDARD_SHEET_AREA_M2 = STANDARD_SHEET_WIDTH_M * STANDARD_SHEET_HEIGHT_M

export const DEFAULT_SHEET_LOSS_PCT = 15

export interface PricingParams {
  modality: PricingModality
  /** Modalidade 1: % total (impostos + comissões + cartão + lucro), ex.: 45 */
  mpcPercent: number
  /** Modalidade 2: fator N, ex.: 2.0 ou 2.8 */
  materialMultiplier: number
  /** Modalidade 3: R$/m² configurado */
  pricePerSqm: number
  /** Área total do móvel/ambiente em m² (quando não derivável dos módulos) */
  totalAreaSqm?: number
  /** Taxa de perda de chapa (%), padrão 15 */
  sheetLossPct?: number
}

export const DEFAULT_PRICING_PARAMS: PricingParams = {
  modality: 'mpc_margin',
  mpcPercent: 45,
  materialMultiplier: 2.5,
  pricePerSqm: 2500,
  sheetLossPct: DEFAULT_SHEET_LOSS_PCT,
}

export interface PricingResult {
  modality: PricingModality
  materialsCost: number
  salePrice: number
  totalAreaSqm: number
  formulaLabel: string
}

export interface ShoppingListItem {
  key: string
  category: 'chapa' | 'fita_borda' | 'puxador' | 'ferragem' | 'outro'
  name: string
  exactQuantity: number
  exactUnit: string
  purchaseQuantity: number
  purchaseUnit: string
  unitPrice: number
  lineTotal: number
  notes: string
}

function flattenMaterials(tree: QuoteAnalysisDetail): QuoteMaterialRow[] {
  return tree.environments.flatMap((e) => e.modules.flatMap((m) => m.materials))
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Soma custo dos insumos. */
export function sumMaterialsCost(materials: QuoteMaterialRow[]): number {
  return materials.reduce((acc, m) => {
    const qty =
      m.unit_measure === 'chapa' || m.unit_measure === 'barra'
        ? Number(m.full_units_quantity) || Number(m.exact_quantity) || 0
        : Number(m.exact_quantity) || 0
    return acc + qty * (Number(m.unit_price) || 0)
  }, 0)
}

/**
 * Área total em m² a partir das dimensões dos módulos (L×A em mm)
 * ou peças de caixaria nas notes.
 */
export function estimateTotalAreaSqm(
  tree: QuoteAnalysisDetail,
  overrideSqm?: number,
): number {
  if (typeof overrideSqm === 'number' && overrideSqm > 0) return overrideSqm
  let area = 0
  for (const env of tree.environments) {
    for (const mod of env.modules) {
      const d = mod.dimensions ?? {}
      const w = Number(d.width_mm) || 0
      const h = Number(d.height_mm) || 0
      if (w > 0 && h > 0) {
        area += (w / 1000) * (h / 1000)
        continue
      }
      for (const mat of mod.materials) {
        if (mat.category !== 'chapa') continue
        const match = mat.notes?.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x/i)
        if (match) {
          const mw = Number(match[1])
          const mh = Number(match[2])
          if (mw > 0 && mh > 0) {
            area += (mw / 1000) * (mh / 1000) * (Number(mat.exact_quantity) || 1)
          }
        }
      }
    }
  }
  return Math.round(area * 1000) / 1000
}

/**
 * Modalidade 1 — Margem MPC %: Preço = Custo / (1 − %MPC/100)
 * Modalidade 2 — Multiplicador: Preço = Custo × N
 * Modalidade 3 — R$/m²: Preço = Área(m²) × valor/m²
 */
export function calculateSalePrice(
  materialsCost: number,
  params: PricingParams,
  totalAreaSqm: number,
): PricingResult {
  const cost = Math.max(0, materialsCost)
  const area = Math.max(0, totalAreaSqm)

  if (params.modality === 'mpc_margin') {
    const pct = Math.min(95, Math.max(0, params.mpcPercent))
    const denom = 1 - pct / 100
    const salePrice = denom > 0 ? cost / denom : cost
    return {
      modality: 'mpc_margin',
      materialsCost: cost,
      salePrice: roundMoney(salePrice),
      totalAreaSqm: area,
      formulaLabel: `Custo ÷ (1 − ${pct}%)`,
    }
  }

  if (params.modality === 'material_multiplier') {
    const n = Math.max(0, params.materialMultiplier)
    return {
      modality: 'material_multiplier',
      materialsCost: cost,
      salePrice: roundMoney(cost * n),
      totalAreaSqm: area,
      formulaLabel: `Custo × ${n}`,
    }
  }

  return {
    modality: 'per_sqm',
    materialsCost: cost,
    salePrice: roundMoney(area * Math.max(0, params.pricePerSqm)),
    totalAreaSqm: area,
    formulaLabel: `${area.toFixed(2)} m² × R$ ${params.pricePerSqm.toFixed(0)}`,
  }
}

export function calculateQuotePricing(
  tree: QuoteAnalysisDetail,
  params: PricingParams = DEFAULT_PRICING_PARAMS,
): PricingResult {
  const materials = flattenMaterials(tree)
  const cost = sumMaterialsCost(materials)
  const area = estimateTotalAreaSqm(tree, params.totalAreaSqm)
  return calculateSalePrice(cost, params, area)
}

/** m² exato → chapas inteiras com perda %. */
export function sheetsFromAreaM2(
  areaM2: number,
  lossPct = DEFAULT_SHEET_LOSS_PCT,
  sheetAreaM2 = STANDARD_SHEET_AREA_M2,
): number {
  if (areaM2 <= 0) return 0
  const withLoss = areaM2 * (1 + Math.max(0, lossPct) / 100)
  return Math.ceil(withLoss / sheetAreaM2)
}

/** Metros de fita → rolos 20/50/100 m. */
export function rollsForEdgeTapeMeters(meters: number): {
  rolls: Partial<Record<20 | 50 | 100, number>>
  totalMetersPurchased: number
} {
  if (meters <= 0) return { rolls: {}, totalMetersPurchased: 0 }
  let remaining = Math.ceil(meters)
  const rolls: Partial<Record<20 | 50 | 100, number>> = {}
  for (const size of [100, 50, 20] as const) {
    const n = Math.floor(remaining / size)
    if (n > 0) {
      rolls[size] = n
      remaining -= n * size
    }
  }
  if (remaining > 0) {
    rolls[20] = (rolls[20] ?? 0) + 1
  }
  const totalMetersPurchased =
    (rolls[100] ?? 0) * 100 + (rolls[50] ?? 0) * 50 + (rolls[20] ?? 0) * 20
  return { rolls, totalMetersPurchased }
}

function isHandleProfile(mat: QuoteMaterialRow): boolean {
  if (mat.category !== 'puxador') return false
  const n = normalizeName(mat.raw_name)
  return (
    mat.unit_measure === 'barra' ||
    mat.unit_measure === 'm' ||
    n.includes('perfil') ||
    n.includes('regua') ||
    n.includes('barra')
  )
}

function isEndCap(mat: QuoteMaterialRow): boolean {
  const n = normalizeName(mat.raw_name)
  return n.includes('tampinha')
}

/**
 * Lista de Compras Inteira (Planilha 4.0):
 * chapas 2,75×1,85 + perda; fitas em rolos; puxadores 3 m + tampinhas.
 */
export function buildShoppingList(
  tree: QuoteAnalysisDetail,
  options?: { sheetLossPct?: number },
): ShoppingListItem[] {
  const lossPct = options?.sheetLossPct ?? DEFAULT_SHEET_LOSS_PCT
  const materials = flattenMaterials(tree)
  const items: ShoppingListItem[] = []

  const chapaMap = new Map<string, { m2: number; unitPrice: number; countAsSheet: number }>()
  const fitaMap = new Map<string, { meters: number; unitPrice: number }>()
  const handleMeters = new Map<
    string,
    { metersOrBars: number; asBars: boolean; unitPrice: number }
  >()
  let endCapPrice = 0

  for (const mat of materials) {
    if (mat.category === 'chapa') {
      const key = mat.raw_name
      const entry = chapaMap.get(key) ?? {
        m2: 0,
        unitPrice: Number(mat.unit_price) || 0,
        countAsSheet: 0,
      }
      if (mat.unit_measure === 'chapa' || mat.unit_measure === 'un') {
        entry.countAsSheet += Number(mat.full_units_quantity) || Number(mat.exact_quantity) || 0
      } else if (mat.unit_measure === 'm2' || mat.unit_measure === 'm²') {
        entry.m2 += Number(mat.exact_quantity) || 0
      } else {
        const match = mat.notes?.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/i)
        if (match) {
          entry.m2 +=
            (Number(match[1]) / 1000) *
            (Number(match[2]) / 1000) *
            (Number(mat.exact_quantity) || 1)
        } else {
          entry.countAsSheet +=
            Number(mat.full_units_quantity) || Math.ceil(Number(mat.exact_quantity) || 0)
        }
      }
      if (entry.unitPrice <= 0) entry.unitPrice = Number(mat.unit_price) || 0
      chapaMap.set(key, entry)
      continue
    }

    if (mat.category === 'fita_borda') {
      const key = mat.raw_name
      const entry = fitaMap.get(key) ?? { meters: 0, unitPrice: Number(mat.unit_price) || 0 }
      entry.meters += Number(mat.exact_quantity) || 0
      if (entry.unitPrice <= 0) entry.unitPrice = Number(mat.unit_price) || 0
      fitaMap.set(key, entry)
      continue
    }

    if (isEndCap(mat)) {
      endCapPrice = Number(mat.unit_price) || endCapPrice
      continue
    }

    if (isHandleProfile(mat)) {
      const key = mat.raw_name
      const entry = handleMeters.get(key) ?? {
        metersOrBars: 0,
        asBars: mat.unit_measure === 'barra',
        unitPrice: Number(mat.unit_price) || 0,
      }
      if (mat.unit_measure === 'barra') {
        entry.asBars = true
        entry.metersOrBars += Number(mat.full_units_quantity) || Number(mat.exact_quantity) || 0
      } else {
        entry.metersOrBars += Number(mat.exact_quantity) || 0
      }
      if (entry.unitPrice <= 0) entry.unitPrice = Number(mat.unit_price) || 0
      handleMeters.set(key, entry)
      continue
    }

    const qty = Math.ceil(Number(mat.full_units_quantity) || Number(mat.exact_quantity) || 0)
    items.push({
      key: `un-${mat.id}`,
      category: mat.category === 'ferragem' ? 'ferragem' : 'outro',
      name: mat.raw_name,
      exactQuantity: Number(mat.exact_quantity) || 0,
      exactUnit: 'un',
      purchaseQuantity: qty,
      purchaseUnit: 'un',
      unitPrice: Number(mat.unit_price) || 0,
      lineTotal: roundMoney(qty * (Number(mat.unit_price) || 0)),
      notes: 'Unidade individual',
    })
  }

  for (const [name, entry] of chapaMap) {
    const fromArea = sheetsFromAreaM2(entry.m2, lossPct)
    const purchase = Math.max(fromArea, Math.ceil(entry.countAsSheet))
    items.push({
      key: `chapa-${name}`,
      category: 'chapa',
      name,
      exactQuantity: Math.round(entry.m2 * 1000) / 1000 || entry.countAsSheet,
      exactUnit: entry.m2 > 0 ? 'm²' : 'un',
      purchaseQuantity: purchase,
      purchaseUnit: 'chapa',
      unitPrice: entry.unitPrice,
      lineTotal: roundMoney(purchase * entry.unitPrice),
      notes: `Chapa ${STANDARD_SHEET_WIDTH_M}×${STANDARD_SHEET_HEIGHT_M} m · perda ${lossPct}%`,
    })
  }

  for (const [name, entry] of fitaMap) {
    const { rolls, totalMetersPurchased } = rollsForEdgeTapeMeters(entry.meters)
    const rollDesc = ([100, 50, 20] as const)
      .filter((s) => rolls[s])
      .map((s) => `${rolls[s]}×${s}m`)
      .join(' + ')
    items.push({
      key: `fita-${name}`,
      category: 'fita_borda',
      name,
      exactQuantity: Math.round(entry.meters * 100) / 100,
      exactUnit: 'm',
      purchaseQuantity: totalMetersPurchased,
      purchaseUnit: 'm (rolos)',
      unitPrice: entry.unitPrice,
      lineTotal: roundMoney(totalMetersPurchased * entry.unitPrice),
      notes: rollDesc || '—',
    })
  }

  for (const [name, entry] of handleMeters) {
    const bars = entry.asBars
      ? Math.ceil(entry.metersOrBars)
      : barsOf3mFromMeters(entry.metersOrBars)
    const caps = endCapsForHandleBars(bars)
    items.push({
      key: `pux-${name}`,
      category: 'puxador',
      name,
      exactQuantity: entry.metersOrBars,
      exactUnit: entry.asBars ? 'barra' : 'm',
      purchaseQuantity: bars,
      purchaseUnit: 'barra 3m',
      unitPrice: entry.unitPrice,
      lineTotal: roundMoney(bars * entry.unitPrice),
      notes: `${bars} barra(s) de 3 m`,
    })
    items.push({
      key: `tamp-${name}`,
      category: 'puxador',
      name: 'Tampinha lateral puxador perfil',
      exactQuantity: caps,
      exactUnit: 'un',
      purchaseQuantity: caps,
      purchaseUnit: 'un',
      unitPrice: endCapPrice,
      lineTotal: roundMoney(caps * endCapPrice),
      notes: `2 tampinhas por barra (${bars} barras)`,
    })
  }

  return items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
