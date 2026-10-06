import { normalizePricingModality, type PricingModality, type PricingParams } from '@/lib/orcamentos-ia/pricing'

export interface LegacyPricingParams {
  modality?: string
  mpcPercent?: number
  materialMultiplier?: number
  pricePerSqm?: number
  sheetLossPct?: number
  totalAreaSqm?: number
}

export interface MigratedPricing {
  params: PricingParams
  wasPerSqm: boolean
  notice: string | null
}

/** Converte pricing_params antigos (incl. per_sqm) para v11. */
export function migrateLegacyPricingParams(raw: unknown): MigratedPricing {
  const src =
    raw && typeof raw === 'object' ? (raw as LegacyPricingParams) : ({} as LegacyPricingParams)
  const wasPerSqm = src.modality === 'per_sqm'
  const modality: PricingModality = normalizePricingModality(src.modality)
  return {
    params: {
      modality,
      mpcPercent: typeof src.mpcPercent === 'number' ? src.mpcPercent : 45,
      materialMultiplier:
        typeof src.materialMultiplier === 'number' ? src.materialMultiplier : 2.5,
      sheetLossPct: typeof src.sheetLossPct === 'number' ? src.sheetLossPct : 15,
      totalAreaSqm: src.totalAreaSqm,
    },
    wasPerSqm,
    notice: wasPerSqm
      ? 'Este orçamento usava preço por m² de fachada. Foi convertido para margem MPC % (Corte Claude v11).'
      : null,
  }
}
