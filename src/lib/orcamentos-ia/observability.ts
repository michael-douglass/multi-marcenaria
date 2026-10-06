import type { BomLine } from '@/lib/orcamentos-ia/bom-engine'
import { normalizePricingModality, type PricingModality, type PricingParams } from '@/lib/orcamentos-ia/pricing'

export interface PriceAuditorRow {
  item: string
  category: string
  quantity: number
  unit: string
  unitCost: number
  totalCost: number
}

export interface ObservabilityBlocks {
  chainOfThought: string
  priceAuditor: PriceAuditorRow[]
  priceAuditorTotal: number
  salePrice: number
  modality: PricingModality
  formulaLabel: string
  responseJson: Record<string, unknown>
}

export function bomToAuditorRows(bom: BomLine[]): PriceAuditorRow[] {
  return bom.map((line) => ({
    item: line.item_description,
    category: line.item_category,
    quantity: line.quantity,
    unit: line.unit_of_measure,
    unitCost: line.unit_cost,
    totalCost: Math.round(line.quantity * line.unit_cost * 100) / 100,
  }))
}

export function sumAuditorRows(rows: PriceAuditorRow[]): number {
  return Math.round(rows.reduce((s, r) => s + r.totalCost, 0) * 100) / 100
}

export function applySaleMarkup(
  materialsCost: number,
  params: Pick<PricingParams, 'modality' | 'mpcPercent' | 'materialMultiplier'>,
): { salePrice: number; modality: PricingModality; formulaLabel: string } {
  const modality = normalizePricingModality(params.modality)
  if (modality === 'material_multiplier') {
    const n = Math.max(0, params.materialMultiplier)
    return {
      salePrice: Math.round(materialsCost * n * 100) / 100,
      modality,
      formulaLabel: `Custo × ${n}`,
    }
  }
  const pct = Math.min(95, Math.max(0, params.mpcPercent))
  const denom = 1 - pct / 100
  const sale = denom > 0 ? materialsCost / denom : materialsCost
  return {
    salePrice: Math.round(sale * 100) / 100,
    modality: 'mpc_margin',
    formulaLabel: `Custo ÷ (1 − ${pct}%)`,
  }
}

/** Monta os 3 blocos do PRD v11 (CoT + Auditor + JSON). */
export function buildObservabilityBlocks(input: {
  chainOfThought: string
  bom: BomLine[]
  pricing: Pick<PricingParams, 'modality' | 'mpcPercent' | 'materialMultiplier'>
  promptTraces?: unknown[]
  extractionSnippet?: unknown
}): ObservabilityBlocks {
  const priceAuditor = bomToAuditorRows(input.bom)
  const priceAuditorTotal = sumAuditorRows(priceAuditor)
  const sale = applySaleMarkup(priceAuditorTotal, input.pricing)
  return {
    chainOfThought: input.chainOfThought,
    priceAuditor,
    priceAuditorTotal,
    salePrice: sale.salePrice,
    modality: sale.modality,
    formulaLabel: sale.formulaLabel,
    responseJson: {
      engineering_cot: input.chainOfThought,
      bom: input.bom,
      price_auditor: priceAuditor,
      sale: sale,
      prompt_traces: input.promptTraces ?? [],
      extraction: input.extractionSnippet ?? null,
    },
  }
}

export type PromptAgentKey = 'extractor' | 'disassembler' | 'auditor'

export interface PromptOverrideRow {
  id?: string
  company_id: string
  agent_key: PromptAgentKey
  system_prompt: string
  active: boolean
}
