import { supabase } from '@/lib/supabase'
import type { MaterialCategory } from '@/lib/orcamentos-ia/schemas'
import type { QuoteAnalysisDetail, QuoteMaterialRow } from '@/lib/orcamentos-ia/quote-tree'

/**
 * Aviso gravado em `notes` quando o material não está no estoque nem na tabela de mercado
 * e o preço veio da tabela padrão (preço médio por tipo de material).
 */
export const CONTINGENCY_PRICE_WARNING =
  'Preço médio sugerido (material não encontrado no estoque) — confira'

/** Reconhece o aviso atual e o texto antigo ("tabela padrão de contingência"). */
export function isSuggestedPriceNote(notes: string | null | undefined): boolean {
  const n = notes ?? ''
  return (
    n.includes(CONTINGENCY_PRICE_WARNING) ||
    n.includes('tabela padrão de contingência') ||
    n.includes('contingência=')
  )
}

export interface ResolvedMaterialPrice {
  unitPrice: number
  unit: string
  usingMarketPrice: boolean
  inventoryItemId: string | null
  matchedName: string
  source: 'inventory' | 'market' | 'contingency'
  /** Aviso exibido na UI quando o preço não veio do estoque cadastrado. */
  warning: string | null
  /** Preço por m² (chapas): `price_per_m2` ou preço da chapa ÷ área padrão. */
  pricePerM2: number | null
  /** Chave de `CONTINGENCY_PRICES` usada (auditoria). */
  contingencyKey: ContingencyKey | null
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
  pe_mesa: { unitPrice: 60, unit: 'un', label: 'Pé de mesa metálico (un)' },
  passa_cabo: { unitPrice: 12, unit: 'un', label: 'Passa-cabo (un)' },
  cantoneira: { unitPrice: 2.5, unit: 'un', label: 'Cantoneira / suporte (un)' },
  puxador_barra_3m: { unitPrice: 85, unit: 'barra', label: 'Puxador Perfil (barra 3m)' },
  tampinha: { unitPrice: 1.5, unit: 'un', label: 'Tampinha lateral puxador' },
  cola: { unitPrice: 35, unit: 'un', label: 'Cola / adesivo' },
  parafuso: { unitPrice: 0.35, unit: 'un', label: 'Parafuso / prego (un)' },
  minifix: { unitPrice: 1.2, unit: 'un', label: 'Minifix / conectores' },
  ferragem_generica: { unitPrice: 8, unit: 'un', label: 'Ferragem / acessório genérico' },
  servico_generico: { unitPrice: 80, unit: 'un', label: 'Serviço / mão de obra genérico' },
  outro: { unitPrice: 25, unit: 'un', label: 'Insumo genérico (contingência)' },
} as const

export type ContingencyKey = keyof typeof CONTINGENCY_PRICES

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

/**
 * Palavras de família/tipo: presentes em quase todo item da categoria, não identificam
 * o material ("Fita Amendoeira" ≠ "Fita de Borda Branco TX").
 */
const GENERIC_TOKENS = new Set([
  'fita', 'borda', 'mdf', 'mdp', 'chapa', 'painel', 'ferragem', 'puxador', 'perfil',
  'tx', 'arauco', 'duratex', 'guararapes', 'eucatex', 'berneck', 'mm', 'metro',
])

/** Tokens úteis para fuzzy (remove palavras muito curtas e genéricas). */
function significantTokens(value: string): string[] {
  const stop = new Set(['de', 'da', 'do', 'com', 'para', 'em', 'mm', 'cm', 'un', 'und'])
  return normalizeName(value)
    .split(' ')
    .filter((t) => t.length >= 2 && !stop.has(t))
}

