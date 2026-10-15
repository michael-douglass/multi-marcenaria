/**
 * Orquestra fusão incremental da Pasta de Precificação (quote_projects).
 * Lê last_extraction de cada lote, une módulos e grava snapshot em quote_projects.totals.
 */
import { consolidateExtractionForPricing } from '@/lib/orcamentos-ia/bom-consolidate'
import {
  countBillableModules,
  mergeProjectFolderExtractions,
} from '@/lib/orcamentos-ia/merge-extraction'
import { mergeBudgetedPages } from '@/lib/orcamentos-ia/page-ranges'
import {
  calculateSalePrice,
  DEFAULT_PRICING_PARAMS,
  normalizePricingModality,
  type PricingParams,
} from '@/lib/orcamentos-ia/pricing'
import type { QuoteExtraction } from '@/lib/orcamentos-ia/schemas'
import {
  deleteQuoteAnalysis,
  listQuoteAnalysesForProject,
  updateQuoteProjectBudgetedPages,
  updateQuoteProjectTotals,
  type QuoteAnalysisRow,
} from '@/lib/orcamentos-ia/storage'
import { normalizeSelectedPages } from '@/lib/orcamentos-ia/pdf-processor'

const FOLDER_SNAPSHOT_STATUSES = new Set([
  'COMPLETED',
  'NEEDS_REVIEW',
  'AUDITING_REVISION',
  'FETCHING_MARKET_PRICES',
])

/** Statuses que contam para budgeted_pages (páginas já orçadas). */
const BUDGETED_STATUSES = new Set(['COMPLETED', 'NEEDS_REVIEW'])

function extractionFromTotals(totals: Record<string, unknown> | null | undefined): unknown | null {
  if (!totals || typeof totals !== 'object') return null
  const last = totals.last_extraction
  return last && typeof last === 'object' ? last : null
}

export interface QuoteProjectFolderSnapshot {
  consolidated_extraction: QuoteExtraction | Record<string, unknown>
  consolidated_bom: unknown
  project_sheet_palette: unknown
  batch_ids: string[]
  batches: Array<{
    id: string
    batch_label: string | null
    page_ranges: number[] | null
    status: string
    sale_price: number | null
    materials_cost: number | null
  }>
  modules: number
  environments: number
  folder_updated_at: string
}

function batchMeta(row: QuoteAnalysisRow) {
  const totals = row.totals && typeof row.totals === 'object' ? row.totals : {}
  const pageRanges = Array.isArray(totals.page_ranges)
    ? (totals.page_ranges as unknown[]).filter((n): n is number => typeof n === 'number')
    : null
  const sale =
    typeof totals.sale_price === 'number'
      ? totals.sale_price
      : typeof totals.total_sale === 'number'
        ? totals.total_sale
        : null
  const cost =
    typeof totals.materials_cost === 'number'
      ? totals.materials_cost
      : typeof totals.total_materials === 'number'
        ? totals.total_materials
        : null
  return {
    id: row.id,
    batch_label: typeof totals.batch_label === 'string' ? totals.batch_label : null,
    page_ranges: pageRanges,
    status: row.status,
    sale_price: sale,
    materials_cost: cost,
  }
}

/** Modalidade da 1ª análise da pasta (ordem created_at asc). */
function pricingParamsFromFirstBatch(analyses: QuoteAnalysisRow[]): PricingParams {
  const first = analyses[0]
  const raw =
    first?.pricing_params && typeof first.pricing_params === 'object'
      ? first.pricing_params
      : {}
  const totals =
    first?.totals && typeof first.totals === 'object' ? first.totals : {}
  const modality = normalizePricingModality(
    first?.pricing_modality ||
      (typeof totals.pricing_modality === 'string' ? totals.pricing_modality : null) ||
      DEFAULT_PRICING_PARAMS.modality,
  )
  return {
    modality,
    mpcPercent:
      Number(raw.mpcPercent ?? raw.mpc_margin_pct ?? totals.mpc_margin_pct) ||
      DEFAULT_PRICING_PARAMS.mpcPercent,
    materialMultiplier:
      Number(raw.materialMultiplier ?? raw.material_multiplier) ||
      DEFAULT_PRICING_PARAMS.materialMultiplier,
    sheetLossPct:
      Number(raw.sheetLossPct ?? raw.sheet_loss_pct) || DEFAULT_PRICING_PARAMS.sheetLossPct,
  }
}

