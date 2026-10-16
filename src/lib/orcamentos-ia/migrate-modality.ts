import {
  normalizePricingModality,
  type ModulePricingOverride,
  type PricingModality,
  type PricingParams,
} from '@/lib/orcamentos-ia/pricing'

export interface LegacyPricingParams {
  modality?: string
  mpcPercent?: number
  materialMultiplier?: number
  pricePerSqm?: number
  sheetLossPct?: number
  totalAreaSqm?: number
  moduleOverrides?: Record<string, ModulePricingOverride>
}

export interface MigratedPricing {
  params: PricingParams
  wasPerSqm: boolean
  notice: string | null
}

function parseModuleOverrides(raw: unknown): Record<string, ModulePricingOverride> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, ModulePricingOverride> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || !value || typeof value !== 'object') continue
    const v = value as ModulePricingOverride
    const entry: ModulePricingOverride = {}
    if (typeof v.mpcPercent === 'number' && Number.isFinite(v.mpcPercent)) {
      entry.mpcPercent = v.mpcPercent
    }
    if (
      typeof v.materialMultiplier === 'number' &&
      Number.isFinite(v.materialMultiplier)
    ) {
      entry.materialMultiplier = v.materialMultiplier
    }
    if (
      typeof entry.mpcPercent === 'number' ||
      typeof entry.materialMultiplier === 'number'
    ) {
      out[id] = entry
    }
  }
  return out
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
      moduleOverrides: parseModuleOverrides(src.moduleOverrides),
    },
    wasPerSqm,
    notice: wasPerSqm
      ? 'Este orçamento usava preço por m² de fachada. Foi convertido para margem MPC % (Corte Claude v11).'
      : null,
  }
}