/** Tokens que identificam o material (cor/padrão/modelo), sem família nem números. */
function identityTokens(value: string): string[] {
  return significantTokens(value).filter((t) => !GENERIC_TOKENS.has(t) && !/^\d+$/.test(t))
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

  // Precisa casar ao menos uma palavra de identidade (cor/padrão/modelo) quando a busca tem
  const idQuery = identityTokens(query)
  const idCandidate = identityTokens(candidate)
  if (idQuery.length && idCandidate.length) {
    const sharesIdentity = idQuery.some((t) =>
      idCandidate.some((c) => c === t || (t.length >= 4 && (c.includes(t) || t.includes(c)))),
    )
    if (!sharesIdentity) return 0
  }

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
): { unitPrice: number; unit: string; matchedName: string; key: ContingencyKey } {
  const n = normalizeName(rawName)
  const pick = (key: ContingencyKey) => {
    const c = CONTINGENCY_PRICES[key]
    return { unitPrice: c.unitPrice, unit: c.unit, matchedName: c.label, key }
  }
  const cat = (preferredCategory || '').toLowerCase()

  if (n.includes('tampinha') || n.includes('tampa lateral')) {
    return pick('tampinha')
  }

  if (
    n.includes('quartzo') ||
    n.includes('silestone') ||
    n.includes('dekton') ||
    n.includes('compac')
  ) {
    return pick('pedra_quartzo')
  }

  if (
    n.includes('granito') ||
    n.includes('marmore') ||
    n.includes('porcelanato') ||
    n.includes('pedra')
  ) {
    return pick('pedra_granito')
  }

  if (n.includes('cola') || n.includes('adesivo') || n.includes('pva') || n.includes('contato')) {
    return pick('cola')
  }

  if (
    n.includes('parafuso') ||
    n.includes('prego') ||
    n.includes('confirmat') ||
    n.includes('europarafuso')
  ) {
    return pick('parafuso')
  }

  if (
    n.includes('minifix') ||
    n.includes('vb35') ||
    n.includes('cavilha') ||
    n.includes('excentrico') ||
    n.includes('conector')
  ) {
    return pick('minifix')
  }

  if (cat === 'fita_borda' || n.includes('fita') || n.includes('borda')) {
    return pick('fita_borda_m')
  }

  if (
    cat === 'puxador' ||
    n.includes('puxador') ||
    n.includes('perfil') ||
    (n.includes('barra') && n.includes('3'))
  ) {
    return pick('puxador_barra_3m')
  }

  if (n.includes('pe de mesa') || n.includes('pes de mesa') || /\bpes?\b.*\b(metal|ferro|aco)\b/.test(n)) {
    return pick('pe_mesa')
  }

  if (n.includes('passa cabo') || n.includes('passacabo')) {
    return pick('passa_cabo')
  }

  if (n.includes('cantoneira') || n.includes('suporte prateleira') || n.includes('pino prateleira')) {
    return pick('cantoneira')
  }

  if (n.includes('dobradica') || n.includes('soft close') || n.includes('amortecedor')) {
    return pick('dobradica')
  }

  if (n.includes('corredica') || n.includes('telescop') || n.includes('oculta')) {
    return pick('corredica')
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
      return pick('chapa_mdf_6mm')
    }
    if (/\b18\b/.test(n) || /\b25\b/.test(n) || n.includes('engross')) {
      return pick('chapa_mdf_18mm')
    }
    const amadeirado =
      n.includes('freijo') ||
      n.includes('toronto') ||
      n.includes('carvalho') ||
      n.includes('madeira') ||
      n.includes('amadeir') ||
      n.includes('corten') ||
      n.includes('nogueira')
    return pick(amadeirado ? 'chapa_mdf_15mm_amadeirado' : 'chapa_mdf_15mm_branco')
  }

  if (cat === 'ferragem' || cat === 'consumivel') {
    return pick('ferragem_generica')
  }

  if (cat === 'servico' || cat === 'mao_obra') {
    return pick('servico_generico')
  }

  return pick('outro')
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
    pricePerM2: perM2FromUnit(c.unitPrice, c.unit),
    contingencyKey: c.key,
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

/** Converte preço em unidade de chapa/m² para R$/m²; demais unidades → null. */
function perM2FromUnit(unitPrice: number, unit: string | null | undefined): number | null {
  const u = (unit || '').toLowerCase()
  if (!(unitPrice > 0)) return null
  if (u === 'm2' || u === 'm²') return unitPrice
  if (u === 'chapa') return roundMoney(unitPrice / STANDARD_SHEET_AREA_M2)
  return null
}

