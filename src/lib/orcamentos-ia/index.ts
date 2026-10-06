export type {
  QuoteAnalysisMode,
  QuoteAnalysisStatus,
  QuoteAnalysisRow,
} from '@/lib/orcamentos-ia/storage'

export {
  ORCAMENTOS_IA_BUCKET,
  QUOTE_STATUS_PROGRESS,
  QUOTE_STATUS_LABEL,
  ensureOrcamentosIaBucket,
  uploadQuotePdf,
  createPendingQuoteAnalysis,
  updateQuoteAnalysisPdfPath,
} from '@/lib/orcamentos-ia/storage'

export { resolveMaterialPrice, barsOf3mFromMeters, endCapsForHandleBars, repriceZeroMaterials, CONTINGENCY_PRICE_WARNING, CONTINGENCY_PRICES } from '@/lib/orcamentos-ia/pricing'
export {
  calculateQuotePricing,
  calculateSalePrice,
  buildShoppingList,
  formatBRL,
  PRICING_MODALITY_LABEL,
  DEFAULT_PRICING_PARAMS,
  sheetsFromAreaM2,
  rollsForEdgeTapeMeters,
  normalizePricingModality,
} from '@/lib/orcamentos-ia/pricing'
export type { PricingModality, PricingParams, PricingResult, ShoppingListItem } from '@/lib/orcamentos-ia/pricing'
export {
  DEFAULT_SYSTEM_PREFERENCES,
  getSystemPreferences,
  upsertSystemPreferences,
  formatPreferencesForPrompt,
} from '@/lib/orcamentos-ia/system-preferences'
export type { SystemPreferences } from '@/lib/orcamentos-ia/system-preferences'
export { explodeModule, explodeFromExtractionModule, buildBoxMeshesFromBom } from '@/lib/orcamentos-ia/bom-engine'
export { buildObservabilityBlocks } from '@/lib/orcamentos-ia/observability'
export { migrateLegacyPricingParams } from '@/lib/orcamentos-ia/migrate-modality'
export { CORTE_CLAUDE_TOKENS } from '@/lib/orcamentos-ia/ui-tokens'
export { runOrcamentosIaPipeline, reprocessOrcamentosIaPipeline } from '@/lib/orcamentos-ia/pipeline'
export { quoteExtractionSchema } from '@/lib/orcamentos-ia/schemas'
export {
  estimateModuleDimensions,
  defaultPieceMm,
  defaultFrenteMm,
} from '@/lib/orcamentos-ia/dimension-defaults'
export {
  getCompanyMemories,
  listCompanyMemories,
  deleteCompanyMemory,
  saveCompanyMemory,
  formatMemoriesForPrompt,
  askMaxChat,
} from '@/lib/orcamentos-ia/memory'
export { loadQuoteAnalysisTree, getSignedPdfUrl, getSignedPageImageUrl, listQuotePagePaths, getSignedQuotePageUrls } from '@/lib/orcamentos-ia/quote-tree'
export {
  getInventoryItems,
  updateInventoryItem,
  updateInventoryItemsBatch,
  createInventoryItem,
  getInventoryAliases,
  createInventoryAlias,
  deleteInventoryAlias,
  getRollMeters,
  normalizeAlias,
  INVENTORY_CATEGORY_LABEL,
} from '@/lib/orcamentos-ia/inventory'
export type {
  InventoryCategory,
  InventoryItem,
  InventoryItemPatch,
  InventoryAlias,
  GetInventoryItemsParams,
  CreateInventoryItemParams,
} from '@/lib/orcamentos-ia/inventory'
