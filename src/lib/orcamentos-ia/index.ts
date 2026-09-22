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
} from '@/lib/orcamentos-ia/pricing'
export type { PricingModality, PricingParams, PricingResult, ShoppingListItem } from '@/lib/orcamentos-ia/pricing'
export { runOrcamentosIaPipeline, reprocessOrcamentosIaPipeline } from '@/lib/orcamentos-ia/pipeline'
export {
  quoteExtractionSchema,
  EXTRACTOR_SYSTEM_PROMPT,
  AUDITOR_SYSTEM_PROMPT,
} from '@/lib/orcamentos-ia/schemas'
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