function inventoryPerM2(row: InventoryRow): number | null {
  const direct = Number(row.price_per_m2)
  if (direct > 0) return direct
  const isChapa = row.category === 'chapa' || (row.unit || '').toLowerCase() === 'chapa'
  if (!isChapa) return perM2FromUnit(pickInventoryUnitPrice(row), row.unit)
  const sheet = Number(row.price_per_sheet) || Number(row.unit_price) || 0
  return sheet > 0 ? roundMoney(sheet / STANDARD_SHEET_AREA_M2) : null
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

export interface PriceResolver {
  resolve(rawMaterialName: string, preferredCategory?: MaterialCategory | string): ResolvedMaterialPrice
}

/**
 * Carrega estoque, mercado e apelidos UMA vez e resolve preços em memória
 * (evita 2–5 queries por insumo em PDFs longos).
 *
 * Ordem (NUNCA retorna 0):
 * 1) apelido De-Para (`inventory_aliases`) → item do estoque
 * 2) fuzzy em `inventory_items` (empresa + global)
 * 3) fuzzy em `market_reference_prices`
 * 4) contingência por família/categoria → using_market_price = true
 */
export async function createPriceResolver(companyId: string): Promise<PriceResolver> {
  const [invRes, marketRes, aliasRes] = await Promise.all([
    supabase
      .from('inventory_items')
      .select(
        'id, name, category, unit, unit_price, price_per_m2, price_per_sheet, company_id, active',
      )
      .eq('active', true)
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .limit(2000),
    supabase
      .from('market_reference_prices')
      .select('id, category, item_pattern, unit, estimated_market_price')
      .limit(2000),
    supabase
      .from('inventory_aliases')
      .select('inventory_item_id, alias_normalized')
      .eq('company_id', companyId)
      .limit(2000),
  ])
  if (invRes.error) console.warn('[priceResolver] inventory_items:', invRes.error.message)
  if (marketRes.error) {
    console.warn('[priceResolver] market_reference_prices:', marketRes.error.message)
  }
  if (aliasRes.error) console.warn('[priceResolver] inventory_aliases:', aliasRes.error.message)

  const inventory = (invRes.data ?? []) as InventoryRow[]
  const market = (marketRes.data ?? []) as MarketRow[]
  const aliases = (aliasRes.data ?? []) as Array<{
    inventory_item_id: string
    alias_normalized: string
  }>
  const inventoryById = new Map(inventory.map((r) => [r.id, r]))

  const fromInventory = (row: InventoryRow): ResolvedMaterialPrice | null => {
    const unitPrice = pickInventoryUnitPrice(row)
    if (!(unitPrice > 0)) return null
    return {
      unitPrice,
      unit: row.unit || 'un',
      usingMarketPrice: false,
      inventoryItemId: row.id,
      matchedName: row.name,
      source: 'inventory',
      warning: null,
      pricePerM2: inventoryPerM2(row),
      contingencyKey: null,
    }
  }

  const resolve = (
    rawMaterialName: string,
    preferredCategory?: MaterialCategory | string,
  ): ResolvedMaterialPrice => {
    const name = rawMaterialName.trim()
    if (!name) return contingencyResult('Insumo sem nome', preferredCategory || 'outro')

    // 1) Apelido De-Para
    const normalized = normalizeName(name)
    const alias = bestScored(aliases, normalized, (a) => a.alias_normalized, 55)
    const aliasItem = alias ? inventoryById.get(alias.row.inventory_item_id) : undefined
    const aliasPrice = aliasItem ? fromInventory(aliasItem) : null
    if (aliasPrice) return aliasPrice

    // 2) Estoque — categoria preferida; se fraco, todas
    const invByCat = preferredCategory
      ? inventory.filter((r) => r.category === preferredCategory)
      : inventory
    // Outra categoria só com casamento forte ("Pé Metal Preto" ≠ "Puxador Perfil Preto")
    const bestInv =
      bestScored(invByCat, name, (r) => r.name, 28) ??
      (preferredCategory ? bestScored(inventory, name, (r) => r.name, 75) : null)
    const invPrice = bestInv ? fromInventory(bestInv.row) : null
    if (invPrice) return invPrice

    // 3) Mercado
    const marketByCat = preferredCategory
      ? market.filter((r) => r.category === preferredCategory)
      : market
    const bestMarket =
      bestScored(marketByCat, name, (r) => r.item_pattern, 28) ??
      (preferredCategory ? bestScored(market, name, (r) => r.item_pattern, 75) : null)
    const marketPrice = Number(bestMarket?.row.estimated_market_price) || 0
    if (bestMarket && marketPrice > 0) {
      const unit = bestMarket.row.unit || 'un'
      return {
        unitPrice: marketPrice,
        unit,
        usingMarketPrice: true,
        inventoryItemId: null,
        matchedName: bestMarket.row.item_pattern,
        source: 'market',
        warning: 'Preço de referência de mercado — confirme ou informe o custo real.',
        pricePerM2: perM2FromUnit(marketPrice, unit),
        contingencyKey: null,
      }
    }

    // 4) Contingência obrigatória (preços diferenciados por família)
    return contingencyResult(name, preferredCategory)
  }

  return { resolve }
}

/** Resolve um único insumo. Para lotes, prefira `createPriceResolver`. */
export async function resolveMaterialPrice(
  companyId: string,
  rawMaterialName: string,
  preferredCategory?: MaterialCategory | string,
): Promise<ResolvedMaterialPrice> {
  const resolver = await createPriceResolver(companyId)
  return resolver.resolve(rawMaterialName, preferredCategory)
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
  const resolver = await createPriceResolver(params.companyId)

  for (const mat of zeros) {
    const priceName = mat.raw_name.includes('—')
      ? mat.raw_name.split('—').pop()?.trim() || mat.raw_name
      : mat.raw_name
    const resolved = resolver.resolve(priceName, mat.category)
    // Linhas de chapa em m² precisam de preço por m², não por chapa
    const isAreaRow = mat.unit_measure === 'm2' || mat.unit_measure === 'm²'
    const price =
      isAreaRow && resolved.pricePerM2
        ? { ...resolved, unitPrice: resolved.pricePerM2, unit: 'm2' }
        : resolved
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
  mpc_margin: 'Margem %',
  material_multiplier: 'Multiplicar custo',
  per_sqm: 'Preço por m²',
}

/** Explicação curta de cada forma de calcular o preço (tooltip). */
export const PRICING_MODALITY_HINT: Record<PricingModality, string> = {
  mpc_margin: 'Preço = custo dos materiais ÷ (1 − margem). Ex.: margem 45% sobre R$ 1.000 → R$ 1.818',
  material_multiplier: 'Preço = custo dos materiais × fator. Ex.: × 2,5 sobre R$ 1.000 → R$ 2.500',
  per_sqm: 'Preço = área total dos móveis (m²) × valor por m²',
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
  return tree.environments.flatMap((e) =>
    e.modules.filter((m) => !m.out_of_scope).flatMap((m) => m.materials),
  )
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function isAreaUnit(unit: string | null | undefined): boolean {
  return unit === 'm2' || unit === 'm²'
}

/**
 * Soma custo dos insumos.
 * Linhas em m² (chapas) recebem a perda de corte (%), como na Lista de Compras.
 */
export function sumMaterialsCost(
  materials: QuoteMaterialRow[],
  sheetLossPct = DEFAULT_SHEET_LOSS_PCT,
): number {
  return materials.reduce((acc, m) => acc + materialLineCost(m, sheetLossPct), 0)
}

/** Custo de uma linha de insumo (mesma regra do total do orçamento). */
export function materialLineCost(
  m: Pick<QuoteMaterialRow, 'unit_measure' | 'full_units_quantity' | 'exact_quantity' | 'unit_price'>,
  sheetLossPct = DEFAULT_SHEET_LOSS_PCT,
): number {
  const lossFactor = 1 + Math.max(0, sheetLossPct) / 100
  const qty =
    m.unit_measure === 'chapa' || m.unit_measure === 'barra'
      ? Number(m.full_units_quantity) || Number(m.exact_quantity) || 0
      : isAreaUnit(m.unit_measure)
        ? (Number(m.exact_quantity) || 0) * lossFactor
        : Number(m.exact_quantity) || 0
  return qty * (Number(m.unit_price) || 0)
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
      if (mod.out_of_scope) continue
      const d = mod.dimensions ?? {}
      const w = Number(d.width_mm) || 0
      const h = Number(d.height_mm) || 0
      // Medidas estimadas pelo tipo não entram no R$/m² — usa as peças
      if (w > 0 && h > 0 && d.estimated !== true) {
        area += (w / 1000) * (h / 1000)
        continue
      }
      for (const mat of mod.materials) {
        if (mat.category !== 'chapa') continue
        if (isAreaUnit(mat.unit_measure)) {
          area += Number(mat.exact_quantity) || 0
          continue
        }
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
  const cost = sumMaterialsCost(materials, params.sheetLossPct)
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
      // "Lateral — MDF Branco TX 15mm" → agrupa pelo material, não pela peça
      const key = mat.raw_name.includes('—')
        ? mat.raw_name.split('—').pop()?.trim() || mat.raw_name
        : mat.raw_name
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