/** Recalcula e persiste o snapshot consolidado da pasta. */
export async function refreshQuoteProjectFolderSnapshot(
  projectId: string,
): Promise<{ ok: boolean; modules?: number; error?: string }> {
  const { data: analyses, error } = await listQuoteAnalysesForProject(projectId)
  if (error) return { ok: false, error }

  const parts: unknown[] = []
  for (const row of analyses) {
    if (!FOLDER_SNAPSHOT_STATUSES.has(row.status) && row.status !== 'COMPLETED') continue
    const ext = extractionFromTotals(row.totals)
    if (ext) parts.push(ext)
  }

  // Páginas orçadas = união dos page_ranges dos lotes concluídos/em revisão.
  let budgeted: number[] = []
  for (const row of analyses) {
    if (!BUDGETED_STATUSES.has(row.status)) continue
    const ranges = batchMeta(row).page_ranges
    budgeted = mergeBudgetedPages(budgeted, ranges)
  }

  if (!parts.length) {
    // Sem extração consolidável: zera snapshot e alinha budgeted_pages aos lotes reais
    // (vazio quando não há lotes — evita “2/49” + R$ fantasma).
    const clearBudgeted = await updateQuoteProjectBudgetedPages(projectId, budgeted)
    if (clearBudgeted.error) return { ok: false, error: clearBudgeted.error }
    const clearTotals = await updateQuoteProjectTotals(projectId, {
      consolidated_extraction: null,
      consolidated_bom: null,
      project_sheet_palette: [],
      batch_ids: analyses.map((a) => a.id),
      batches: analyses.map(batchMeta),
      modules: 0,
      environments: 0,
      budgeted_pages: budgeted,
      sale_price: null,
      materials_cost: null,
      pricing_modality: null,
      mpc_margin_pct: null,
      material_multiplier: null,
      pricing_formula: null,
      folder_updated_at: new Date().toISOString(),
    })
    if (clearTotals.error) return { ok: false, error: clearTotals.error }
    return { ok: true, modules: 0 }
  }

  const merged = mergeProjectFolderExtractions(parts)
  const asExtraction = merged as QuoteExtraction
  const { extraction, consolidatedBom, projectSheetPalette } =
    consolidateExtractionForPricing(asExtraction)

  const batches = analyses.map(batchMeta)
  const saleSum = batches.reduce((s, b) => s + (b.sale_price ?? 0), 0)
  const costSum = batches.reduce((s, b) => s + (b.materials_cost ?? 0), 0)

  // Com BOM consolidado: venda = custo dos lotes × modalidade MPC da 1ª análise (não soma bruta).
  const pricingParams = pricingParamsFromFirstBatch(analyses)
  const hasConsolidatedBom =
    consolidatedBom &&
    typeof consolidatedBom === 'object' &&
    (Array.isArray((consolidatedBom as { sheets?: unknown }).sheets) ||
      Array.isArray((consolidatedBom as { hardware?: unknown }).hardware))
  const folderPricing =
    hasConsolidatedBom && costSum > 0
      ? calculateSalePrice(costSum, pricingParams, 0)
      : null
  const folderSale = folderPricing?.salePrice ?? (saleSum > 0 ? saleSum : null)
  const folderCost = costSum > 0 ? costSum : null

  const budgetedUpd = await updateQuoteProjectBudgetedPages(projectId, budgeted)
  if (budgetedUpd.error) return { ok: false, error: budgetedUpd.error }

  const snapshot: QuoteProjectFolderSnapshot = {
    consolidated_extraction: extraction,
    consolidated_bom: consolidatedBom,
    project_sheet_palette: projectSheetPalette,
    batch_ids: analyses.map((a) => a.id),
    batches,
    modules: countBillableModules(extraction),
    environments: Array.isArray(extraction.environments) ? extraction.environments.length : 0,
    folder_updated_at: new Date().toISOString(),
  }

  const upd = await updateQuoteProjectTotals(projectId, {
    ...snapshot,
    budgeted_pages: budgeted,
    sale_price: folderSale,
    materials_cost: folderCost,
    pricing_modality: folderPricing?.modality ?? pricingParams.modality,
    mpc_margin_pct:
      (folderPricing?.modality ?? pricingParams.modality) === 'mpc_margin'
        ? pricingParams.mpcPercent
        : null,
    material_multiplier:
      (folderPricing?.modality ?? pricingParams.modality) === 'material_multiplier'
        ? pricingParams.materialMultiplier
        : null,
    pricing_formula: folderPricing?.formulaLabel ?? null,
  })
  if (upd.error) return { ok: false, error: upd.error }
  return { ok: true, modules: snapshot.modules }
}

/**
 * Apaga a cotação das páginas pedidas: remove os lotes que cobrem essas páginas
 * (o lote é apagado inteiro — não dá para “cortar” meio lote) e recalcula a pasta.
 */
export async function removeBudgetedPagesFromProject(
  projectId: string,
  pagesToRemove: number[],
): Promise<{
  ok: boolean
  deletedBatches: number
  removedPages: number[]
  error?: string
}> {
  const wanted = new Set(normalizeSelectedPages(pagesToRemove))
  if (!wanted.size) {
    return {
      ok: false,
      deletedBatches: 0,
      removedPages: [],
      error: 'Nenhuma página válida para remover.',
    }
  }

  const { data: analyses, error } = await listQuoteAnalysesForProject(projectId)
  if (error) {
    return { ok: false, deletedBatches: 0, removedPages: [], error }
  }

  const toDelete: QuoteAnalysisRow[] = []
  const removed = new Set<number>()
  for (const row of analyses) {
    const ranges = batchMeta(row).page_ranges ?? []
    if (!ranges.some((p) => wanted.has(p))) continue
    toDelete.push(row)
    for (const p of ranges) removed.add(p)
  }

  let deletedBatches = 0
  for (const row of toDelete) {
    const del = await deleteQuoteAnalysis(row)
    if (del.error) {
      return {
        ok: false,
        deletedBatches,
        removedPages: [...removed].sort((a, b) => a - b),
        error: del.error,
      }
    }
    deletedBatches += 1
  }

  // Recalcula budgeted_pages + preço (também limpa órfãos sem lote).
  const refresh = await refreshQuoteProjectFolderSnapshot(projectId)
  if (!refresh.ok) {
    return {
      ok: false,
      deletedBatches,
      removedPages: [...removed].sort((a, b) => a - b),
      error: refresh.error || 'Falha ao atualizar a pasta após apagar páginas.',
    }
  }

  return {
    ok: true,
    deletedBatches,
    removedPages: [...removed].sort((a, b) => a - b),
  }
}
